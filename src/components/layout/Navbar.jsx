import { Link, useLocation } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import { useWalletClient } from '../../hooks/index.js';
import { useUSDGBalance } from '../../hooks/index.js';
import { useToast } from '../../hooks/useToast.jsx';
import { formatUSDG, shortAddress } from '../../utils/formatters.js';
import { CHAIN } from '../../config/contracts.js';

const NAV_ITEMS = [
  { path: '/explore', label: 'Explore' },
  { path: '/my-tickets', label: 'My Tickets' },
  { path: '/dashboard', label: 'Organizer' },
  { path: '/docs', label: 'Docs' },
  { path: '/get-started', label: 'Get Started' },
];

export default function Navbar() {
  // Tambahkan authenticated dari usePrivy
  const { ready, authenticated, login, logout } = usePrivy();
  const { walletClient } = useWalletClient();
  const { toast } = useToast();
  const location = useLocation();

  const walletAddress = walletClient?.account?.address;
  const { data: balance } = useUSDGBalance(walletAddress);
  // Validasi ketat: Privy harus ready, user terotentikasi, dan walletAddress tersedia
  const isConnected = ready && authenticated && !!walletAddress;

  // Copy address to clipboard
  const handleCopyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      toast.success('Address copied to clipboard');
    }
  };

  // Switch network handler
  const handleSwitchNetwork = async () => {
    if (!walletClient?.provider) return;
    const targetChainId = `0x${CHAIN.id.toString(16)}`;
    try {
      await walletClient.provider.request({ 
        method: 'wallet_switchEthereumChain', 
        params: [{ chainId: targetChainId }] 
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        await walletClient.provider.request({ 
          method: 'wallet_addEthereumChain', 
          params: [{ 
            chainId: targetChainId, 
            chainName: CHAIN.name, 
            rpcUrls: CHAIN.rpcUrls.default.http, 
            blockExplorerUrls: [CHAIN.blockExplorers.default.url], 
            nativeCurrency: CHAIN.nativeCurrency 
          }] 
        });
      }
    }
  };

  return (
    <nav className="sticky top-0 z-40 bg-surface/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Left: Logo + Chara - clickable */}
          <div className="flex justify-start min-w-0">
            <Link to="/explore" className="flex items-center gap-2 text-heading-lg font-display font-bold text-text-primary">
              <img src="/logo.png" alt="chara" className="w-8 h-8" />
              chara
            </Link>
          </div>
          
          {/* Center: Navigation - stays centered */}
          <div className="flex justify-center min-w-0">
            <div className="hidden md:flex items-center gap-6">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? 'text-primary'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          
          {/* Right: Wallet/Connect */}
          <div className="flex justify-end min-w-0">
            {/* Cegah flickering dengan Skeleton Loading saat Privy belum ready */}
            {!ready ? (
              <div className="w-32 h-9 bg-border animate-pulse rounded-lg"></div>
            ) : isConnected ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-secondary font-mono">
                  {formatUSDG(balance || 0)} mUSDG
                </span>
                <div className="relative group">
                  <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-background transition-colors">
                    <span className="font-mono text-xs">{shortAddress(walletAddress)}</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className="absolute right-0 mt-2 w-56 bg-surface rounded-lg shadow-[var(--shadow-modal)] border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 p-2">
                    <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-text-muted border-b border-border mb-1">
                      <span>🔗</span>
                      <span>Robinhood Testnet</span>
                    </div>
                    <button onClick={handleCopyAddress} className="w-full px-3 py-1.5 text-left text-sm text-text-primary hover:bg-background rounded flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3m-3-3v12" />
                      </svg>
                      Copy Address
                    </button>
                    <button onClick={handleSwitchNetwork} className="w-full px-3 py-1.5 text-left text-sm text-text-primary hover:bg-background rounded">
                      Switch Network
                    </button>
                    <button onClick={logout} className="w-full px-3 py-1.5 text-left text-sm text-text-primary hover:bg-background rounded">
                      Disconnect
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => login()}
                className="btn btn-primary text-sm"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}