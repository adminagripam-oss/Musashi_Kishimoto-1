# Inventaris Halaman Legacy (AGRI-PAM v1)

Fase 0, tugas 1. Basis kode: commit `661b817` (branch `main`). Seluruh isi dokumen ini berasal dari pembacaan kode, dan setiap klaim menyebut `file:baris`. Hal yang belum pasti ditandai **TIDAK DIKETAHUI** beserta cara mengeceknya.

## 1. Ringkasan semua halaman

| Halaman | Fungsi | Peran | Guard di klien | API yang dipanggil | Status |
|---|---|---|---|---|---|
| `login.html` (7532 baris) | Login, lalu dashboard regional: Monitoring, Est Panen (Infografis), ARSIP (SAP), TK Panen | semua (login); regional (dashboard) | `agripam_session` di sessionStorage (`login.html:4352-4385`) | auth, realisasi, estimasi, deleteRequest, unlockRequest, sap (`getSurat`), kebunTK | aktif |
| `laporan_produksi.html` (6089) | Dashboard admin (React 18 CDN + Babel) | ADMIN | `checkAuth` + `pageshow` (`laporan_produksi.html:8-56`) | realisasi, estimasi, palmops, targetChallenge, laporanRealisasi, kebunTK | aktif |
| `FORMAT_ESTIMASI_PANEN.html` (2063) | Infografis Rencana & Estimasi Panen + panel "Persetujuan Request (Hapus & Buka Akses)" untuk admin | regional & ADMIN (sebagai iframe di `login.html:6297`) | **tidak ada**; sesi dibaca kalau ada (`:884-923`) | estimasi, realisasi, deleteRequest, unlockRequest | aktif (iframe) |
| `sap_admin.html` (1455) | SAP Persuratan (Sistem Administrasi Persuratan) versi admin | ADMIN | `init()` (`sap_admin.html:334-371`): sesi dari storage atau dari query string URL | sap | aktif (iframe `login.html:5153`, tautan `laporan_produksi.html:773`) |
| `sap_regional.html` (510) | SAP Persuratan versi regional | regional (ADMIN ditolak, `:180`) | `init()` (`sap_regional.html:152-191`) | sap | aktif (iframe `login.html:5155`) |
| `qc_admin.html` (889) | QC Spreadsheet | `QC admin`, ADMIN (`:24`) | `checkAuth` (`qc_admin.html:10-39`) | qcSheet, auth (logout) | aktif (tujuan login `QC admin`, `login.html:4947`) |
| `vendor_monitoring.html` (611) | Monitoring vendor + pembuatan SPK | semua sesi; **tanpa cek peran** (`:10-34`) | `checkAuth` | vendor | **TIDAK DIKETAHUI**. Tidak ditautkan dari halaman mana pun; hanya ada route `dev-server.js:109`. Cek: tanyakan pemilik modul atau cek log akses Vercel |
| `rekap_tk_panen.html` (572) | Rekap TK Panen publik untuk bot (PRD 2026-08-19) | publik | tidak ada | kebunTK `getKebun&region=ALL` (`:218`) | aktif (bot) |
| `rekap-cro-fullscreen.html` (344) | Rekap Rencana vs Realisasi per CRO, layar penuh | publik | tidak ada | realisasi `getData&region=ALL` (`:220`), refresh tiap 5 menit (`:213`) | **TIDAK DIKETAHUI** (dugaan target bot; cek `docs/bot-inventory.md`) |
| `table-modal-fullscreen.html` (366) | Tabel Rencana & Estimasi Panen, layar penuh | publik | tidak ada | estimasi `getEstimasi&region=ALL` (`:241`), refresh tiap 5 menit (`:234`) | **TIDAK DIKETAHUI** (dugaan target bot) |
| `one-agripam.html` (1122) | Portal tautan aplikasi Agrinas (AGRI-PAM, ASTA, operasional, Siperdin, Drive/Sheets) | publik | tidak ada | tidak ada | aktif (cek apakah domainnya sama) |
| `panduan-regional.html` (499) | Panduan statis untuk regional | publik | tidak ada | tidak ada | aktif |
| `index.html` (18) | Redirect ke `login.html` | publik | — | — | aktif |
| `admin.html` (3194) | Versi lama dashboard input (gaya `login.html`, BroadcastChannel `:1142`) | ADMIN (`:1830`) | sesi | auth, realisasi, estimasi | **usang?** Tidak ditautkan dari halaman mana pun. Masih dilayani `dev-server.js:101` (`/admin`) dan cleanUrls Vercel |
| `admin-screenshot.html` (1696) | Dashboard admin "Screenshot Mode" dengan sesi palsu `token: "screenshot-mode"` (`:892`) | publik | — | publik saja | **TIDAK DIKETAHUI** (dugaan bot lama) |
| `loginPANDUAN.html` (4725) | Salinan lama `login.html` | — | sesi | auth, unlockRequest | **usang?** Tidak ditautkan dari halaman mana pun |
| `test_react_event.html` (33) | Uji coba React event | — | — | — | usang |

