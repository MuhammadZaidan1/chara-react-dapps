# TECHNICAL PRD v2.1: RWA SMART TICKET (ARBITRUM / ROBINHOOD CHAIN MVP)

> **Status:** Draft v2.1 — hasil diskusi revisi lanjutan dari v2. Menggantikan v2 sepenuhnya.
> **Konteks:** Hackathon dengan deadline ketat. Semua fitur ditandai **[MVP]** atau **[ROADMAP]**.
> **Ringkasan perubahan dari v2:** lihat laporan changelog terpisah (di luar file ini).

## 1. System Overview & Tech Stack

### 1.1 Technical Objective
Membangun arsitektur smart ticketing terdesentralisasi 100% on-chain (tanpa database backend Web2 untuk data final) yang berfokus pada:
- Pencegahan calo lewat **price-cap on-chain**.
- Pelarangan transfer P2P bebas (hanya lewat marketplace internal).
- **Directed Minting** (tiket langsung didistribusikan ke wallet penerima).
- **Holdback dana EO** (trust layer) sampai acara selesai.
- Validasi tiket di gerbang secara off-chain berbasis kriptografi.

### 1.2 Core Infrastructure

| Layer | Teknologi |
|---|---|
| Smart Contract | Foundry (Solidity), **OpenZeppelin v5** |
| Frontend | React (Vite) + React Router + Tailwind CSS |
| Web3 Client | Viem + Web3Modal + Privy (wallet) |
| Storage | IPFS via Pinata API (upload hanya saat Publish, lihat 6.2) |
| Network (MVP) | **Robinhood Chain Testnet** — chain ID `46630`, explorer `https://explorer.testnet.chain.robinhood.com` |
| Currency | **MockUSDG** (ERC-20 buatan sendiri, desimal 6, `faucet()` publik — diambil langsung lewat block explorer "Write Contract", bukan tombol di app); token Paxos USDG asli = roadmap |
| QR Scanner | html5-qrcode, terintegrasi di dalam `/dashboard` EO (bukan route publik terpisah) |
| Human Verification | `IHumanVerifier`; MVP: `MockHumanVerifier` dengan `verifyMe()` self-service |

---

## 2. Terminologi (Category, Phase, Tier)

Biar konsisten di kontrak, kode, dan UI:

| Istilah | Artinya | Contoh |
|---|---|---|
| **Category** | Jenis/kelas tiket (fasilitas) | VVIP, VIP, Reguler |
| **Phase** | Kapan tiket boleh dibeli (window jual) | Early Bird, Presale, Normal |
| **Tier** | Satu kombinasi spesifik Category × Phase — 1 baris `TicketTier` di kontrak | "VIP Presale", "Reguler Normal" |

Total tier = jumlah phase × jumlah category. Satu NFT tiket (`tokenId`) selalu nempel ke satu tier lewat `ticketToTier[tokenId]`.

**Penamaan waktu (biar gak ketuker):**
- `eventStartTime` / `eventEndTime` — level event, dua timestamp global yang mengatur seluruh siklus hidup kontrak.
- Phase (`tier.startTime` / `tier.endTime`) — level phase, window jual, beda-beda per phase, dipakai bersama oleh semua category dalam phase itu.

---

## 3. Smart Contract Architecture (Foundry)

### 3.1 Factory-Event Pattern
- **`TicketFactory.sol`**: kontrak master platform. Menyimpan `platformTreasury`, array `deployedEvents`, konstanta fee, dan **alamat `MockUSDG` + `MockHumanVerifier` yang dideploy sekali** lalu diteruskan ke tiap `EventTicket` baru. Men-deploy `EventTicket` dalam satu transaksi beserta seluruh tier-nya.
- **`EventTicket.sol`**: kontrak child (ERC-721 OpenZeppelin v5, dimodifikasi) milik EO. Logika penjualan, price-cap, marketplace, holdback, dan demo time-control.
- **`MockUSDG.sol`**: ERC-20 6 desimal, `faucet()` publik, **satu instance dipakai semua event** (bukan per-event).
- **`IHumanVerifier.sol`** + **`MockHumanVerifier.sol`**: `isVerified(address)`, `verifyMe()` self-service. **Satu instance dipakai semua event** — verifikasi sekali berlaku selamanya di semua event.

