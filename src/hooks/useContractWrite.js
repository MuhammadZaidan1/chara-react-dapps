import { useCallback } from 'react';
import { useWalletClient } from './index.js';
import { waitForTransactionReceipt, simulateContract } from '../utils/viemHelpers.js';
import { CONTRACT_ADDRESSES, ABIS } from '../config/index.js';
import { CHAIN } from '../config/contracts.js';
import { useToast } from './useToast.jsx';

// Helper untuk memberikan jeda agar MetaMask tidak "tersedak" saat Two-Step Transaction
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Module-level helpers
async function ensureCorrectChain(provider) {
  if (!provider) return;
  
  try {
    await provider.request({ method: 'eth_requestAccounts' });
  } catch {
    // Ignore - some providers don't need this
  }

  const chainId = await provider.request({ method: 'eth_chainId' });
  const currentChainId = Number(chainId);
  
  if (currentChainId !== CHAIN.id) {
    try {
      await provider.request({ 
        method: 'wallet_switchEthereumChain', 
        params: [{ chainId: `0x${CHAIN.id.toString(16)}` }] 
      });
    } catch (e) {
      if (e.code === 4902) {
        await provider.request({ 
          method: 'wallet_addEthereumChain', 
          params: [{ 
            chainId: `0x${CHAIN.id.toString(16)}`, 
            chainName: CHAIN.name, 
            rpcUrls: CHAIN.rpcUrls.default.http, 
            blockExplorerUrls: [CHAIN.blockExplorers.default.url], 
            nativeCurrency: CHAIN.nativeCurrency 
          }] 
        });
      } else {
        const error = new Error('Silakan ganti jaringan ke Robinhood Chain Testnet di wallet Anda');
        error.cause = e;
        throw error;
      }
    }
    
    const newChainId = await provider.request({ method: 'eth_chainId' });
    if (Number(newChainId) !== CHAIN.id) {
      throw new Error('Gagal beralih jaringan. Silakan ganti manual ke Robinhood Chain Testnet (Chain ID: 46630) di wallet Anda.');
    }
  }
}

function parseViemError(error) {
  const errorString = error?.message || error?.details || error?.shortMessage || String(error);
  
  // 1. Rejeksi Pengguna & Jaringan
  if (errorString.includes('User rejected')) return 'Transaksi dibatalkan oleh pengguna.';
  if (errorString.includes('insufficient funds')) return 'Gagal: Saldo gas (ETH) tidak cukup untuk biaya transaksi.';
  if (errorString.includes('ERC20: insufficient allowance')) return 'Gagal: Limit approval mUSDG tidak cukup.';

  // 2. Custom Errors dari EventTicket.sol (Pemetaan Lengkap)
  
  // -- Validasi Akun & Kepemilikan (Paling Sering Muncul) --
  if (errorString.includes('TicketAlreadyOwned') || errorString.includes('0xaff68b69')) 
    return 'Gagal: Alamat dompet penerima sudah memiliki tiket (Maksimal 1 tiket per akun).';
  if (errorString.includes('UnverifiedAccount') || errorString.includes('0x09cf9bcb')) 
    return 'Gagal: Alamat dompet penerima/pembeli belum diverifikasi. Lakukan "Verify Me" terlebih dahulu.';
    
  // -- Validasi Minting & Penjualan --
  if (errorString.includes('InvalidTierIndex')) return 'Gagal: Tier tiket tidak valid atau tidak ditemukan.';
  if (errorString.includes('InvalidRecipient')) return 'Gagal: Alamat penerima tidak valid.';
  if (errorString.includes('InvalidBatchLength')) return 'Gagal: Jumlah tiket melebihi batas maksimal pencetakan per transaksi.';
  if (errorString.includes('TierQuotaExceeded')) return 'Gagal: Kuota tiket untuk kategori/phase ini sudah habis.';
  if (errorString.includes('SaleWindowClosed')) return 'Gagal: Waktu penjualan belum dimulai atau sudah ditutup.';
  
  // -- Validasi Marketplace --
  if (errorString.includes('NotTicketOwner')) return 'Gagal: Anda bukan pemilik tiket ini.';
  if (errorString.includes('InvalidListingPrice')) return 'Gagal: Harga jual tidak valid atau melebihi batas maksimal.';
  if (errorString.includes('ListingNotFound')) return 'Gagal: Listing tiket tidak ditemukan (mungkin sudah terjual/dibatalkan).';
  if (errorString.includes('NotListingSeller')) return 'Gagal: Anda bukan pembuat listing ini.';
  if (errorString.includes('MarketplaceClosed')) return 'Gagal: Marketplace ditutup karena acara sedang berlangsung atau sudah selesai.';
  
  // -- Validasi Organizer & Deployment --
  if (errorString.includes('NoWithdrawableFunds')) return 'Gagal: Belum ada dana yang bisa ditarik.';
  if (errorString.includes('OnlyOrganizer')) return 'Gagal: Akses ditolak. Hanya organizer acara yang berhak melakukan ini.';
  if (errorString.includes('InvalidTierCount')) return 'Gagal: Jumlah tier tidak memenuhi syarat konfigurasi kontrak.';
  if (errorString.includes('InvalidEventTime')) return 'Gagal: Konfigurasi waktu event tidak valid.';
  if (errorString.includes('InvalidTier')) return 'Gagal: Parameter konfigurasi tier tidak valid.';
  if (errorString.includes('PastTimestamp')) return 'Gagal: Waktu tidak boleh diatur ke masa lalu.';
  if (errorString.includes('InvalidAddress')) return 'Gagal: Konfigurasi alamat pada kontrak tidak valid.';
  
  // 3. Fallback Umum
  return 'Transaksi gagal: ' + (error?.shortMessage || 'Kesalahan tidak diketahui pada jaringan/kontrak.');
}