Berkas pendukung:
- `shadcn_overrides.js` + `shadcn_overrides.css`: dimuat oleh `login.html:2613`, `laporan_produksi.html:71`, `admin.html:3190` dan `FORMAT_ESTIMASI_PANEN.html:17`.
- `temp.jsx` dan `scratch/temp_babel_0.jsx`: hasil ekstraksi skrip Babel, bukan kode produksi.

## 2. Detail halaman utama

### 2.1 `login.html`: login + dashboard regional

**Bagian (section):**
- `loadingOverlay` (`:2847`), `loginSection` (`:2858`).
- `mainSection` (`:2978`). **Bug:** id yang sama dipakai lagi di `<main id="mainSection">` (`:3132`).
- `infografisSection` (`:4068`), `estimasiSection` (`:4077`), `sapSection` (`:4146`).
- Sheet: `editKebunSheet` (`:7145`), `addKebunSheet` (`:7286`), `inputPanenSheet` (`:7425`).

**Sidebar** (`:2993-3049`): Monitoring, Est Panen (iframe `FORMAT_ESTIMASI_PANEN.html`, `bukaInfografis` `:6273`), ARSIP (iframe SAP, badge notifikasi `sapNotifBadge`), TK Panen.

**TK Panen**, di skrip `<head>` (`:1861-2605`):
- `bukaTKPanenSection`, `loadTKPanenDataForSelectedRegion` (`:1938`), `renderTKPanenTable` (`:2045`), `simpanTKPanenEdits` (`:2216`), `filterTKPanenTable` (`:2588`);
- hapus kebun (`:2325`), tambah kebun (`:2438`).

**Konfigurasi & sesi:**
- `API_BASE` (`:4235`) dan `ACTION_MAP` (`:4239-4262`): pemetaan action GAS lama ke endpoint `/api/*`.
- `SESSION_KEY = "agripam_session"` (`:4265`).
- BroadcastChannel `agripam_bc` untuk satu sesi per browser (`:4266-4327`): login di tab baru memaksa tab lama logout.
- `saveSession` / `loadSession` / `clearSession` (`:4352-4385`): expiry dicek di klien. Peringatan 15 menit sebelum habis (`:4387-4401`).
- `jsonpRequest` (`:4659-4695`): **semua** request lewat GET dengan query string, termasuk login dan password. Timeout 20 detik, retry 2× tiap 3 detik.

**Login** (`:4912-5000`):
- mengirim `ip` dari `api.ipify.org` (`:6707`) dan `clientTime`;
- ADMIN diarahkan ke `laporan_produksi.html` (`:4943`); `QC admin` ke `qc_admin.html` (`:4947`); regional tetap di halaman ini;
- pop-up Agripam Update muncul 500 ms setelah login (`:4985`).

**Pengatur waktu & polling:**
- Heartbeat tiap 30 menit dengan action `refreshToken` (`:5013-5036`). Lihat `docs/risks.md` R-07: server tidak mengenal action ini, sehingga pengguna dipaksa logout.
- `startAdminAutoUpdate`: tiap 30 detik, hanya untuk ADMIN (`:5051-5066`).
- Notifikasi SAP: `getSurat` **tiap 1 detik**, hanya untuk ADMIN (`:5080-5111`).
- Running text: `getRunningTextData&region=ALL` (`:4882`), interval 30 detik (`:7025`).
- Jam WIB: `updateWIBClock` tiap 1 detik (`:6748`).

**Realisasi per jam:**
- `checkAccumulation` (`:5545`), `updateJamHint` (`:5660`), insert (`:5922`), `handleDelete` (`:5956`);
- daftar jam (`:5456`, `:6828`) dan `<select>` jam (`:7453-7464`).

**Revisi tanggal lampau:** `checkRevisionStatus` (`:3589`), `ajukanRevisiTanggal` (`:3622`), `requestRevision` (`:3641`).