> **Perubahan dari v2:** v2 tidak eksplisit soal shared vs per-event instance. Diputuskan: shared, supaya user tidak perlu verifikasi ulang / faucet ulang tiap ganti event saat demo.

### 3.2 Konstanta Protokol

| Konstanta | Nilai | Keterangan |
|---|---|---|
| `PRIMARY_FEE_BPS` | 200 (2%) | Dipotong dari harga tiket, ditanggung EO |
| `SECONDARY_PLATFORM_BPS` | 400 (4%) | Dipotong dari harga jual sekunder |
| `SECONDARY_EO_ROYALTY_BPS` | 600 (6%) | Masuk `secondaryPool` |
| `HOLDBACK_BPS` | 2000 (20%) | Dana tertahan sampai `eventEndTime` |
| `MAX_BATCH_MINT` | 5 | Batas panjang array `_recipients` |
| `MAX_TIERS` | 20 | Batas jumlah tier (Category × Phase) per event |
| `RESALE_CAP_MULTIPLIER` | 2 | `maxResalePrice` = 2× harga tertinggi per kategori |

> **Kenapa `MAX_TIERS` = 20:** ini bukan batas skala event (jumlah penonton bisa berapa pun lewat `maxQuota` tiap tier), tapi batas gas constructor — tiap tier menulis storage baru dalam satu transaksi `createEvent()`. Kelewat batas ini berisiko transaksi gagal karena block gas limit. UI **wajib** menampilkan counter real-time "X/20 tier" dan mencegah EO menambah phase/category baru begitu itu akan melewati 20 — jangan biarkan gagal baru ketahuan pas Publish (setelah upload IPFS selesai).

### 3.3 Data Structures

```solidity
struct TicketTier {
    string category;
    string phase;
    uint256 price;
    uint256 maxResalePrice; // dihitung kontrak di constructor
    uint256 maxQuota;
    uint256 minted;
    uint256 startTime;      // window jual phase ini
    uint256 endTime;
    string metadataURI;     // ipfs://CID — sama untuk semua tier 1 kategori
}

struct Listing {
    address seller;
    uint256 price;
}

TicketTier[] public tiers;
mapping(uint256 => uint256) public ticketToTier;
mapping(uint256 => Listing) public listings;

address public immutable organizer;       // msg.sender saat createEvent
uint256 public immutable eventStartTime;
uint256 public immutable eventEndTime;
string  public eventMetadataURI;

// Pool = saldo yang masih ada di kontrak (berkurang saat withdraw)
uint256 public primaryPool;
uint256 public secondaryPool;

// Revenue = akumulasi yang PERNAH masuk (hanya naik, tidak pernah berkurang)
uint256 public primaryRevenue;
uint256 public secondaryRevenue;

// [DEMO ONLY — hapus/nolkan permanen untuk production]
uint256 public demoTimeOffset;
```

> **Perubahan dari v2:** `totalCredited`/`totalWithdrawn` gabungan diganti jadi 4 counter terpisah (`primaryPool`, `secondaryPool`, `primaryRevenue`, `secondaryRevenue`) supaya dashboard EO bisa selalu menunjukkan breakdown "berapa dari tiket, berapa dari resale" meski sudah ada penarikan dana. `demoTimeOffset` baru, lihat 3.6.

### 3.4 Time-Lock State Management
Status ditentukan dari `_now()` (bukan langsung `block.timestamp`, lihat 3.6):

```solidity
function _now() internal view returns (uint256) {
    return block.timestamp + demoTimeOffset;
}
```

| State | Kondisi | Minting | Marketplace | Transfer | Scanner | Withdraw EO |
|---|---|---|---|---|---|---|
| **Sale / Open** | `t < eventStartTime` | Bila dalam window tier | Aktif | Hanya via `buyTicket()` | Nonaktif | Maks. 80% |
| **Event Running** | `eventStartTime <= t <= eventEndTime` | Mati | **Mati** | Mati | **Aktif** | Maks. 80% |
| **Soulbound (End)** | `t > eventEndTime` | Mati | Mati | **Lumpuh permanen** | Nonaktif | **100%** |

