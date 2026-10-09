# Laporan Finishing Smart Ticket MVP

**Tanggal:** 30 September 2026  
**Network:** Robinhood Chain Testnet  
**Chain ID:** `46630` 
**Status:** Deployment kontrak platform berhasil. Verifikasi explorer dan smoke test pascadeploy masih perlu dilakukan.

## Ringkasan

Fase persiapan smart contract MVP telah diselesaikan: kontrak dan deployment script berhasil dikompilasi, seluruh test lulus, coverage source kontrak produksi 100%, dry-run testnet berhasil, dan tiga kontrak platform berhasil dikirim ke Robinhood Chain Testnet.

Deployment memakai satu wallet untuk deployer dan `PLATFORM_TREASURY`, sesuai konfigurasi. Factory tidak memiliki owner global; pemanggil `createEvent()` menjadi organizer untuk event yang dibuat.

## Cakupan Produk dan Revenue

Model MVP yang diimplementasikan:

- Penjualan primer: fee platform 2%; sisa revenue masuk pool EO dengan holdback 20% sampai event berakhir.
- Resale internal: fee platform 4%, royalty EO 6%, sisanya untuk seller; resale dibatasi cap per kategori.
- Marketplace dan transfer NFT dikunci saat event mulai.
- `MockUSDG` dan self-service `MockHumanVerifier` digunakan untuk demonstrasi testnet. Faucet MockUSDG saat ini mencetak 1.000 mUSDG per pemanggilan tanpa cooldown atau batas akumulasi.
- Holdback menunda pencairan sebagian dana EO; bukan mekanisme refund. Refund dan pembatalan event berada di roadmap.

## Pengujian dan Build

Build dilakukan dengan Solidity 0.8.24. Deployment script ikut terkompilasi melalui `forge build`.

Hasil test terakhir:

- **30 passed, 0 failed, 0 skipped**, dalam 7 suite.
- Fuzz: 256 run untuk masing-masing dari dua properti resale cap.
- Invariant: 256 run dan 128.000 handler calls; invariant kuota mint dan batas pool terhadap revenue lulus.
- Gas test lokal untuk batas 20 tier dan batch mint 5 lulus.

Coverage dengan `forge coverage --skip script --exclude-tests`:

| Contract | Lines | Statements | Branches | Functions |
|---|---:|---:|---:|---:|
| EventTicket | 100% (128/128) | 100% (203/203) | 100% (33/33) | 100% (18/18) |
| MockHumanVerifier | 100% (4/4) | 100% (3/3) | 100% (1/1) | 100% (1/1) |
| MockUSDG | 100% (5/5) | 100% (2/2) | N/A (0/0) | 100% (3/3) |
| TicketFactory | 100% (17/17) | 100% (16/16) | 100% (1/1) | 100% (4/4) |
| **Total kontrak produksi** | **100% (154/154)** | **100% (224/224)** | **100% (35/35)** | **100% (26/26)** |

Coverage menunjukkan jalur source yang terlewati oleh test, bukan jaminan bebas bug. Fork test dan validasi gas di testnet tidak dilakukan sebelum deployment.

Build menghasilkan warning lint Foundry, termasuk peringatan timestamp, external call/check di loop, dan `_mint` alih-alih `_safeMint`. Kompilasi tetap sukses; warning tersebut belum ditindaklanjuti dalam scope MVP ini.

## Environment dan Deployment Script

File `.env` lokal berisi konfigurasi runtime dan dikecualikan Git. `.env.example` menyediakan template termasuk RPC dan explorer. `.gitignore` juga mengabaikan semua `broadcast/` dan cache artifacts.

`script/Deploy.s.sol` melakukan preflight untuk chain ID Robinhood `46630`, treasury bukan zero address, dan deployer memiliki saldo native token. Script lalu deploy `MockUSDG`, `MockHumanVerifier`, dan `TicketFactory`. Dry-run dan broadcast dilakukan terpisah.

Koneksi RPC sempat gagal karena jaringan mengarahkan DNS ke block page dan kemudian gagal resolve. Setelah endpoint dapat dijangkau, dry-run testnet berhasil. Dry-run tersebut tidak mengirim transaksi; deployment aktual dicatat di bawah.

## Deployment Robinhood Testnet

Ketiga transaksi berhasil pada chain ID `46630`. Deployer dan treasury memakai address yang sama.

