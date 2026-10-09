# DESIGN SYSTEM: RWA SMART TICKET

> **Gaya:** Warm Minimalism — struktur ala Luma/Dice.fm, dihangatkan lewat warna & tipografi, dengan aksen editorial di titik emosional (hero event, konfirmasi beli). Target: terasa seperti app tiket konser biasa, bukan dashboard crypto.

---

## 1. Warna

### 1.1 Palet Inti

| Token | Hex | Peran |
|---|---|---|
| `primary` | `#F97316` | Aksen utama — tombol CTA, harga, elemen aktif |
| `primary-hover` | `#EA580C` | State hover/pressed untuk `primary` |
| `primary-soft` | `#FFEDD5` | Background lembut untuk badge/highlight bernuansa primary |
| `background` | `#FAF8F5` | Latar utama seluruh app (off-white hangat, bukan putih pekat) |
| `surface` | `#FFFFFF` | Latar card/modal di atas `background` |
| `text-primary` | `#292524` | Teks utama (abu gelap hangat, bukan hitam pekat) |
| `text-secondary` | `#78716C` | Teks sekunder — deskripsi, label, timestamp |
| `text-muted` | `#A8A29E` | Placeholder, teks nonaktif |
| `border` | `#E7E2DC` | Garis pembatas, divider, outline input |
| `success` | `#22C55E` | Verified, Sale success, status Running |
| `success-soft` | `#DCFCE7` | Background badge success |
| `danger` | `#DC2626` | Sold Out, error, Soulbound/Ended |
| `danger-soft` | `#FEE2E2` | Background badge danger |
| `warning` | `#D97706` | Peringatan (mis. "Publish tidak bisa diubah") |
| `warning-soft` | `#FEF3C7` | Background badge warning |

### 1.2 Aturan Pemakaian
- **Tidak ada dark mode di MVP.** Satu tema terang konsisten — dark mode Web3-style justru yang ingin dihindari.
- `primary` dipakai **secukupnya** — tombol utama, harga, link aktif. Jangan dipakai untuk background besar/section penuh (biar tetap terasa "hangat", bukan "ramai").
- Gradient **dihindari** kecuali di hero banner event (opsional, tipis, dari foto event itu sendiri — bukan gradient ungu-biru sintetis).
- Warna status (`success`/`danger`/`warning`) **selalu** dipasangkan dengan teks/ikon, tidak berdiri sendiri sebagai satu-satunya penanda (aksesibilitas).