### 3.5 Aturan Constructor (Validasi On-Chain)
Constructor `EventTicket` wajib `revert` jika:
- `tiers.length == 0` atau `tiers.length > MAX_TIERS`.
- `category`, `phase`, atau `metadataURI` kosong pada tier mana pun.
- `price == 0` atau `maxQuota == 0` pada tier mana pun.
- `startTime >= endTime` pada tier mana pun.
- `endTime > eventStartTime` pada tier mana pun.
- `eventStartTime >= eventEndTime`.
- Waktu-waktu tersebut sudah lewat saat deploy.

`maxResalePrice` dihitung di constructor: untuk tiap kategori, cari harga **tertinggi** di antara semua tier kategori itu (lintas phase apa pun) lalu kalikan `RESALE_CAP_MULTIPLIER`. **Ini bukan berdasarkan nama phase tertentu** (misal "Normal") — nama phase bebas teks, jadi kontrak tidak bisa dan tidak perlu tahu phase mana yang "baseline". Semua tier dalam kategori yang sama mendapat `maxResalePrice` yang sama.

### 3.6 Demo Time Control [DEMO ONLY]
Karena testnet tidak bisa dipercepat, tiap `EventTicket` punya offset waktu sendiri (bukan kontrak `MockClock` bersama — supaya majuin waktu di Event A tidak ikut memajukan Event B):

```solidity
// [DEMO ONLY — hapus fungsi ini & pakai block.timestamp langsung untuk production]
function advanceTime(uint256 secondsToAdd) external onlyOrganizer {
    demoTimeOffset += secondsToAdd;
}
```

Dipanggil dari tombol "Jump to Running" / "Jump to End" di event box dashboard EO. Hanya `organizer` event itu yang bisa memanggil. Waktu cuma bisa maju (tidak ada cara mundur) — untuk mengulang demo, deploy event baru.

> **Penting — ini bukan penyimpangan dari `block.timestamp`:** `demoTimeOffset` defaultnya **selalu 0** sejak deploy. Selama organizer tidak pernah memanggil `advanceTime()`, `_now()` **identik** dengan `block.timestamp` asli — tidak ada bedanya sama sekali secara fungsional maupun keamanan. Fungsi ini cuma "kenop tambahan" yang nganggur (no-op) kecuali sengaja dipakai untuk demo. Untuk versi production, fungsi `advanceTime()` dan variabel `demoTimeOffset` dihapus total dari kode, dan `_now()` diganti langsung jadi `block.timestamp` di semua tempat.
>
> **Kenapa bukan "tetap pakai `block.timestamp` mentah + fungsi bypass terpisah":** alternatif itu sempat dipertimbangkan (misal `bool forcedState` yang organizer set buat maksa kontrak dianggap "Running"), tapi gak cukup — kontrak ini punya banyak window waktu granular (tiap phase punya `startTime`/`endTime` sendiri, bukan cuma 3 state event besar), dan mint harus tetap bisa dites per-phase (Early Bird dulu, baru Presale, baru Normal). "Maksa satu state" gak bisa mensimulasikan progres antar-phase itu. `demoTimeOffset` menggeser satu clock tunggal yang dipakai konsisten di semua perhitungan waktu (state event global maupun window tiap phase), jadi EO bisa "lompat" natural melewati tiap phase sesuai window asli yang dia input sendiri, tanpa butuh bypass terpisah untuk tiap lapisan logic.
>
> **Konsekuensi buat scanner (Bagian 7):** validasi kesegaran QR (selisih ±3 menit) tetap pakai `block.timestamp` **mentah** dari RPC (tidak melewati `_now()`), karena itu soal "berapa lama sejak QR dibuat", bukan soal state event. Tapi pengecekan **state** ("apakah event sedang Running") wajib manggil fungsi baca kontrak yang pakai `_now()`, bukan dihitung sendiri di frontend dari `block.timestamp` mentah — kalau dihitung sendiri, saat demo lagi pakai offset, frontend dan kontrak bisa beda pendapat soal state yang sedang berlaku.

### 3.7 Core Functions