**Estimasi:**
- cek buka akses `checkUnlock` (`:4455`), `requestUnlock` (`:4635`);
- `toggleTidakPanen` (`:6330-6364`);
- `simpanDraftEstimasi` ke localStorage (`:6366-6399`);
- `handleInsertEstimasi` (`:6402`): batas H-1 22.00 WIB (`:6433-6456`) dan validasi angka (`:6458-6495`).

**Query string:**
- `?msg=`: pesan di halaman login; dihapus dari URL dengan `replaceState` (`:7109-7113`).
- `?show=infografis` (`:6627`): dipakai admin dari `laporan_produksi.html:772`.

**Tema:** `agripam_theme` (`:4163`, `:4171`); Tailwind `darkMode: ['selector', ...]` (`:2617`).

**CDN:**
- Tailwind CDN **dua kali** (`:1841`, `:2614`);
- flatpickr (`:2609`), `shadcn_overrides.js` (`:2613`);
- Chart.js tanpa versi tetap (`:2834`).

Clean URL `/TKPanen`, `/tk-panen` dan `/login.html/TKPanen` mengarah ke halaman ini (`dev-server.js:122-132`).

### 2.2 `laporan_produksi.html`: dashboard admin (React 18 CDN)

**Guard:** `checkAuth` mewajibkan `region === "ADMIN"` (`:8-35`); `pageshow` menolak halaman dari bfcache (`:38-56`).

**CDN:**
- tailwind (`:63`), flatpickr (`:67`), `shadcn_overrides.js?v=4` (`:71`);
- `chart.js@4.4.3` (`:131`);
- **React/ReactDOM 18 build development** (`:134-135`) dan `@babel/standalone` (`:138`);
- `lucide@latest` (`:141`), `xlsx@0.18.5` (`:144`), `html2pdf.js 0.10.1` (`:147`).

**Konstanta:**
- `CRO_MAP` (`:522-534`) dan `ALL_REGIONS` (`:536-545`);
- `REGIONAL_DETAIL`, ditandai "mock" (`:547`). **TIDAK DIKETAHUI** apakah masih dirender. Cek pemakai `REGIONAL_DETAIL`.
- label jam (`:469`, `:976`).

**Navigasi** (`activeNav`, `:768-773`; default `'laporan-jam'` di `:5893`):

| Menu | Nilai `activeNav` / tujuan |
|---|---|
| PANEN MONITORING | `dashboard` / `laporan-jam` |
| VALIDASI DATA | `validasi` → `ValidationPanel` |
| RENCANA & REALISASI | `rencana-realisasi` → `RencanaRealisasiPanel` |
| TK PANEN | `tk-panen` → `TKPanenView` |
| Estimasi Panen | `login.html?show=infografis` |
| SAP Persuratan (Arsip) | `sap_admin.html` |

**Komponen:**

| Komponen | Baris | Isi / data |
|---|---|---|
| `Sidebar` | `:731` | — |
| `TopHeader` (toggle tema) | `:806` | — |
| `TickerRow` | `:854` | — |
| `HourlyChartRow` | `:923` | — |
| `DonutChart` | `:1165` | — |
| `LeaderboardCard` | `:1273` | — |
| `RegionalRow` | `:1309` | — |
| `RealisasiEstimasiChart` | `:1321` | — |
| `FilterBar` | `:1856` | — |
| `ValidationPanel` | `:2102` | PalmOps: unggah `XLSX.read` `:2152`; `get`/`save`/`delete` `:2120`, `:2441`, `:2482`; ekspor `XLSX.writeFile` `:2641` dan .xls `:2783` |
| `TargetChallengeModal` | `:3028` | `getTarget`/`saveTarget`/`deleteTarget` `:3041`, `:3152`, `:3185`; unggah `:3069` |
| `RencanaRealisasiPanel` | `:3366` | LHP: `getLaporan`/`saveLaporan`/`deleteLaporan` `:3444`, `:3490`, `:3526`; unggah `:3595`; PDF `html2pdf` `:3850`; .xls `:3950` |
| `ExecutiveIntelligenceHighlight` | `:4115` | — |
| `MonitorTKModal` | `:4183` | ekspor .xls `:4388` |
| `TKPanenView` | `:4534` | `addKebun` `:4572`, `getKebun` `:4595`, `updateTK` `:4644`, `deleteKebun` `:5863`; ekspor .xls `:4957` |
| `App` | `:5892` | — |

**Filter tanggal** (`:5933-5961`):

| `dateMode` | Rentang |
|---|---|
| `TUNGGAL` | satu tanggal |
| `SD_BULAN_INI` | 1 Januari sampai tanggal acuan (YTD) |
| `SD_HARI_INI` | tanggal 1 bulan berjalan sampai tanggal acuan (MTD) |
| `KUSTOM` | bebas |

