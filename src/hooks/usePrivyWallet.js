import { useWallets, usePrivy } from '@privy-io/react-auth';
import { useState, useEffect } from 'react';
import { createWalletClient, custom } from 'viem';
import { CHAIN } from '../config/contracts.js';

export function useWalletClient() {
  const { user, ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const [walletClient, setWalletClient] = useState(null);
  const [ethereumProvider, setEthereumProvider] = useState(null);
  const [walletReady, setWalletReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const initWallet = async () => {
      // Reset wallet ready state when privy state changes
      setWalletReady(false);
      
      // Tunggu sampai Privy benar-benar siap dan array wallets terisi
      if (!ready || !authenticated || !user || !wallets || wallets.length === 0) {
        if (isMounted) {
          setWalletClient(null);
          setEthereumProvider(null);
        }
        return;
      }

      // BACA DOCS PRIVY: Semua dompet (embedded/eksternal) ada di array `wallets`
      // 1. Prioritaskan Embedded Wallet Privy (walletClientType === 'privy')
      // 2. Jika tidak ada, ambil MetaMask/External yang sedang terhubung
      let activeWallet = wallets.find(w => w.walletClientType === 'privy');
      
      if (!activeWallet) {
        activeWallet = wallets.find(w => w.connected) || wallets[0];
      }

      if (activeWallet && activeWallet.address) {
        try {
          // Docs Privy: getEthereumProvider wajib di-await
          const provider = await activeWallet.getEthereumProvider();
          
          if (provider && isMounted) {
            const client = createWalletClient({
              chain: CHAIN,
              transport: custom(provider),
              account: activeWallet.address,
            });
            
            setWalletClient(client);
            setEthereumProvider(provider);
            setWalletReady(true);
          }
        } catch (e) {
          console.error("Gagal mendapatkan provider dari Privy:", e);
          if (isMounted) {
            setWalletReady(false);
          }
        }
      }
    };

    initWallet();

    return () => {
      isMounted = false;
    };
  }, [ready, authenticated, user, wallets]);

  // walletReady means walletClient is fully initialized and ready to use
  return { walletClient, ethereumProvider, ready: walletReady, user, walletReady };
}