export function useContractWrite() {
  const { walletClient, ethereumProvider } = useWalletClient();
  const { toast } = useToast();

  const execute = useCallback(async (contract, functionName, args = [], options = {}) => {
    if (!walletClient) {
      throw new Error('Wallet not connected');
    }

    const address = CONTRACT_ADDRESSES[contract] || contract;
    const abi = ABIS[contract] || ABIS.eventTicket;
    
    if (!address || !abi) {
      throw new Error(`Contract ${contract} not configured`);
    }

    try {
      await ensureCorrectChain(ethereumProvider);
      
      toast.info(`Tunggu konfirmasi dompet... (${functionName})`);
      
      const request = await simulateContract(walletClient, {
        address,
        abi,
        functionName,
        args,
        value: options.value || 0n,
        account: walletClient.account, 
      });
      
      const hash = await walletClient.writeContract(request);
      
      toast.info('Transaksi sedang diproses di jaringan...');
      
      const receipt = await waitForTransactionReceipt(hash);
      
      if (receipt.status === 'success') {
        toast.success(`Transaksi ${functionName} berhasil!`);
        return { hash, receipt };
      } else {
        throw new Error('Transaksi gagal direkam di jaringan');
      }
    } catch (error) {
      toast.error(parseViemError(error));
      throw error;
    }
  }, [walletClient, ethereumProvider, toast]);

  const executeTwoStep = useCallback(async (approveContract, writeContractName, writeArgs, approveAmount, options = {}) => {
    if (!walletClient) {
      throw new Error('Wallet not connected');
    }

    const approveAbi = ABIS[approveContract];
    const approveAddress = CONTRACT_ADDRESSES[approveContract];
    const writeAbi = ABIS.eventTicket;
    const writeAddress = options.writeAddress;

    if (!approveAddress || !approveAbi || !writeAddress) {
      throw new Error('Contract not configured');
    }

    let approveHash;

    try {
      await ensureCorrectChain(ethereumProvider);
      
      toast.info('Tahap 1/2: Tunggu konfirmasi dompet (Approve mUSDG)...');
      
      const approveRequest = await simulateContract(walletClient, {
        address: approveAddress,
        abi: approveAbi,
        functionName: 'approve',
        args: [writeAddress, approveAmount],
        account: walletClient.account,
      });
      
      approveHash = await walletClient.writeContract(approveRequest);
      toast.info('Approval mUSDG sedang diproses...');
      
      const approveReceipt = await waitForTransactionReceipt(approveHash);
      if (approveReceipt.status !== 'success') {
        throw new Error('Approval gagal direkam di jaringan');
      }
      
      toast.success('Approve mUSDG berhasil!');
      
      // JEDA PENTING: Memberikan waktu pada MetaMask untuk mereset state internalnya
      await sleep(1500); 

    } catch (error) {
      toast.error('Gagal pada tahap Approval: ' + parseViemError(error));
      throw error;
    }

    try {
      await ensureCorrectChain(ethereumProvider);
      
      toast.info(`Tahap 2/2: Tunggu konfirmasi dompet (${writeContractName})...`);
      
      const writeRequest = await simulateContract(walletClient, {
        address: writeAddress,
        abi: writeAbi,
        functionName: writeContractName,
        args: writeArgs,
        account: walletClient.account, 
      });
      
      const writeHash = await walletClient.writeContract(writeRequest);
      toast.info('Transaksi sedang diproses di jaringan...');
      
      const receipt = await waitForTransactionReceipt(writeHash);
      
      if (receipt.status === 'success') {
        toast.success(`Transaksi ${writeContractName} berhasil!`);
        return { approveHash, writeHash, receipt };
      } else {
        throw new Error('Transaksi gagal direkam di jaringan');
      }
    } catch (error) {
      toast.error('Gagal pada tahap Eksekusi: ' + parseViemError(error));
      throw error;
    }
  }, [walletClient, ethereumProvider, toast]);

  return { execute, executeTwoStep };
}