**Pengambilan data** (`:5967-6027`):
- realisasi `ALL` tanpa token, estimasi `ALL`, dan data kemarin (bila mode bukan rentang);
- **tidak ada refresh otomatis** di `App`. Interval satu-satunya adalah jam (`:586`).

**Tema:** `agripam_theme` (`:11`, `:5909-5918`); Tailwind `darkMode: ['class', ...]` (`:75`).

### 2.3 `FORMAT_ESTIMASI_PANEN.html`: Infografis + persetujuan admin

- **Tanpa guard.** Region diambil dari sesi bila ada; tanpa sesi dianggap `ALL` (`:891-919`).
- Data: estimasi + realisasi per tanggal (`:921-922`).
- Panel admin (hanya ADMIN, `:1786`, `:2013`):
  - `getDeleteRequests` + `getUnlockRequests` (`:1835-1836`);
  - `resolveDeleteRequest` (`:1941`), `resolveUnlockRequest` (`:1986`);
  - notifikasi permintaan baru **tiap 1 detik** (`:1004`).
- Ekspor Excel memakai `XLSX.writeFile` (`:1479`).
- Konfirmasi memakai `window.showConfirm`, dengan fallback `confirm()` bawaan browser (`:1926-1933`).
- CDN: Tailwind CDN (`:10`), chart.js (`:12`), `xlsx@0.18.5` (`:14`), `shadcn_overrides.js` (`:17`); `darkMode: "class"` (`:26`).

### 2.4 SAP Persuratan: `sap_admin.html`, `sap_regional.html`

**Sesi:**
- dibaca dari `sessionStorage` **atau `localStorage`**;
- bila tidak ada, diambil dari query string `token`, `region`, `expiry` (dikirim `login.html:5150`), lalu disimpan ke sessionStorage (`sap_admin.html:335-358`, `sap_regional.html:153-177`).

**Peran:** admin wajib ADMIN (`sap_admin.html:361`); regional menolak ADMIN (`sap_regional.html:180`).

**Action:**

| Halaman | Action (baris) |
|---|---|
| admin | `getSurat` `:409`, `deleteSuratMultiple` `:680`, `updateSurat` `:834`, `deleteSurat` `:907`, `insertSurat` `:988`, `saveSuratDocx` `:1387` |
| regional | `insertSurat` `:263`, `getSurat` `:306`, `saveSuratDocx` `:482` |

**Berkas:** dibaca langsung lewat `fetch(fileUrl)` (`sap_admin.html:1280`, `sap_regional.html:444`), ditampilkan dengan `mammoth@1.8.0`.

**Lain-lain:**
- `@supabase/supabase-js@2` dimuat (`sap_admin.html:12`, `sap_regional.html:12`) tetapi `createClient` tidak dipanggil di mana pun.
- Tombol keluar mengirim `postMessage({action:'closeSAP'}, '*')` ke parent (`sap_admin.html:376`, `sap_regional.html:196`).

### 2.5 `qc_admin.html`, `vendor_monitoring.html`

**`qc_admin.html`:**
- GET `/api/qcSheet?token=..&region=..` (`:478`), POST `/api/qcSheet` (`:534`), logout `/api/auth` (`:871-874`);
- impor .xlsx dengan `XLSX.read` (`:802`);
- `history.pushState` + `onpopstate` memaksa logout saat tombol Back ditekan (`:34-38`).

**`vendor_monitoring.html`:**
- GET `/api/vendor?token=..&region=..` (`:299`);
- `create` (`:340`), `update` (`:354`), `generate-spk` (`:383`);
- `isAdmin` ditentukan dari region di sesi klien (`:233`).

### 2.6 Halaman publik bot

**`rekap_tk_panen.html`:**
- React CDN development (`:31-35`), `lucide@latest` (`:38`);
- `@media print` dengan `print-color-adjust: exact` (`:75-128`);
- ekspor .xls (`:374`, `:436-440`).

**`rekap-cro-fullscreen.html` / `table-modal-fullscreen.html`:**
- tanggal bawaan hari ini WIB;
- input tanggal (dan region pada tabel estimasi);
- refresh tiap 5 menit.

## 3. Fungsi global di `window` (`shadcn_overrides.js`)