#### `createEvent(...)` (di Factory)
Menerima metadata event, `eventStartTime`, `eventEndTime`, dan array `TicketTier[]` lengkap. Deploy `EventTicket` + isi semua tier dalam **satu transaksi**. Emit `EventCreated(address indexed eventContract, address indexed organizer)`.

#### `mint(uint256 _tierIndex, address[] calldata _recipients)`
- `require(_recipients.length > 0 && _recipients.length <= MAX_BATCH_MINT)`.
- `require(_now() >= tier.startTime && _now() <= tier.endTime)`.
- `require(tier.minted + _recipients.length <= tier.maxQuota)`.
- Untuk tiap recipient: `balanceOf(recipient) == 0` (satu wallet satu tiket, lintas kategori & phase), dan `humanVerifier.isVerified(recipient)`. Pembeli (`msg.sender`) juga wajib `isVerified`.
- Bayar `tier.price × _recipients.length`. Fee 2% → `platformTreasury` (push). Sisa → `primaryPool += net`, `primaryRevenue += net`.

#### `listTicket(uint256 _tokenId, uint256 _price)`
- `require(ownerOf(_tokenId) == msg.sender)`, `require(_now() < eventStartTime)`.
- `require(_price > 0 && _price <= tiers[ticketToTier[_tokenId]].maxResalePrice)`.
- Simpan `Listing`. **Tidak** pakai `approve` (karena `approve` dimatikan) — NFT tetap di wallet penjual sampai benar-benar terjual.
- Trigger di UI: tombol "Sell" di `/my-tickets` (tiket sendiri) atau di tab Marketplace event (otomatis pilih tiket sendiri karena max 1/wallet).

#### `cancelListing(uint256 _tokenId)` **[MVP — dipastikan masuk, bukan lagi usulan]**
- Hanya seller. Hapus listing. Untuk ganti harga: cancel lalu list ulang.

#### `buyTicket(uint256 _tokenId)`
- `require(_now() < eventStartTime)`, listing valid, `balanceOf(msg.sender) == 0`, pembeli `isVerified`.
- 2 langkah: `approve()` USDG lalu `buyTicket()`.
- Distribusi: 4% platform (push), 6% EO royalty → `secondaryPool += royalty`, `secondaryRevenue += royalty`; sisanya (90% + dust) → seller (push).
- Hapus listing dulu (checks-effects-interactions), lalu pindahkan NFT lewat **`_transfer` internal** (bukan lewat fungsi publik — lihat 3.8).

#### `withdrawFunds()` (Pull Pattern + Holdback, per pool)
`onlyOrganizer`, `nonReentrant`. Dihitung terpisah untuk `primary` dan `secondary`:
- Sebelum/pada `eventEndTime`: `allowed = xPool - (xRevenue × HOLDBACK_BPS / 10000)`.
- Setelah `eventEndTime`: `allowed = xPool` (100%, semua sisa).
- Update `xPool -= allowed` sebelum transfer (CEI). Withdraw menarik dari kedua pool sekaligus dalam satu pemanggilan.

### 3.8 Transfer Restriction (OpenZeppelin v5) — **diganti dari v2**

> **Perubahan dari v2:** v2 memakai flag `_marketplaceTransfer` yang di-set lalu di-reset manual dalam `buyTicket()`. Diganti dengan pendekatan yang lebih aman (tidak ada flag yang bisa lupa direset):

```solidity
function _update(address to, uint256 tokenId, address auth)
    internal override returns (address)
{
    address from = _ownerOf(tokenId);
    bool isMint = (from == address(0));
    require(isMint || _now() < eventStartTime, "Transfer disabled");
    return super._update(to, tokenId, auth);
}

// Semua pintu transfer publik ditutup permanen:
function transferFrom(address, address, uint256) public pure override {
    revert("Transfers disabled: use marketplace");
}
function approve(address, uint256) public pure override {
    revert("Approvals disabled");
}
function setApprovalForAll(address, bool) public pure override {
    revert("Approvals disabled");
}
```

