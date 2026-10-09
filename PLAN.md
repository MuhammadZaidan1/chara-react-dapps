# PLAN.md — chara-frontend (RWA Smart Ticket)

## Project Overview
Frontend for RWA Smart Ticket platform on **Robinhood Chain Testnet** (chain ID 46630).
Smart contracts deployed and verified (see OUTPUT.md). Build complete E2E flow: create event → publish → mint → resale → scan → withdraw.

---

## Configuration (from `.env`)
| Variable | Value |
|---|---|
| `VITE_RPC_URL` | `https://robinhood-testnet.g.alchemy.com/v2/kuKmwsoR515lVdX5RgLKf` |
| `VITE_CHAIN_ID` | `46630` |
| `VITE_PRIVY_APP_ID` | `cmupop2ly001d0cle1zlr2gk5` |
| `VITE_TICKET_FACTORY_ADDRESS` | `0x0dB0a481Ef2d53228eD1dD269dFbc0b9fA2559f8` |
| `VITE_MOCK_USDG_ADDRESS` | `0x29e688092F42e533A69dB2dA0Df576579a5cd7f9` |
| `VITE_MOCK_HUMAN_VERIFIER_ADDRESS` | `0xaC3B0754697BfEB5A094B4578ba46848715C220F` |
| `VITE_PINATA_API_KEY` | `dea317f2454a06e70def` |
| `VITE_PINATA_GATEWAY` | `https://gateway.pinata.cloud` |

---

## Tech Stack
| Layer | Choice |
|---|---|
| Framework | React 19 + Vite |
| Styling | Tailwind CSS (design system from DESIGN.md) |
| Routing | React Router v6 |
| Web3 | Viem + Privy React |
| State (server) | TanStack Query v5 |
| QR Scanner | `html5-qrcode` (camera) + fallback |
| QR Generator | `qrcode.react` |
| Testing | Vitest + React Testing Library |
| Toast | Custom (top-right, auto-dismiss) |
| Date Picker | Native `<input type="datetime-local">` |

---

## Routes & Navbar

| Nav Item | Route | Purpose |
|---|---|---|
| Explore | `/explore` | All events from Factory |
| My Tickets | `/my-tickets` | User's NFTs + QR generator + "Sell" → links to marketplace |
| Organizer | `/dashboard` | Event Builder, monitoring, withdraw, scanner, time controls |
| Docs | `/docs` | Hackathon submission page |
| Get Started | `/get-started` | Faucet (MockUSDG), Verify (MockHumanVerifier), network info |

**Navbar**: 5 items, always visible. "Organizer" shows meaningful content only if wallet = event organizer.

---

## Page Specifications

### 1. `/explore` — Event Catalog
- Read `getDeployedEvents()` from Factory
- For each event: `organizer()`, `eventMetadataURI` (IPFS), `getState()`
- Display: flyer, name, date, location, status badge (Sale Open / Live / Ended)
- Click → `/event/:address`

### 2. `/event/:address` — Event Detail (Tabs: **Buy** | **Marketplace**)
**Buy Tab**:
- Fetch tiers via `getTiers()`, group by category (Phase × Category matrix)
- Show: price, quota, minted, sale window (startTime/endTime)
- Directed mint: multi-recipient (max 5), all must be verified + no ticket yet
- 2-step: `approve` USDG → `mint(tierIndex, recipients[])`
- Disable if: outside window, quota full, user unverified

**Marketplace Tab**:
- Iterate listings via `listings` mapping (tokenIds from tier minted counts)
- Show: seller, price, maxResalePrice, category, phase
- **List**: owner calls `listTicket(tokenId, price ≤ maxResalePrice)`
- **Buy**: 2-step `approve` → `buyTicket(tokenId)` (buyer verified, no ticket)
- **Cancel**: seller calls `cancelListing(tokenId)`
- After `eventStartTime`: UI visible but disabled with "Marketplace closed"

### 3. `/my-tickets` — User Inventory
- Find all events user owns tickets for (scan Factory events → `balanceOf`)
- Per ticket: event name, category, phase, tokenId, QR code
- **QR Generator**: EIP-191 `personal_sign` payload = `ContractAddress|TokenID|Timestamp|ChainId`
- **Sell Button** per ticket → navigates to `/event/:address#marketplace` with tokenId pre-selected
- **Verify Me** button → calls `MockHumanVerifier.verifyMe()`

### 4. `/dashboard` — Organizer Dashboard (Most Complex)

**Section A: Event Builder (Draft → Publish)**
- Drafts stored in `localStorage` key `chara:drafts` (array, multiple drafts)
- Step 1: Create Event modal — name, description, location, flyer (local preview), schedule (per day: date + start/end time)
- Step 2: Add Phase modal — name, start date, end date → convert to timestamps (00:00:00 / 23:59:59)
- Step 3: Add Category modal — name, description (optional), image upload (local preview)
- Step 4: Matrix Grid (Phase × Category) — each cell: price + quota inputs
  - Live counter: "X/20 tiers" — block add if would exceed MAX_TIERS (20)
  - Empty cells: warning border; all cells required before Publish
- Step 5: Publish
  - Upload flyer + category images to Pinata → get `ipfs://CID`
  - Build `TicketTierInput[]` from grid (replicate category metadataURI across tiers)
  - `simulateContract(createEvent)` → send tx
  - On success: read `EventCreated` log, clear draft, add to "My Events"

