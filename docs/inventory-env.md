# Inventaris Environment, Secret & Konfigurasi

Fase 0, tugas 3. Basis kode: commit `661b817`. **Tidak ada nilai rahasia di dokumen ini.** Secret hanya dicatat lokasinya.

## 1. Variabel environment

| Nama | Dipakai di | Fungsi | Wajib | Catatan |
|---|---|---|---|---|
| `SUPABASE_URL` | `api/lib/supabase.js:6`, `:28`; `migrate-surat.js:3`; `check_supa.js:8` | URL project Supabase | ya | Bila kosong, dipakai placeholder dan proses tetap start (`supabase.js:28`). URL produksi juga tertulis di `.env.example:8`, `README.md:77`, `Migrasi.gs:14` |
| `SUPABASE_SERVICE_KEY` | `api/lib/supabase.js:6`, `:29`; `migrate-surat.js:5` | Kunci service role (melewati RLS) | ya | **Rahasia.** Hanya boleh ada di server |
| `JWT_SECRET` | `api/lib/auth.js:4` | Tanda tangan JWT HS256 | ya | Proses berhenti dengan error bila kosong (`auth.js:7-9`) |
| `PORT` | `dev-server.js:34` | Port server dev | tidak | Bawaan 3000 |

Cara env dimuat:
- lokal: parser `.env` manual di `dev-server.js:8-30` dan `api/lib/supabase.js:6-26`; skrip `npm run dev` juga memakai `node --env-file=.env` (`package.json:7`);
- produksi: Environment Variables di dashboard Vercel (`README.md:99-107`).

`.env` sudah tercantum di `.gitignore`. Isi `.env` lokal **tidak dibaca** selama audit ini.

## 2. Secret di luar environment (lokasi saja)

| Lokasi | Jenis | Status | Tindakan yang diusulkan |
|---|---|---|---|
| `api/auth.js:8-35` (`LOCAL_REGIONS_MAP`) | Password plaintext 26 akun | Dipakai sebagai fallback login (`auth.js:80-90`) | Rotasi semua password; hapus fallback (hotfix G2, setelah dump membuktikan semua akun ada di tabel `regions`) |
| `supabase/schema.sql` (seed sekitar baris 125–151) | Password plaintext di dalam `crypt('…')` | Di git | Rotasi; jangan jalankan ulang seed |
| `Code.js:1` (`REGION_PASSWORDS`) | Password region milik backend GAS lama | **Perlu dicek oleh Anda** apakah nilainya asli | Hapus dari repo setelah cutover; rotasi bila sama dengan password aktif |
| `Kode2.gs:16`, `:218` (`convertApiSecret`) | Secret ConvertAPI | **Perlu dicek** | Pindah ke Script Properties GAS; rotasi bila nilainya asli |
| `Kode2.gs:168`, `:290` (header `Authorization`) | Token Fonnte (WhatsApp) | **Perlu dicek** | Sama seperti di atas |
| `Migrasi.gs:16` (`SUPABASE_SERVICE_KEY`) | Service key (templat; README meminta mengganti nilainya) | **Perlu dicek** | Pastikan berisi placeholder |

**Dugaan kuat paparan publik.** Repo tidak punya `.vercelignore`. Berkas di atas, plus `supabase/*.sql`, `data_kebun_tk.json(.bak)`, berkas `.xlsx`/`.csv` dan skrip `.py`, ikut ter-commit. Project Vercel tanpa build menyajikan berkas repo sebagai aset statis, jadi kemungkinan berkas itu bisa diunduh dari `https://agri-pam.id/<nama-berkas>`.

Cara verifikasi (oleh Anda): buka `https://agri-pam.id/Kode2.gs` di jendela privat. Bila status 200, berkas terpapar. Lihat `docs/risks.md` R-16.

## 3. `vercel.json`