- `transferFrom` selalu revert → otomatis menutup kedua overload `safeTransferFrom` (di OZ v5 keduanya memanggil `transferFrom`).
- `buyTicket()` memindahkan NFT lewat fungsi **internal** `_transfer` (bukan `transferFrom` publik), sehingga tidak melewati pintu yang sudah ditutup, tapi tetap lewat `_update` untuk validasi state.
- Tidak ada flag yang perlu di-set/reset — lebih pendek dan tidak ada risiko lupa reset.
- Setelah `eventEndTime`: tidak ada jalur transfer sama sekali (soulbound permanen), karena kondisi `_now() < eventStartTime` di `_update` sudah pasti false.

### 3.9 Human Verification (Anti-Sybil) [MVP: mock]
- Dicek pada pembeli & seluruh penerima `mint()`, serta pembeli `buyTicket()`.
- `MockHumanVerifier`: `verifyMe()` self-service, dipanggil sendiri oleh tiap wallet dari tombol "Verify (Demo)" di navbar/profil. Bukan whitelist manual, bukan UI ala KYC provider.
- Klaim publik: "menambah friksi dan mendukung verifikasi identitas", bukan "mematikan penimbunan 100%".
- ROADMAP: adapter Gitcoin Passport / World ID.

---

## 4. Metadata JSON Architecture (IPFS)

Upload ke Pinata **hanya terjadi saat Publish** (lihat 6.2), tidak saat draft. Semua data harga/kuota/waktu dibaca langsung dari kontrak oleh frontend, **tidak** disimpan di JSON — supaya tidak ada dua sumber kebenaran yang bisa tidak sinkron.

### 4.1 Level 1: Event Metadata (`eventMetadataURI`)

```json
{
  "name": "Colosseum Web3 Festival",
  "description": "Festival musik blockchain terbesar tahun ini.",
  "location": "GBK Senayan, Jakarta",
  "image": "ipfs://CID_FLYER_UTAMA",
  "schedule": [
    { "day": 1, "date": "2026-11-20", "startTime": "14:00", "endTime": "23:00" },
    { "day": 2, "date": "2026-11-21", "startTime": "14:00", "endTime": "23:00" },
    { "day": 3, "date": "2026-11-22", "startTime": "14:00", "endTime": "23:00" }
  ]
}
```
> **Perubahan dari v2:** field `location` (baru) dan `schedule` (array terstruktur, menggantikan string `event_dates` tunggal). `eventStartTime` on-chain = tanggal+jam mulai Day 1; `eventEndTime` on-chain = tanggal+jam selesai hari terakhir di `schedule`.

### 4.2 Level 2: Ticket Metadata — per Category (bukan per tier)

```json
{
  "name": "VIP Pass - Colosseum Web3 Festival",
  "description": "Akses penuh area VIP selama festival berlangsung.",
  "image": "ipfs://CID_DESAIN_TIKET_VIP",
  "attributes": [
    { "trait_type": "Category", "value": "VIP" },
    { "trait_type": "Event", "value": "Colosseum Web3 Festival" }
  ]
}
```
- `name` = auto-generate `"{category} Pass - {nama event}"`, EO tidak perlu ketik ulang.
- `description` = opsional, diisi di modal Add Category; kalau kosong, default `"Tiket kategori {category} untuk {nama event}."`.
- Semua tier dengan kategori sama merujuk `metadataURI` yang **persis sama** (dedup) — hemat storage, tapi konsekuensinya **info phase (Early Bird/Presale/Normal) tidak muncul di NFT viewer**, hanya bisa dilihat lewat aplikasi sendiri (baca `tiers[ticketToTier[tokenId]].phase` on-chain). Ini trade-off yang disengaja.

### 4.3 Catatan: `tokenId` vs CID
`tokenId` adalah counter angka biasa (1, 2, 3, …) yang naik tiap `mint()`, **tidak ada hubungannya dengan CID IPFS**. Alurnya: `tokenId → ticketToTier[tokenId] → tiers[i].metadataURI (CID)`. `tokenURI(tokenId)` mengembalikan CID itu; `tokenId` sendiri tidak muncul di dalam isi JSON.

---

## 5. Frontend Architecture (Vite + React)

### 5.1 Routing