**Section B: My Events (Published)**
- Read `deployedEvents` from Factory, filter `organizer() == wallet`
- Per event: 4 counters (primaryPool, secondaryPool, primaryRevenue, secondaryRevenue)
- **Withdraw Funds** → `withdrawFunds()` (show allowable amount preview)
- **Demo Time Controls**:
  - "Jump to Running" → `advanceTime(seconds to eventStartTime)`
  - "Jump to End" → `advanceTime(seconds to eventEndTime)`

**Section C: Gate Scanner** (integrated in dashboard)
- Camera scan via `html5-qrcode`
- **Fallback**: file upload (QR image) + manual payload input
- Verify: recover signer from signature, check `ownerOf(tokenId) == signer`
- Timestamp freshness: ±3 min from raw RPC `block.timestamp` (NOT `_now()`)
- Event state: must be `EventRunning` via contract `getState()` (uses `_now()`)
- Log to localStorage: `tokenId, holderAddress, scannedAt, status, eventAddress`
- Export CSV button

### 5. `/docs` — Static Page
Content from PRD Section 5.4:
- Overview, Tech Stack, Deployed Contracts (with explorer links), Get Started, Key Concepts, Known Limitations, Links

### 6. `/get-started` — Onboarding
- Network info: chain ID, RPC, explorer
- **MockUSDG Faucet**: "Claim 1,000 mUSDG" → calls `MockUSDG.faucet()` via Viem
- **MockHumanVerifier**: "Verify Me" → calls `verifyMe()` via Viem
- Wallet status: address, verification status, USDG balance

---

## Core Hooks (`src/hooks/`)
| Hook | Purpose |
|---|---|
| `useContractRead` | Generic read with TanStack Query caching |
| `useContractWrite` | 2-step tx (approve → write) with toast feedback |
| `useEventData(address)` | Tiers, state, pools, revenue from EventTicket |
| `useUserTickets()` | User's tickets across all events |
| `useFactoryEvents()` | All events + organizer filter |
| `useEventDrafts()` | localStorage CRUD for drafts |
| `useToast()` | Custom toast system |

---

## Utilities (`src/utils/`)
| File | Purpose |
|---|---|
| `pinata.js` | Upload file → return `ipfs://CID` |
| `qr.js` | Generate EIP-191 payload, verify signature |
| `formatters.js` | `formatUSDG` (6 decimals), `formatTime`, `shortAddress` |
| `viemHelpers.js` | `simulateContract`, `waitForTransactionReceipt` wrappers |

---

## Components (`src/components/`)
```
ui/           # Button, Input, Modal, Badge, Card, Toast, Tabs
layout/       # Navbar, Footer, PageWrapper
event/        # EventCard, TierMatrix, TierCell
ticket/       # TicketCard, QRCodeDisplay
dashboard/    # EventBuilder, RevenuePanel, TimeControls, Scanner
marketplace/  # ListingCard, ListForm, BuyForm, CancelButton
```

---

## Contract ABIs
Extract from `docs/abi/*.json` → `src/contracts/abis/`:
- `TicketFactory.json`
- `EventTicket.json`
- `MockUSDG.json`
- `MockHumanVerifier.json`

---

## Testing Strategy
| Layer | Tool | Coverage |
|---|---|---|
| Unit | Vitest | Formatters, QR payload, Pinata helpers, draft storage |
| Hooks | Vitest + RTL | `useEventData`, `useUserTickets`, `useEventDrafts` (mock Viem) |
| Integration | Vitest + RTL | Mint → List → Buy → Scan flow (mock contracts) |
| E2E | Manual | Full testnet run with real wallet |

Run: `npm test`

---

## Build Order
1. **Config + Providers** (`main.jsx`, chains, contracts, constants)
2. **Core Hooks + Utils**
3. **UI Components** (ugly but functional)
4. **Pages** (wired to hooks)
5. **Tests**
6. **Lint + Build** (`npm run lint` → `npm run build`)

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Wallet | Privy (embedded + external) | No MetaMask required for hackathon judges |
| Faucet | Direct Viem call | Robinhood explorer unreliable |
| Date picker | Native `<input type="datetime-local">` | Zero deps, core logic first |
| Marketplace access | Both `/event/:address` tabs + `/my-tickets` "Sell" nav | User convenience |
| Scanner fallback | File upload + manual input | Desktop without camera |
| Draft storage | `localStorage` key `chara:drafts` | Simple, no backend |
| Toast | Custom, top-right | No extra deps |
| IPFS upload | At Publish only (not draft) | Per PRD, single source of truth |
| 2-step tx | `approve` → `mint`/`buyTicket` | USDG is ERC-20, requires allowance |

---

## Out of Scope (Roadmap)
- Dark mode
- React Day Picker upgrade
- Indexer for `/explore` pagination
- Real USDG (Paxos) / Gitcoin Passport / World ID
- Multi-gate scanner sync
- `cancelEvent()` + refund
- Configurable fees

---

## Acceptance Criteria (MVP)
- [ ] Connect wallet (Privy embedded + external)
- [ ] Claim MockUSDG faucet from `/get-started`
- [ ] Verify via MockHumanVerifier
- [ ] Create event draft → Publish → appears on `/explore`
- [ ] Buy tickets (directed mint, max 5 recipients)
- [ ] List ticket on marketplace (price ≤ maxResalePrice)
- [ ] Buy from marketplace
- [ ] Cancel listing
- [ ] Withdraw funds (with holdback logic)
- [ ] Demo time controls (Jump to Running/End)
- [ ] Generate QR for ticket
- [ ] Scan QR at gate (camera + fallback)
- [ ] Export scanner logs to CSV
- [ ] All routes accessible, no console errors
- [ ] `npm run lint` passes, `npm run build` succeeds

---

## Next Step
Approve this plan → switch to **build mode** → implement in order above.