### 1.3 Tailwind Config

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#F97316',
          hover: '#EA580C',
          soft: '#FFEDD5',
        },
        background: '#FAF8F5',
        surface: '#FFFFFF',
        text: {
          primary: '#292524',
          secondary: '#78716C',
          muted: '#A8A29E',
        },
        border: '#E7E2DC',
        success: { DEFAULT: '#22C55E', soft: '#DCFCE7' },
        danger:  { DEFAULT: '#DC2626', soft: '#FEE2E2' },
        warning: { DEFAULT: '#D97706', soft: '#FEF3C7' },
      },
    },
  },
};
```

---

## 2. Tipografi

### 2.1 Font Family

| Peran | Font | Sumber | Dipakai untuk |
|---|---|---|---|
| **Display** | Clash Display | Fontshare (gratis) | Nama event besar, hero headline, harga besar di kartu tiket |
| **Body/UI** | Inter | Google Fonts | Semua teks fungsional: deskripsi, label, form, tombol, tabel |

Maksimal 2 font family. `Display` dipakai terbatas (headline saja) supaya tidak menambah beban render dan tetap menjaga keterbacaan.

### 2.2 Skala Ukuran

| Token | Ukuran | Font | Contoh Pemakaian |
|---|---|---|---|
| `display-xl` | 48px / Bold | Clash Display | Nama event di hero |
| `display-lg` | 32px / Bold | Clash Display | Judul halaman (Explore, Dashboard) |
| `heading-lg` | 24px / Semibold | Inter | Judul section (nama box phase/category) |
| `heading-md` | 18px / Semibold | Inter | Judul card, judul modal |
| `body-lg` | 16px / Regular | Inter | Body teks utama, deskripsi event |
| `body-md` | 14px / Regular | Inter | Label form, teks sekunder |
| `caption` | 12px / Medium | Inter | Timestamp, metadata kecil, badge |

### 2.3 Tailwind Config

```js
// tailwind.config.js (lanjutan)
fontFamily: {
  display: ['"Clash Display"', 'sans-serif'],
  sans: ['Inter', 'sans-serif'],
},
fontSize: {
  'display-xl': ['48px', { lineHeight: '1.1', fontWeight: '700' }],
  'display-lg': ['32px', { lineHeight: '1.15', fontWeight: '700' }],
  'heading-lg': ['24px', { lineHeight: '1.3', fontWeight: '600' }],
  'heading-md': ['18px', { lineHeight: '1.4', fontWeight: '600' }],
  'body-lg': ['16px', { lineHeight: '1.5', fontWeight: '400' }],
  'body-md': ['14px', { lineHeight: '1.5', fontWeight: '400' }],
  'caption': ['12px', { lineHeight: '1.4', fontWeight: '500' }],
},
```

---

## 3. Spacing, Radius & Shadow

### 3.1 Spacing
Skala Tailwind default dipakai apa adanya, dengan aturan minimum:
- Padding card besar (event card, phase box, category box): **minimal `p-6` (24px)**.
- Padding card kecil (badge, chip): `px-3 py-1`.
- Jarak antar-section: **minimal `space-y-8` (32px)** — jangan rapat, kesan harus "santai" bukan "dashboard padat data".
- Gap grid (phase × category matrix): `gap-3`.

### 3.2 Radius

| Token | Nilai | Dipakai untuk |
|---|---|---|
| `rounded-2xl` | 16px | Card besar (event card, phase box, category box, modal) |
| `rounded-lg` | 8px | Button, input, badge |
| `rounded-full` | — | Avatar wallet, status dot |

### 3.3 Shadow
Soft shadow saja — **hindari** shadow keras/neo-brutalism kecuali disebut eksplisit di Bagian 5.

```js
boxShadow: {
  card: '0 1px 3px rgba(41, 37, 36, 0.06), 0 1px 2px rgba(41, 37, 36, 0.04)',
  modal: '0 20px 40px rgba(41, 37, 36, 0.12)',
}
```

---

## 4. Foto & Gambar

- Foto event (flyer) **selalu full-bleed** di dalam radius card, rasio konsisten **16:9** untuk thumbnail di `/explore`, **1:1** untuk gambar NFT kategori.
- Tidak ada border/frame tebal di sekitar foto — biarkan foto jadi elemen utama (prinsip Warm Photography-Led).
- Overlay gradient tipis (hitam transparan, bawah ke atas) diperbolehkan **hanya** di hero banner untuk menjaga keterbacaan teks di atas foto.

---

## 5. Aksen Editorial & Neo-Brutalism (Selektif)

Dipakai **terbatas**, tidak untuk seluruh UI:

- **Editorial (headline besar, miring/overlap tipis):** hero section halaman detail event saja — nama event, tanggal, lokasi ditulis besar dengan `display-xl`.
- **Neo-brutalism (border tebal 2px solid + shadow keras, tanpa blur):** khusus untuk:
  - Badge status kritikal: `VERIFIED`, `SOLD OUT`, `LIVE NOW`.
  - Container QR code (border tebal hitam/`text-primary`, biar terasa "objek fisik" seperti tiket sungguhan).

```js
// contoh badge neo-brutalism
'.badge-brutal': {
  border: '2px solid #292524',
  boxShadow: '3px 3px 0 #292524',
  borderRadius: '8px',
}
```

---

## 6. Komponen Kunci

Daftar komponen yang harus dibakukan dari awal supaya tidak ada improvisasi beda-beda antar halaman:

| Komponen | Varian | Catatan |
|---|---|---|
| **Button** | Primary, Secondary (outline), Ghost, Disabled | Radius `rounded-lg`, padding `px-5 py-2.5`, font `body-md` semibold |
| **Card — Event** | Default | Foto 16:9 + `heading-md` nama + `caption` tanggal/lokasi + badge status |
| **Card — Phase Box** | Default | Header nama phase + tanggal, grid harga/kuota di dalamnya |
| **Card — Category Box** | Default | Gambar 1:1 + nama + `maxResalePrice` (read-only, style berbeda dari input aktif — pakai `text-secondary` + ikon lock kecil) |
| **Badge** | Success (Verified), Danger (Sold Out), Warning (Pending), Neo-brutal (Live Now) | Selalu teks + ikon, bukan warna saja |
| **Modal** | Form (Add Phase/Add Category), Konfirmasi (Publish warning) | Radius `rounded-2xl`, shadow `modal` |
| **Input** | Text, Number (harga/kuota), Date picker | Border `border`, focus ring `primary` |
| **Grid Cell (Matrix Builder)** | Kosong (wajib diisi, border `warning`), Terisi (border `border` biasa) | Isyarat visual jelas mana yang belum diisi |

---

## 7. Prinsip Ringkas (buat pegangan cepat saat develop)

1. Satu warna aksen (`primary`), jangan tambah warna baru di luar tabel Bagian 1.
2. Maksimal 2 font — `Clash Display` untuk headline besar saja, sisanya `Inter`.
3. Radius besar (`2xl`) untuk card, kecil (`lg`) untuk elemen interaktif kecil.
4. Shadow selalu lembut, kecuali badge status & QR container (neo-brutal, sengaja).
5. Foto besar dan dominan, tanpa frame berat.
6. Tidak ada dark mode, tidak ada gradient ungu-biru ala Web3 dashboard.
7. Spacing longgar — lebih baik kelihatan "lapang" daripada "padat data".