| Route | Fungsi |
|---|---|
| `/explore` | Katalog semua event (baca `deployedEvents` dari Factory). Tanpa pagination di MVP. |
| `/event/:contractAddress` | Tab **Buy** (primary mint) dan **Marketplace** (resale) — per event, bukan global |
| `/my-tickets` | Inventaris NFT, generator QR |
| `/dashboard` | Event Builder (draft→publish), monitoring, withdraw, **dan scanner gerbang** |
| `/docs` | Info platform untuk juri/tester (lihat 5.4) |

> **Perubahan dari v2:** `/scanner/:contractAddress` sebagai route publik terpisah **dihapus**; scanner sekarang terintegrasi di dalam `/dashboard` (device/wallet yang sama dengan EO). `/explore` tidak lagi mengarah ke marketplace global — marketplace selalu dalam konteks satu event.

### 5.2 EO Dashboard — Event Builder (Draft → Publish)

**Prinsip dasar:** dari "Create Event" sampai "Publish", **tidak ada transaksi on-chain sama sekali**. Semua tersimpan sebagai draft di localStorage (array, bukan slot tunggal — supaya bisa lebih dari satu draft event tanpa saling timpa). Kontrak baru benar-benar dideploy saat tombol **Publish** ditekan.

**Langkah 1 — Create Event (modal):**
Input: nama, deskripsi, **lokasi** (baru), gambar flyer (preview lokal, belum upload), jadwal per hari (Day 1, Day 2, … masing-masing: tanggal + jam mulai + jam selesai). `eventStartTime` diambil dari jam mulai Day 1, `eventEndTime` dari jam selesai hari terakhir. Setelah confirm, box event muncul di dashboard, ticketing (phase & category) masih kosong.

**Langkah 2 — Add Phase (modal, dipanggil berulang):**
Input: nama phase (teks bebas), tanggal mulai, tanggal akhir (day-only, tanpa jam — dikonversi ke `00:00:00` untuk start dan `23:59:59` untuk end saat dirakit jadi timestamp). Setelah confirm, muncul box phase baru berisi grid kolom = category yang sudah ada (kosong, kalau belum ada category maka grid belum muncul).

**Langkah 3 — Add Category (modal):**
Input: nama category, deskripsi (opsional), upload gambar (jadi asset NFT kategori itu). Setelah confirm:
- Muncul kolom baru di **semua** box phase yang sudah ada (kosong, wajib diisi).
- Muncul **category box** terpisah (di bawah kumpulan phase box) berisi preview gambar + `maxResalePrice` (read-only, dihitung otomatis, update live tiap harga di kategori itu berubah).

**Langkah 4 — Isi Grid:**
Tiap sel (1 phase × 1 category) berisi 2 input: **harga** dan **kuota**. Tidak boleh ada sel kosong — begitu phase/category baru ditambah, sel-sel barunya wajib diisi sebelum bisa Publish. Counter "X/20 tier" ditampilkan live; menambah phase/category yang akan melewati `MAX_TIERS` diblokir dengan pesan jelas.

**Edit/Hapus pre-publish:** phase, category, dan isi grid bebas diedit/dihapus selama masih draft (murni state lokal, tidak ada konsekuensi on-chain).

**Langkah 5 — Publish:**
1. Modal peringatan: "Setelah dipublish, semua data (harga, kuota, waktu) terkunci permanen dan tidak bisa diubah." Minta konfirmasi eksplisit.
2. Upload ke Pinata: flyer event + gambar tiap category (baru sekarang, bukan saat draft).
3. Rakit array `TicketTier[]` dari grid (tiap sel jadi satu tier; `metadataURI` kategori direplikasi ke semua tier kategori itu).
4. `simulateContract(createEvent)` → kirim **satu transaksi**.
5. Baca alamat event baru dari log `EventCreated`.
6. Bila upload sukses tapi transaksi gagal: draft tetap ada, pin IPFS yatim tidak berbahaya, EO bisa coba Publish lagi.

**Setelah Publish**, box event menjadi read-only untuk data tier (sesuai immutability kontrak), tapi tetap menampilkan:
- 4 counter: `primaryPool`, `secondaryPool`, `primaryRevenue`, `secondaryRevenue`.
- Tombol "Withdraw Funds".
- Tombol kontrol waktu demo: "Jump to Running" / "Jump to End" (memanggil `advanceTime()`).