| Fungsi | Baris | Catatan |
|---|---|---|
| `showAlert(variant, title, message, durationMs)` | `:4` | toast |
| `alert(msg, titleOverride)` | `:49` | **mengganti `window.alert` bawaan** di semua halaman yang memuat berkas ini |
| `initShadcnSelect(selectId)` | `:72` | — |
| `initShadcnDate()` | `:231` | — |
| `showConfirm(title, description, type, options)` | `:284` dan `:483` | **didefinisikan dua kali**; definisi `:483` yang berlaku |
| `renderInlineAlert(msg)` | `:371` dan `:587` | dua kali; `:587` yang berlaku |
| `renderReuiRevisionAlert(status, dateStr, cb)` | `:416` dan `:632` | dua kali; `:632` yang berlaku |
| `showAgripamUpdateAnnouncement(force)` | `:697` | dicek ulang di `:804` |

## 4. Key storage

| Key | Tempat | Isi | Lokasi |
|---|---|---|---|
| `agripam_session` | sessionStorage (SAP juga membaca localStorage) | `{region, token, expiry}` | `login.html:4357`, `sap_admin.html:335` |
| `agripam_theme` | localStorage | `light` / `dark`, bawaan `light` | `login.html:4163`, `laporan_produksi.html:11` |
| `agripam_update_shown` | sessionStorage | penanda pop-up Agripam Update; dihapus saat logout | `login.html:4383`, `shadcn_overrides.js:697` |
| `agripam_sidebar_collapsed` | localStorage | status sidebar | `login.html:7032-7037` |
| `draft_estimasi_<region>_<tanggal>` | localStorage | draft form estimasi | `login.html:6396`, `:6527` |
| `draftEstimasi_*`, `draftRealisasi_*` | localStorage | draft di halaman lama | `admin.html:1244-1302` |

## 5. Query string

| Parameter | Dipakai di | Fungsi |
|---|---|---|
| `msg` | `login.html:7109` | pesan alasan logout atau redirect |
| `show=infografis` | `login.html:6627` | admin membuka Infografis |
| `token`, `region`, `expiry`, `t` | `login.html:5150` → `sap_*.html` | **token sesi dikirim di URL** iframe SAP |
| `_t` | banyak `fetch` | mencegah cache |
| `t` | iframe `FORMAT_ESTIMASI_PANEN.html?t=` (`login.html:6297`) | mencegah cache |

## 6. Library CDN

| Library | Halaman (baris) |
|---|---|
| Tailwind Play CDN | `login.html:1841`+`:2614`, `laporan_produksi.html:63`, `FORMAT_ESTIMASI_PANEN.html:10`, `sap_*.html:10`, `qc_admin.html:46`, `vendor_monitoring.html:40`, `rekap_tk_panen.html:10`, `rekap-cro-fullscreen.html:10`, `table-modal-fullscreen.html:11` |
| React 18 development + Babel standalone | `laporan_produksi.html:134-138`, `rekap_tk_panen.html:31-35` |
| Chart.js | `laporan_produksi.html:131` (`@4.4.3`); tanpa versi tetap di `login.html:2834`, `FORMAT_ESTIMASI_PANEN.html:12`, `admin.html:717`, `admin-screenshot.html:833`, `loginPANDUAN.html:1576` |
| `xlsx@0.18.5` | `laporan_produksi.html:144`, `qc_admin.html:47`, `FORMAT_ESTIMASI_PANEN.html:14` |
| flatpickr | `login.html:2609`, `laporan_produksi.html:67` |
| lucide `@latest` | `laporan_produksi.html:141`, `rekap_tk_panen.html:38`, `one-agripam.html:1117` |
| html2pdf.js 0.10.1 | `laporan_produksi.html:147` |
| mammoth 1.8.0 | `sap_admin.html:16`, `sap_regional.html:14` |
| supabase-js 2 (tidak dipakai) | `sap_admin.html:12`, `sap_regional.html:12` |

## 7. Pertanyaan terbuka (TIDAK DIKETAHUI)

1. Apakah `vendor_monitoring.html` dipakai di produksi? Halaman ini tidak punya tautan masuk.
2. Halaman mana yang dipotret bot: `rekap_tk_panen.html`, `rekap-cro-fullscreen.html`, `table-modal-fullscreen.html`, `admin-screenshot.html`? Dijawab lewat `docs/bot-inventory.md`.
3. Apakah `admin.html` dan `loginPANDUAN.html` aman dipensiunkan? Cek log akses `/admin` dan `/loginPANDUAN` di Vercel.
4. Apakah data mock `REGIONAL_DETAIL` (`laporan_produksi.html:547`) masih ikut dirender?
5. `one-agripam.html` menautkan folder Drive dan Google Sheets internal (`:815-974`). Apakah halaman ini memang untuk publik?