| Bagian | Isi | Catatan |
|---|---|---|
| `cleanUrls` | `true` | `/admin` → `admin.html`, `/laporan_produksi` → `laporan_produksi.html`, dan seterusnya |
| `functions` | `api/*.js` dengan `maxDuration: 30` | Batas body Vercel Function 4,5 MB, sementara `sap.js:47` menerima base64 hingga 50 MB |
| Header `/(.*).html` | `Cache-Control: no-store…`, `Pragma: no-cache`, `Expires: 0` | — |
| Header `/(.*)` | `nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geo/payment dimatikan), HSTS 2 tahun + preload, CSP (rincian di bawah) | — |
| Header `/api/(.*)` | `Access-Control-Allow-Credentials`, daftar method/header, `Cache-Control: no-store` | `Allow-Origin` diisi `applyCors` |
| `rewrites` | Semua path kecuali `api/` → `/login.html` | Hanya berlaku bila tidak ada berkas yang cocok |

CSP saat ini (`vercel.json:52`):

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net https://cdn.tailwindcss.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdn.tailwindcss.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: blob: https:;
connect-src 'self' https://api.ipify.org https://unpkg.com;
frame-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'
```

Ketidakcocokan CSP dengan kode (perlu dicek di DevTools Console produksi):
- `html2pdf.js` dimuat dari `cdnjs.cloudflare.com` (`laporan_produksi.html:147`), padahal domain itu tidak ada di `script-src`. Akibatnya ekspor PDF di `RencanaRealisasiPanel` (`:3850`) kemungkinan **diblokir di produksi**.
- Halaman SAP mengambil berkas dengan `fetch(fileUrl)` ke URL publik Supabase Storage (`sap_admin.html:1280`, `sap_regional.html:444`), padahal `*.supabase.co` tidak ada di `connect-src`. Akibatnya pratinjau dokumen kemungkinan **diblokir di produksi**.

## 4. CORS (`api/lib/cors.js`)

- Origin yang diizinkan: `https://agri-pam.id`, `https://www.agri-pam.id`, `http://localhost:3000`. Preview `*.vercel.app` **tidak** termasuk.
- Method: GET, POST, OPTIONS. Header: `Content-Type`. Credentials: true.

## 5. `dev-server.js` (lokal)

- Express 5 dengan `express.json` / `urlencoded` hingga 100 MB (`:37-38`).
- **Log request mencetak `req.url` lengkap dengan query string** (`:41-44`). Karena login lewat GET, password ikut tertulis di log dev. Log request Vercel kemungkinan juga mencatat URL ini.
- Header anti-cache untuk HTML dan clean URL (`:53-72`).
- Route halaman (`:97-132`): `/`, `/admin`, `/qc_admin`, `/vendor_monitoring`, `/laporan-produksi`, `/sap_admin`, `/login.html/TKPanen`, `/TKPanen`, `/tk-panen`.
- `express.static(__dirname)` menyajikan seluruh root repo (`:136`). Dotfile seperti `.env` tidak ikut (bawaan `dotfiles: 'ignore'`), tetapi `.sql`, `.gs`, `.json` ikut tersaji.

## 6. Dependensi (`package.json`)

| Jenis | Paket |
|---|---|
| Runtime | `@supabase/supabase-js ^2.45.4`, `express ^5.2.1`, `html-to-docx ^1.8.0`, `jsonwebtoken ^9.0.2`, `xlsx ^0.18.5` (versi npm dengan celah keamanan; lihat R-12) |
| Dev | `vercel ^37.0.0` |

Toolchain lokal saat audit: Node v24.18.0, npm 11.16.0, Docker 29.4.3 dan corepack 0.35.0. pnpm, Supabase CLI, gh, psql dan pg_dump **belum** terpasang.

## 7. Integrasi eksternal

| Layanan | Dipakai oleh | Fungsi |
|---|---|---|
| api.ipify.org | `login.html:6707` | IP klien dikirim saat login |
| Google Apps Script (`Kode2.gs`) | di luar repo runtime | Ekspor spreadsheet ke PDF, ConvertAPI (PDF ke JPG), lalu kirim ke WhatsApp lewat Fonnte (`Kode2.gs:39-49`, `:168-173`) |
| Supabase Storage | `api/sap.js` | Bucket `berkas_surat` dan `surat_files` (URL publik) |
| Bot screenshot | repo GitHub terpisah | **TIDAK DIKETAHUI**. Menunggu skrip bot (`docs/bot-inventory.md`) |