**Daftar event di dashboard:** baca `deployedEvents` dari Factory, panggil `organizer()` tiap alamat, filter yang cocok dengan wallet yang sedang connect. Tidak perlu indexer untuk MVP (jumlah event kecil).

### 5.3 Marketplace UX
- **Scope per-event**, bukan global — tidak ada halaman "marketplace semua event". `/explore` mengarah ke event, tab Marketplace ada di dalam tiap halaman event.
- Setelah `eventStartTime`: nav tab Marketplace tetap kelihatan, tapi isinya pesan "Marketplace closed — event started" (bukan disembunyikan).
- User yang sudah punya tiket event itu tetap bisa **melihat** marketplace (misal cek harga pasar atau mau jual tiketnya sendiri), tapi tombol Buy di-disable dengan label "You already own a ticket for this event" (kontrak juga akan revert sebagai fallback kalau somehow tetap dicoba).
- Input harga listing dibatasi maksimum `maxResalePrice`; submit nonaktif bila melebihi.

### 5.4 Docs Page (`/docs`)
Konten (satu halaman statis, dipakai ulang juga jadi draft README GitHub, dalam Bahasa Inggris untuk submission):
1. **Overview** — masalah yang diselesaikan & cara kerja (price-cap, holdback, directed minting).
2. **Tech Stack & Network** — Robinhood Chain Testnet, chain ID 46630, link explorer.
3. **Deployed Contracts** — tabel alamat Factory / MockUSDG / MockHumanVerifier, tiap baris link ke `https://explorer.testnet.chain.robinhood.com/address/<alamat>`.
4. **Get Started (untuk juri/tester)** — connect wallet → Verify (demo) → buka MockUSDG di explorer tab Write Contract → panggil `faucet()` → kembali ke app, coba beli/jual/scan.
5. **Konsep Kunci** — penjelasan singkat holdback, soulbound, price-cap.
6. **Known Limitations (MVP)** — satu scanner device, tanpa refund otomatis, verifier & USDG masih mock.
7. **Links** — repo GitHub, kontak tim.

### 5.5 Web3 Hooks (Viem) & 2-Step Transaction
Tidak berubah dari v2: semua read/write pakai Viem; transaksi finansial 2 langkah (`approve()` lalu `mint()`/`buyTicket()`).

---

## 6. Technical Data Flow & Use Cases

### 6.1 End-to-End EO Journey

**Fase 1: Drafting (localStorage, tanpa gas)**
1. EO isi Create Event, Add Phase (berkali-kali), Add Category (berkali-kali), isi grid harga+kuota. Bebas diedit/dihapus.
2. Review, lihat counter tier & preview `maxResalePrice` per kategori.

**Fase 2: Publish (satu transaksi)**
1. Upload IPFS (flyer + gambar tiap category) → rakit `TicketTier[]` → `createEvent()`.
2. Data terkunci permanen.

**Fase 3: Monitoring Sale (Sale/Open)**
1. Tier bisa dibeli publik saat dalam window phase-nya.
2. EO memantau 4 counter; `withdrawFunds()` bisa ditarik maks. 80% dari `xRevenue` sebelum `eventEndTime`.

**Fase 4: Gate Management (Event Running)**
1. Minting, listing, `buyTicket`, transfer — semua mati otomatis begitu `_now() >= eventStartTime`.
2. EO membuka scanner **di dalam `/dashboard`**, memindai QR, validasi kriptografi (Bagian 7). Data tersimpan localStorage device EO.
3. Untuk demo: EO menekan "Jump to Running" / "Jump to End" alih-alih menunggu waktu asli.

**Fase 5: Post-Event & Revenue Claim**
1. Setelah `eventEndTime`: tiket jadi soulbound permanen.
2. EO menekan "Withdraw Funds": menarik sisa 100%.
3. EO menekan "Export to CSV" dari scanner.

### 6.2 Directed Minting Flow
Tidak berubah dari v2: pembeli 3 tiket VIP, `[WalletSendiri, WalletTeman1, WalletTeman2]`, `approve` total, `mint()` — semua penerima dicek kuota, window phase, `balanceOf==0`, dan verifikasi.

