import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWalletClient } from '../hooks/index.js';
import { useUSDGBalance, useVerificationStatus, useContractWrite } from '../hooks/index.js';
import { Button, Card, Badge } from '../components/ui/index.js';
import { formatUSDG, shortAddress } from '../utils/formatters.js';
import { CONTRACT_ADDRESSES } from '../config/contracts.js';

export default function GetStarted() {
  const { login } = usePrivy();
  const { walletClient } = useWalletClient();
  const walletAddress = walletClient?.account?.address;
  const { data: balance, refetch: refetchBalance } = useUSDGBalance(walletAddress);
  const { data: isVerified, refetch: refetchVerification } = useVerificationStatus(walletAddress);
  const { execute } = useContractWrite();
  const [claiming, setClaiming] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Wallet is connected when walletClient is fully initialized with an address
  const isConnected = !!walletClient && !!walletAddress;

  const handleClaimFaucet = async () => {
    if (!walletClient) return;
    setClaiming(true);
    try {
      await execute('mockUSDG', 'faucet', []);
      await refetchBalance();
    } catch (e) {
      console.error('Faucet failed:', e);
    } finally {
      setClaiming(false);
    }
  };

  const handleVerify = async () => {
    if (!walletClient) return;
    setVerifying(true);
    try {
      await execute('mockHumanVerifier', 'verifyMe', []);
      await refetchVerification();
    } catch (e) {
      console.error('Verification failed:', e);
    } finally {
      setVerifying(false);
    }
  };

  // Wait for wallet client to be fully initialized
  if (!walletClient) {
    return (
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-display-lg font-display font-bold text-text-primary">
            Get Started
          </h1>
          <p className="text-text-secondary mt-2">
            Set up your wallet for the RWA Smart Ticket platform
          </p>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
          <p className="ml-4 text-text-secondary">Connecting wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-display-lg xs:text-display-md font-display font-bold text-text-primary">
          Get Started
        </h1>
        <p className="text-text-secondary xs:text-sm mt-2">
          Set up your wallet for the RWA Smart Ticket platform
        </p>
      </div>

      <Card className="space-y-4 xs:space-y-3">
        <h2 className="text-heading-md xs:text-heading-sm font-semibold text-text-primary">Network Info</h2>
        <div className="grid gap-3 xs:gap-2 sm:gap-4 sm:grid-cols-2">
          <div className="bg-background rounded-lg p-3 xs:p-4">
            <p className="text-caption xs:text-[11px] text-text-muted">Chain ID</p>
            <p className="font-mono text-text-primary xs:text-sm">46630</p>
          </div>
          <div className="bg-background rounded-lg p-3 xs:p-4">
            <p className="text-caption xs:text-[11px] text-text-muted">Network</p>
            <p className="font-mono text-text-primary xs:text-sm">Robinhood Chain Testnet</p>
          </div>
          <div className="bg-background rounded-lg p-3 xs:p-4">
            <p className="text-caption xs:text-[11px] text-text-muted">RPC URL</p>
            <p className="font-mono text-xs xs:text-sm text-text-primary truncate">
              https://robinhood-testnet.g.alchemy.com/v2/kuKmwsoR515lVdX5RgLKf
            </p>
          </div>
          <div className="bg-background rounded-lg p-3 xs:p-4">
            <p className="text-caption xs:text-[11px] text-text-muted">Explorer</p>
            <a 
              href="https://explorer.testnet.chain.robinhood.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-mono text-xs xs:text-sm text-primary hover:underline truncate block"
            >
              explorer.testnet.chain.robinhood.com
            </a>
          </div>
        </div>
      </Card>

      <Card className="space-y-4 xs:space-y-3">
        <h2 className="text-heading-md xs:text-heading-sm font-semibold text-text-primary">Wallet Status</h2>
        <div className="space-y-3 xs:space-y-2">
          <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2 p-3 xs:p-4 bg-background rounded-lg">
            <div>
              <p className="text-caption xs:text-[11px] text-text-muted">Address</p>
              <p className="font-mono text-text-primary xs:text-sm">
                {isConnected ? shortAddress(walletClient.account.address) : 'Not connected'}
              </p>
            </div>
            {isConnected && (
              <Badge variant={isVerified ? 'success' : 'warning'}>
                {isVerified ? 'Verified' : 'Not Verified'}
              </Badge>
            )}
          </div>
          
          <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2 p-3 xs:p-4 bg-background rounded-lg">
            <div>
              <p className="text-caption xs:text-[11px] text-text-muted">MockUSDG Balance</p>
              <p className="font-mono text-text-primary xs:text-sm">
                {isConnected ? (balance ? formatUSDG(balance) : '0') : '...'} mUSDG
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="space-y-4 xs:space-y-3">
        <h2 className="text-heading-md xs:text-heading-sm font-semibold text-text-primary">Quick Actions</h2>
        
        {!isConnected ? (
           <div className="text-center p-6 bg-background rounded-lg border border-border border-dashed">
              <p className="text-text-secondary mb-4">You need to connect your wallet first to use these actions.</p>
              <Button onClick={() => login()} size="lg">Connect Wallet</Button>
           </div>
        ) : (
          <>
            <div className="grid gap-3 xs:gap-2 sm:grid-cols-2">
              <Button 
                onClick={handleClaimFaucet} 
                disabled={claiming}
                className="w-full sm:w-auto"
                size="lg"
              >
                {claiming ? 'Claiming...' : 'Claim 1,000 mUSDG'}
              </Button>
              
              <Button 
                variant="secondary"
                onClick={handleVerify} 
                disabled={verifying || isVerified}
                className="w-full sm:w-auto"
                size="lg"
              >
                {verifying ? 'Verifying...' : isVerified ? 'Already Verified' : 'Verify Me'}
              </Button>
            </div>
            <p className="text-caption xs:text-[11px] text-text-muted text-center">
              MockUSDG has 6 decimals. Faucet gives 1,000 mUSDG per call.
            </p>
          </>
        )}
      </Card>
      
      {/*... Sisa kode kontrak deployed ...*/}
      <Card className="space-y-3 xs:space-y-2">
        <h2 className="text-heading-md xs:text-heading-sm font-semibold text-text-primary">Deployed Contracts</h2>
        <div className="space-y-2 xs:space-y-1.5 text-sm xs:text-xs">
          <div className="flex items-center justify-between p-3 bg-background rounded-lg">
            <span className="text-text-secondary">TicketFactory</span>
            <a 
              href={`https://explorer.testnet.chain.robinhood.com/address/${CONTRACT_ADDRESSES.factory}`}
              target="_blank" 
              rel="noopener noreferrer"
              className="font-mono text-primary hover:underline truncate max-w-[200px]"
            >
              {shortAddress(CONTRACT_ADDRESSES.factory)}
            </a>
          </div>
          <div className="flex items-center justify-between p-3 bg-background rounded-lg">
            <span className="text-text-secondary">MockUSDG</span>
            <a 
              href={`https://explorer.testnet.chain.robinhood.com/address/${CONTRACT_ADDRESSES.mockUSDG}`}
              target="_blank" 
              rel="noopener noreferrer"
              className="font-mono text-primary hover:underline truncate max-w-[200px]"
            >
              {shortAddress(CONTRACT_ADDRESSES.mockUSDG)}
            </a>
          </div>
          <div className="flex items-center justify-between p-3 bg-background rounded-lg">
            <span className="text-text-secondary">MockHumanVerifier</span>
            <a 
              href={`https://explorer.testnet.chain.robinhood.com/address/${CONTRACT_ADDRESSES.mockHumanVerifier}`}
              target="_blank" 
              rel="noopener noreferrer"
              className="font-mono text-primary hover:underline truncate max-w-[200px]"
            >
              {shortAddress(CONTRACT_ADDRESSES.mockHumanVerifier)}
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}