| Contract | Address | Block | Transaction |
|---|---|---:|---|
| MockUSDG | [`0x29e688092F42e533A69dB2dA0Df576579a5cd7f9`](https://explorer.testnet.chain.robinhood.com/address/0x29e688092F42e533A69dB2dA0Df576579a5cd7f9) | 126604695 | [`0x19c5024e2527c18e81e94a3e836671243164cd8a947a6ba5df1fd315ee98fe07`](https://explorer.testnet.chain.robinhood.com/tx/0x19c5024e2527c18e81e94a3e836671243164cd8a947a6ba5df1fd315ee98fe07) |
| MockHumanVerifier | [`0xaC3B0754697BfEB5A094B4578ba46848715C220F`](https://explorer.testnet.chain.robinhood.com/address/0xaC3B0754697BfEB5A094B4578ba46848715C220F) | 126604708 | [`0xc0b4e40f0a1ee84e6a05a31ce631051149dbab1baddc1005a63e3a11d3b2feb0`](https://explorer.testnet.chain.robinhood.com/tx/0xc0b4e40f0a1ee84e6a05a31ce631051149dbab1baddc1005a63e3a11d3b2feb0) |
| TicketFactory | [`0x0dB0a481Ef2d53228eD1dD269dFbc0b9fA2559f8`](https://explorer.testnet.chain.robinhood.com/address/0x0dB0a481Ef2d53228eD1dD269dFbc0b9fA2559f8) | 126604726 | [`0x9557ce5523c02abfa2078448e646f270ad8e4efcdfe82785bf16db0cec0057cd`](https://explorer.testnet.chain.robinhood.com/tx/0x9557ce5523c02abfa2078448e646f270ad8e4efcdfe82785bf16db0cec0057cd) |

Total gas pada redeploy: **4.193.172 gas**, total biaya **0.00004193172 ETH**. Estimasi dry-run redeploy adalah 5.565.573 gas atau 0.000111311465565573 ETH; biaya aktual diambil dari transaksi sukses di log broadcast.

### Catatan perubahan faucet setelah deployment

Redeploy ini menggunakan MockUSDG baru tanpa cooldown dan Factory baru yang menunjuk ke token tersebut. Deployment pertama tetap ada di chain, tetapi tersupersede; Factory dan event lama tetap memakai MockUSDG lama dengan cooldown 24 jam karena alamat dependency tersimpan immutable.

## Sisa Langkah Pascadeploy

1. Buka tiga alamat dan transaksi di explorer untuk memastikan source/status deployment terlihat benar.
2. Catat alamat Factory, MockUSDG, dan verifier pada README/docs frontend; pastikan frontend menggunakan chain ID `46630` dan alamat yang sama.
3. Lakukan smoke test di testnet: verifikasi wallet, panggil faucet MockUSDG, buat event lewat Factory, lalu coba mint, resale, dan withdrawal dengan event demo.
4. Pastikan halaman docs menjelaskan bahwa token dan verifier masih mock serta holdback bukan refund.

## Catatan Keamanan dan Artifact

Alamat kontrak, transaction hash, block, dan saldo adalah data publik. **Private key tidak disimpan di laporan ini.** File `cache/` berisi output Foundry yang dapat mencakup data sensitif dan harus tetap lokal/di-ignore; jangan unggah atau commit file tersebut.

Log menunjukkan warning artifact lama dari file starter dan file test yang sudah dipindahkan/dihapus. Warning tidak mencegah build, dry-run, ataupun transaksi sukses. `forge clean` pernah gagal menghapus satu file cache karena permission; bersihkan ownership `cache/` sebagai user pemilik repo sebelum menjalankan clean kembali, jangan jalankan Foundry sebagai root.

## CARA VERIFY

**1. MockUSDG**

```bash
forge verify-contract 0x29e688092F42e533A69dB2dA0Df576579a5cd7f9 src/MockUSDG.sol:MockUSDG --chain-id 46630 --verifier blockscout --verifier-url https://explorer.testnet.chain.robinhood.com/api\?

```

**2. MockHumanVerifier**

```bash
forge verify-contract 0xaC3B0754697BfEB5A094B4578ba46848715C220F src/MockHumanVerifier.sol:MockHumanVerifier --chain-id 46630 --verifier blockscout --verifier-url https://explorer.testnet.chain.robinhood.com/api\?

```

**3. TicketFactory**

```bash
forge verify-contract 0x0dB0a481Ef2d53228eD1dD269dFbc0b9fA2559f8 src/TicketFactory.sol:TicketFactory --chain-id 46630 --verifier blockscout --verifier-url https://explorer.testnet.chain.robinhood.com/api\?

```