### 6.3 Kebijakan Refund
Tidak berubah dari v2: tidak ada refund otomatis di MVP; 20% holdback sebagai trust layer, bukan jaminan refund; klaim jujur "20% dana dikunci on-chain sampai event selesai".

---

## 7. Off-Chain Cryptography & Gate Scanner (Zero Backend)

Tidak berubah secara kriptografi dari v2 (EIP-191 `personal_sign`, payload `ContractAddress|TokenID|Timestamp|ChainId`, Base64, cek waktu ±3 menit dua arah termasuk QR dari masa depan, validasi kepemilikan via `ownerOf`, validasi state Running). **Perubahan:** scanner sekarang halaman di dalam `/dashboard`, bukan route publik `/scanner/:contractAddress` — jadi hanya wallet/device organizer yang bisa mengaksesnya, konsisten dengan batasan "satu device" yang sudah diterima di MVP.

---

## 8. Security Protocols & Technical Constraints

- **ReentrancyGuard** pada `withdrawFunds()`, `mint()`, `buyTicket()`.
- **Checks-Effects-Interactions** di semua fungsi finansial.
- **SafeERC20** untuk seluruh interaksi USDG.
- **Pembulatan:** dust masuk ke pihak terakhir (seller di sekunder, `primaryPool` di primer).
- **Blokir venue eksternal:** `transferFrom`/`approve`/`setApprovalForAll` selalu revert (lihat 3.8, diganti dari flag `_marketplaceTransfer` di v2).
- **Batas array & tier**: `MAX_BATCH_MINT`, `MAX_TIERS`, dengan live counter di UI (lihat 3.2).
- `demoTimeOffset` ditandai eksplisit `[DEMO ONLY]` di kode, wajib dihapus/dinolkan untuk versi production.

---

## 9. Scope MVP vs Roadmap

| Fitur | Status |
|---|---|
| Factory + EventTicket, shared MockUSDG & MockHumanVerifier, 1 transaksi `createEvent` | **MVP** |
| Time-lock 3 state (`_now()`-based) | **MVP** |
| Price-cap on-chain (Opsi B: harga tertinggi per kategori) | **MVP** |
| Fee primer 2%, sekunder 4%/6% | **MVP** |
| Holdback 20%, akuntansi 4-counter (pool + revenue per jenis) | **MVP** |
| Directed Minting (maks. 5) + 1 wallet 1 tiket per event | **MVP** |
| Transfer lock via `transferFrom`/`approve` revert + `_update` | **MVP** |
| `cancelListing()` | **MVP** (dipastikan, bukan lagi usulan) |
| `MockUSDG` + faucet lewat explorer | **MVP** |
| `IHumanVerifier` + `verifyMe()` self-service | **MVP** |
| `demoTimeOffset` per-event + tombol Jump to Running/End | **MVP** |
| EO Dashboard: Event Builder (draft/publish, Matrix Builder Phase×Category) | **MVP** |
| Scanner terintegrasi di `/dashboard` | **MVP** |
| Docs page (`/docs`) | **MVP** |
| QR EIP-191 + scanner satu perangkat | **MVP** |
| Gitcoin Passport / World ID asli | ROADMAP |
| Token Paxos USDG asli | ROADMAP |
| `cancelEvent()` + refund | ROADMAP |
| Fee configurable | ROADMAP |
| Multi-gerbang + sinkronisasi | ROADMAP |
| Indexer untuk `/explore` | ROADMAP |
| Binary packing QR | ROADMAP (bila perlu) |

---

## 10. Open Items yang Masih Perlu Diverifikasi

1. **Gas testing `MAX_TIERS`/`MAX_BATCH_MINT`:** belum diuji langsung di Robinhood Testnet. Wajib deploy event dengan tier mendekati 20 sebelum hari-H demo, pastikan tidak kena block gas limit.
2. **Desimal USDG asli Paxos:** tetap dipastikan 6 sebelum migrasi dari `MockUSDG` (relevan untuk roadmap pasca-hackathon, bukan blocker MVP).
3. **Ketersediaan Gitcoin Passport / World ID** di Robinhood Chain testnet — roadmap, tidak menghalangi MVP.

---

*(Changelog lengkap v2 → v2.1 disediakan terpisah, di luar file ini.)*
