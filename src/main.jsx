import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PrivyProvider } from '@privy-io/react-auth';
import { ToastProvider } from './components/ui/ToastProvider.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import './styles/index.css';
import App from './App.jsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || 'cmupop2ly001d0cle1zlr2gk5';

// Definisi custom chain sesuai standar Viem yang dipakai Privy
const robinhoodTestnet = {
  id: 46630,
  name: 'Robinhood Chain Testnet',
  network: 'robinhood-testnet',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://robinhood-testnet.g.alchemy.com/v2/kuKmwsoR515lVdX5RgLKf'] },
    public: { http: ['https://robinhood-testnet.g.alchemy.com/v2/kuKmwsoR515lVdX5RgLKf'] },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://explorer.testnet.chain.robinhood.com' },
  },
};

const privyConfig = {
  loginMethods: ['email', 'wallet', 'google'],
  embeddedWallets: {
    createOnLogin: 'off',
    requireUserPasswordOnCreate: false,
  },
  appearance: {
    theme: 'light',
    accentColor: '#F97316',
    showWalletLoginFirst: true,
  },
  supportedChains: [robinhoodTestnet],
};

// eslint-disable-next-line react-refresh/only-export-components
function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <PrivyProvider appId={PRIVY_APP_ID} config={privyConfig}>
        <ToastProvider>
          <ErrorBoundary>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </ErrorBoundary>
        </ToastProvider>
      </PrivyProvider>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>
);