import { CONTRACT_ADDRESSES } from '../config/contracts.js';
import { shortAddress } from '../utils/formatters.js';
import { Card } from '../components/ui/index.js';

export default function Docs() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-display-lg font-display font-bold text-text-primary">
          RWA Smart Ticket — Documentation
        </h1>
        <p className="text-text-secondary mt-2">
            Hackathon submission documentation for Robinhood Chain Testnet
        </p>
      </div>

      <Card className="space-y-6">
        <h2 className="text-heading-lg font-semibold text-text-primary">Overview</h2>
        <div className="space-y-4 text-text-secondary">
          <p>
            RWA Smart Ticket is a decentralized ticketing platform built on Robinhood Chain Testnet that solves real-world event ticketing problems:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Anti-scalping:</strong> On-chain price caps prevent tickets from being resold above 2× the highest primary price per category</li>
            <li><strong>No P2P transfers:</strong> Tickets can only be resold through the internal marketplace, not transferred freely</li>
            <li><strong>Directed minting:</strong> Buy multiple tickets in one transaction and distribute directly to recipients' wallets</li>
            <li><strong>Organizer holdback:</strong> 20% of revenue held until event ends, providing trust layer for attendees</li>
            <li><strong>Cryptographic gate validation:</strong> Off-chain QR verification with EIP-191 signatures, zero backend required</li>
          </ul>
        </div>
      </Card>

      <Card className="space-y-6">
        <h2 className="text-heading-lg font-semibold text-text-primary">Tech Stack & Network</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="bg-background rounded-lg p-4">
            <h3 className="text-heading-md font-semibold mb-2">Blockchain</h3>
            <ul className="space-y-1 text-sm text-text-secondary">
              <li>Network: Robinhood Chain Testnet</li>
              <li>Chain ID: 46630</li>
              <li>RPC: https://robinhood-testnet.g.alchemy.com/v2/kuKmwsoR515lVdX5RgLKf</li>
              <li>Explorer: <a href="https://explorer.testnet.chain.robinhood.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">explorer.testnet.chain.robinhood.com</a></li>
            </ul>
          </div>
          <div className="bg-background rounded-lg p-4">
            <h3 className="text-heading-md font-semibold mb-2">Smart Contracts</h3>
            <ul className="space-y-1 text-sm text-text-secondary">
              <li>Factory: <a href={`https://explorer.testnet.chain.robinhood.com/address/${CONTRACT_ADDRESSES.factory}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-mono">{shortAddress(CONTRACT_ADDRESSES.factory)}</a></li>
              <li>MockUSDG: <a href={`https://explorer.testnet.chain.robinhood.com/address/${CONTRACT_ADDRESSES.mockUSDG}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-mono">{shortAddress(CONTRACT_ADDRESSES.mockUSDG)}</a></li>
              <li>MockHumanVerifier: <a href={`https://explorer.testnet.chain.robinhood.com/address/${CONTRACT_ADDRESSES.mockHumanVerifier}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-mono">{shortAddress(CONTRACT_ADDRESSES.mockHumanVerifier)}</a></li>
            </ul>
          </div>
          <div className="bg-background rounded-lg p-4">
            <h3 className="text-heading-md font-semibold mb-2">Frontend</h3>
            <ul className="space-y-1 text-sm text-text-secondary">
              <li>React 19 + Vite</li>
              <li>Tailwind CSS (custom design system)</li>
              <li>Viem + Privy (embedded + external wallets)</li>
              <li>TanStack Query for state management</li>
            </ul>
          </div>
          <div className="bg-background rounded-lg p-4">
            <h3 className="text-heading-md font-semibold mb-2">Standards</h3>
            <ul className="space-y-1 text-sm text-text-secondary">
              <li>ERC-721 (OpenZeppelin v5)</li>
              <li>ERC-20 (MockUSDG, 6 decimals)</li>
              <li>EIP-191 personal_sign for QR codes</li>
              <li>IPFS via Pinata for metadata</li>
            </ul>
          </div>
        </div>
      </Card>

      <Card className="space-y-6">
        <h2 className="text-heading-lg font-semibold text-text-primary">Get Started (For Judges/Testers)</h2>
        <ol className="space-y-4 text-text-secondary">
          <li>
            <strong>Connect Wallet:</strong> Visit <code className="bg-background px-2 py-1 rounded font-mono">/get-started</code> and click "Connect Wallet" — use email/social (embedded) or MetaMask/WalletConnect (external)
          </li>
          <li>
            <strong>Get MockUSDG:</strong> Click "Claim 1,000 mUSDG" to mint test tokens (6 decimals, no cooldown)
          </li>
          <li>
            <strong>Verify Identity:</strong> Click "Verify Me" to complete mock human verification (required for all transactions)
          </li>
          <li>
            <strong>Explore Events:</strong> Go to <code className="bg-background px-2 py-1 rounded font-mono">/explore</code> to see deployed events
          </li>
          <li>
            <strong>Buy Tickets:</strong> Select tier, add recipients (max 5), approve USDG, confirm mint
          </li>
          <li>
            <strong>Resale:</strong> List your ticket on the Marketplace tab (price capped at 2× category max)
          </li>
          <li>
            <strong>Gate Check:</strong> Organizer uses <code className="bg-background px-2 py-1 rounded font-mono">/dashboard</code> scanner to validate QR codes
          </li>
        </ol>
      </Card>

      <Card className="space-y-6">
        <h2 className="text-heading-lg font-semibold text-text-primary">Key Concepts</h2>
        <div className="space-y-4">
          <div className="bg-background rounded-lg p-4">
            <h3 className="text-heading-md font-semibold mb-2">Category, Phase, Tier</h3>
            <ul className="space-y-1 text-sm text-text-secondary">
              <li><strong>Category:</strong> Ticket type (VIP, Regular, etc.) — defines facilities</li>
              <li><strong>Phase:</strong> Sale window (Early Bird, Presale, Normal) — defines when</li>
              <li><strong>Tier:</strong> One Category × Phase combination — one row in contract</li>
            </ul>
          </div>
          <div className="bg-background rounded-lg p-4">
            <h3 className="text-heading-md font-semibold mb-2">Price Cap (Resale)</h3>
            <p className="text-sm text-text-secondary">
              Max resale price = 2 × highest primary price in the same category (across all phases). 
              Enforced on-chain in <code className="bg-background px-1 rounded font-mono">listTicket()</code>.
            </p>
          </div>
          <div className="bg-background rounded-lg p-4">
            <h3 className="text-heading-md font-semibold mb-2">Holdback (20%)</h3>
            <p className="text-sm text-text-secondary">
              20% of primary & secondary revenue locked until <code className="bg-background px-1 rounded font-mono">eventEndTime</code>. 
              Before end: can withdraw up to 80%. After end: 100% withdrawable.
              <strong>Not a refund mechanism</strong> — trust layer only.
            </p>
          </div>
          <div className="bg-background rounded-lg p-4">
            <h3 className="text-heading-md font-semibold mb-2">Soulbound After Event</h3>
            <p className="text-sm text-text-secondary">
              After <code className="bg-background px-1 rounded font-mono">eventEndTime</code>, tickets become permanently non-transferable (soulbound). 
              No marketplace, no transfers, no approvals — only memorabilia.
            </p>
          </div>
        </div>
      </Card>

      <Card className="space-y-6">
        <h2 className="text-heading-lg font-semibold text-text-primary">Known Limitations (MVP)</h2>
        <ul className="list-disc list-inside space-y-2 text-text-secondary">
          <li>MockUSDG & MockHumanVerifier only — not real Paxos USDG or Gitcoin Passport/World ID</li>
          <li>Single scanner device — no multi-gate synchronization</li>
          <li>No automatic refunds — holdback is trust layer, not guarantee</li>
          <li>No event cancellation — <code className="bg-background px-1 rounded font-mono">cancelEvent()</code> is roadmap</li>
          <li>Fixed fees (2% primary, 4%/6% secondary) — not configurable</li>
          <li>No indexer — <code className="bg-background px-1 rounded font-mono">/explore</code> reads directly from Factory (fine for small scale)</li>
          <li>Demo time control (<code className="bg-background px-1 rounded font-mono">advanceTime()</code>) exists for hackathon demo only</li>
          <li>QR codes use Base64 EIP-191 payload — not binary packed (roadmap optimization)</li>
        </ul>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-heading-lg font-semibold text-text-primary">Links</h2>
        <div className="space-y-2">
          <a href="https://github.com/your-org/chara-frontend" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.305-.536-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
            GitHub Repository
          </a>
          <a href="mailto:team@chara.example.com" className="text-primary hover:underline flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            Contact Team
          </a>
        </div>
      </Card>
    </div>
  );
}