import { Outlet } from 'react-router-dom';
import Navbar from './Navbar.jsx';

export default function PageWrapper() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-4 lg:px-6 xl:px-8 py-6 sm:py-8">
        <Outlet />
      </main>
      <footer className="border-t border-border py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 text-center text-text-muted text-sm xs:text-xs">
          Built for Robinhood Chain Testnet
        </div>
      </footer>
    </div>
  );
}