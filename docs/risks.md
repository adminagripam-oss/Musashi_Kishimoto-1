# Risiko, Celah Keamanan & Kode Mati (AGRI-PAM v1)

Fase 0, tugas 5. Basis kode: commit `661b817`. Legacy tetap menjadi produksi selama migrasi, sehingga risiko bertingkat **Kritis** dan **Tinggi** berlaku **sekarang**.

**Tingkat:**
- **Kritis:** dapat dieksploitasi tanpa login, atau membocorkan kredensial.
- **Tinggi:** butuh login, atau merusak data dan alur utama.
- **Sedang:** integritas data, kinerja, biaya.
- **Rendah:** kebersihan kode.

**Kolom "Ditangani di":**
- **G2** = PR hotfix legacy;
- **Fase N** = migrasi v2;
- **Cutover** = saat pindah ke v2.

## 1. Keamanan

| ID | Tingkat | Temuan | Bukti | Ditangani di |
|---|---|---|---|---|
| R-01 | Kritis | Password plaintext ke-26 akun ada di kode dan riwayat git; dipakai sebagai fallback login bila Supabase error atau region tidak ditemukan | `api/auth.js:8-35`, `:80-90`; seed `supabase/schema.sql` (sekitar baris 125–151); kemungkinan juga `Code.js:1` | Rotasi password (langkah manual c) + G2 butir 5 |
| R-02 | Kritis | `api/kebunTK.js` **tanpa autentikasi**. Siapa pun dapat `updateTK`/`addKebun`/`deleteKebun` dengan mengirim `region=ADMIN`. Cek region pada `addKebun` selalu lolos karena identitas pengguna dan region tujuan dibaca dari parameter yang sama | `api/kebunTK.js:4` (import tidak dipakai), `:68-70`, `:165-406`, `:348` | G2 butir 1; Fase 3C |
| R-03 | Tinggi | Endpoint baca tanpa token: realisasi `getData`/`getRunningTextData`, estimasi `getEstimasi`, palmops `get`, `getTarget`, `getLaporan`, `getKebun` | `api/realisasi.js:65`; `api/estimasi.js:43`; `api/palmops.js:15`; `api/targetChallenge.js:20`; `api/laporanRealisasi.js:20`; `api/kebunTK.js:107` | Fase 3 (endpoint publik bertoken baca-saja; sisanya wajib sesi) |
| R-04 | Tinggi | IDOR (lihat daftar di bawah tabel) | `api/sap.js:71`, `:180-212`; `api/vendor.js:46-134`, `:155-168` | G2 butir 4; Fase 3C |
| R-05 | Tinggi | **Password dikirim lewat GET** (query string) karena semua request `jsonpRequest` memakai GET. Server dev mencetak `req.url` ke log, dan log Vercel kemungkinan juga mencatatnya. Token sesi dikirim di URL iframe SAP dan halaman SAP juga membaca `localStorage` | `login.html:4659-4673`, `:4920`; `dev-server.js:41-44`; `login.html:5150`; `sap_admin.html:335`, `:346-358` | G2 butir 3; Fase 3A (POST + cookie httpOnly) |
| R-06 | Tinggi | Rate limit login tidak berjalan; konstanta ada tetapi tidak dipakai | `api/auth.js:5-6` | Fase 3A (tabel `login_attempts`) |
| R-07 | Tinggi | **Bug heartbeat.** Klien mengirim action `refreshToken`, server hanya mengenal `refresh`. Akibatnya muncul alert "Sesi Anda berakhir: Action tidak dikenal." dan pengguna regional **dipaksa logout 30 menit setelah login** | `login.html:4242`, `:5015-5030`; `api/auth.js:123-129` | G2 butir 2 |
| R-08 | Tinggi (perlu verifikasi) | `check_password` bersifat SECURITY DEFINER tanpa REVOKE. Bila EXECUTE masih dimiliki `anon`, fungsi ini bisa dipakai menebak password lewat RPC tanpa rate limit | `supabase/schema.sql:156-175` | Fase 0 tugas 6 (cek grant); Fase 2 (REVOKE) |
| R-09 | Tinggi (perlu verifikasi) | Bucket `surat_files` publik dengan policy upload terbuka untuk siapa pun. Tabel `data_kebun_tk` punya policy publik SELECT/INSERT/UPDATE (dapat ditulis memakai anon key) | `supabase_setup_storage.sql:2-14`; `supabase/setup_kebun_tk_table.sql:33-36` | Fase 0 tugas 6 (cek policy aktif); Fase 2 / Cutover |
| R-10 | Sedang | Upload base64 hingga 50 MB lewat JSON melebihi batas body Vercel Function (4,5 MB). Nama objek ditentukan klien dengan `upsert: true`, sehingga berkas lain bisa tertimpa | `api/sap.js:45-68`, `:133-139` | Fase 3C (*signed upload URL*, nama dari server) |
| R-11 | Sedang | CSP mengizinkan `unsafe-eval`/`unsafe-inline` karena Babel standalone; React *development build* dan Tailwind Play CDN dipakai di produksi | `vercel.json:52`; `laporan_produksi.html:63`, `:134-138`; `rekap_tk_panen.html:31-35` | Fase 1/9 (build Vite, CSP ketat) |
| R-12 | Sedang | `xlsx@0.18.5` punya celah *prototype pollution* dan ReDoS, padahal dipakai untuk mem-parse berkas unggahan pengguna | `laporan_produksi.html:144`, `:2152`, `:3069`, `:3595`; `qc_admin.html:47`, `:802`; `FORMAT_ESTIMASI_PANEN.html:14`; `package.json` | Fase 6 (SheetJS ≥ 0.20.3 dari cdn.sheetjs.com atau exceljs) |
| R-16 | **Kritis (perlu verifikasi)** | Tanpa `.vercelignore`, berkas repo kemungkinan disajikan sebagai aset statis publik (daftar di bawah tabel) | `git ls-files`; tidak ada `.vercelignore` | Verifikasi oleh Anda: buka `https://agri-pam.id/Kode2.gs`. Bila status 200, tambahkan `.vercelignore` (usulan perluasan G2) dan rotasi secret terkait |
| R-17 | Sedang | Halaman SAP mengirim `postMessage({action:'closeSAP'}, '*')` tanpa target origin; perlu dicek apakah listener di parent memvalidasi `event.origin` | `sap_admin.html:376`; `sap_regional.html:196` | Fase 6 (tanpa iframe) |
| R-18 | Rendah | `ip_address` sesi diambil dari parameter klien `ip` (hasil `api.ipify.org`), sehingga bisa dipalsukan | `api/auth.js:48`; `login.html:6707` | Fase 3A (IP dari proxy tepercaya) |

Rincian R-04 (IDOR):
- `insertSurat` menerima `asal_surat` sehingga surat bisa dibuat atas nama region lain;
- `saveSuratDocx` dapat menimpa berkas surat mana pun;
- vendor `update` menerima kolom apa saja untuk record mana pun (*mass assignment*);
- `generate-spk` tidak memeriksa pemilik record.

Rincian R-16 (berkas yang kemungkinan terpapar):
- `Code.js` (`REGION_PASSWORDS`), `Kode2.gs` (secret ConvertAPI, token Fonnte), `Migrasi.gs`;
- `supabase/*.sql` (seed password);
- `data_kebun_tk.json(.bak)`, `.xlsx`/`.csv`, skrip `.py`.

## 2. Bug fungsional

| ID | Tingkat | Temuan | Bukti | Ditangani di |
|---|---|---|---|---|
| R-13 | Sedang | Polling tiap 1 detik: `getSurat` mengunduh **semua** surat setiap detik untuk setiap tab admin, dan notifikasi permohonan juga tiap 1 detik | `login.html:5101-5111`; `FORMAT_ESTIMASI_PANEN.html:1004` | Fase 5 (15–30 detik) |
| R-15 | Sedang (perlu verifikasi) | CSP memblokir fitur produksi: `html2pdf.js` dari `cdnjs.cloudflare.com` tidak ada di `script-src`, sehingga ekspor PDF Rencana & Realisasi diduga gagal. `fetch` ke Supabase Storage tidak ada di `connect-src`, sehingga pratinjau dokumen SAP diduga gagal | `vercel.json:52`; `laporan_produksi.html:147`, `:3850`; `sap_admin.html:1280`; `sap_regional.html:444` | Verifikasi lewat DevTools Console produksi; Fase 6 |
| R-19 | Tinggi | **Alur revisi realisasi diduga rusak.** Persetujuan "Buka Real. Produksi" hanya mengubah `delete_requests`, sedangkan simpan realisasi memeriksa `unlock_requests`, yang tetap PENDING. Baris PENDING itu juga memblokir permohonan buka akses estimasi untuk tanggal yang sama | `api/unlockRequest.js:26-45`; `FORMAT_ESTIMASI_PANEN.html:1838-1882`, `:1941`; `api/deleteRequest.js:74-78`; `api/realisasi.js:132-137`; `api/unlockRequest.js:48-53` | Dibuktikan di staging (Fase 0 tugas 7); diperbaiki di Fase 3C (bisa juga sebagai hotfix legacy bila disetujui) |
| R-20 | Sedang | Persetujuan hapus tidak atomik (data dihapus dulu, status diubah kemudian). Persetujuan tidak pernah kedaluwarsa dan berlaku untuk semua jam (BR-12) | `api/deleteRequest.js:62-82` | Fase 3C (transaksi / fungsi SQL) |
| R-21 | Sedang | Format dan slot `jam` tidak divalidasi server. Nilai di luar format menghasilkan `NaN` sehingga cek jam masa depan lolos | `api/realisasi.js:157-165` | Fase 3B (`parseJamToHour`); audit data Fase 0 tugas 6 |
| R-22 | Sedang | `kebunTK.js` membalas `success` walaupun penulisan Supabase gagal (hanya `console.error`), dan menulis JSON ke disk yang read-only di Vercel. Melanggar aturan "No Silent Fallback" di `.agents/AGENTS.md` | `api/kebunTK.js:223-273`, `:311-323`, `:387-399` | G2 butir 1; Fase 3C |
| R-23 | Rendah | Klien Supabase memakai URL/key placeholder bila env kosong, sehingga proses start tanpa error dan baru gagal saat dipakai | `api/lib/supabase.js:28-29` | Fase 1 (`config/env.ts` gagal start) |
| R-24 | Rendah | `id="mainSection"` dipakai dua kali | `login.html:2978`, `:3132` | Fase 5 |
| R-25 | Rendah | `window.alert` diganti toast secara global, sehingga pesan penting seperti logout paksa R-07 bisa hilang dalam toast | `shadcn_overrides.js:49` | Fase 4 (`useAlert`) |

## 3. Kinerja & biaya

| ID | Tingkat | Temuan | Bukti |
|---|---|---|---|
| R-26 | Sedang | `getData` selalu menjalankan 10 query paralel × 1000 baris, dan `getEstimasi` 5 query, meskipun datanya sedikit | `api/realisasi.js:69-99`; `api/estimasi.js:48-73` |
| R-27 | Sedang | Setiap request `kebunTK` membaca seluruh tabel `data_kebun_tk` dan berkas JSON | `api/kebunTK.js:73-102` |
| R-28 | Rendah | Versi CDN tidak dipatok: `chart.js` tanpa versi dan `lucide@latest`, sehingga perubahan upstream bisa merusak halaman tanpa peringatan | `login.html:2834`; `laporan_produksi.html:141`; `rekap_tk_panen.html:38`; `one-agripam.html:1117` |

## 4. Kode mati, duplikasi, sinkronisasi skema

| ID | Temuan | Bukti |
|---|---|---|
| R-14a | Guard halaman hanya di klien (sessionStorage); data hanya terlindungi sejauh API memeriksanya | `laporan_produksi.html:8-56`; `qc_admin.html:10-39`; `vendor_monitoring.html:10-34` |
| R-14b | SQL di repo tidak sinkron dengan produksi (lihat daftar di bawah tabel) | `supabase/schema.sql:208-218` |
| R-29 | Fungsi global didefinisikan dua kali; definisi kedua yang berlaku: `showConfirm`, `renderInlineAlert`, `renderReuiRevisionAlert` | `shadcn_overrides.js:284`/`:483`, `:371`/`:587`, `:416`/`:632` |
| R-30 | Konstanta yang sama diulang di banyak berkas: luasan Kalbar 1A/1B di 5 berkas, slot jam di 5 tempat, CRO map, "hari ini WIB" | `docs/business-rules.md` BR-07, BR-10, BR-30, BR-32 |
| R-31 | Kode/berkas mati atau kandidat usang (lihat daftar di bawah tabel) | lihat `docs/inventory-pages.md` §1 |

Rincian R-14b (SQL tidak sinkron):
- CHECK `delete_requests.type` hanya memuat REALISASI/ESTIMASI, padahal kode menulis UNLOCK_REALISASI;
- `unlock_requests`, `target_challenge_bulanan`, `laporan_realisasi_panen` tidak ada di berkas SQL mana pun, padahal ketiganya terbukti ada di database (audit run 1, `docs/db-audit-results/README.md`);
- `profiles` + trigger `handle_new_user` (Supabase Auth) ada di `supabase_setup_sap.sql:7`, `:80`, tetapi API tidak memakai Supabase Auth.

Rincian R-31 (kandidat usang):
- `formatTimeWindow` (`api/realisasi.js:14-28`, tidak dipanggil);
- stub `api/logout.js`;
- tabel `vendor_rahasia` (tidak dipakai API);
- `@supabase/supabase-js` yang dimuat tetapi tidak dipakai (`sap_*.html:12`);
- `admin.html`, `admin-screenshot.html`, `loginPANDUAN.html`, `test_react_event.html` (status TIDAK DIKETAHUI);
- `temp.jsx`, `scratch/`, dan sekitar 100 skrip patch `.py` di root.

## 5. Ringkasan prioritas

1. **Segera (legacy, G2 / tindakan Anda):**
   - verifikasi R-16 (berkas sumber terpapar);
   - rotasi password dan secret: R-01, ditambah R-16 bila terbukti;
   - hotfix R-02, R-07, R-05 (password lewat POST), R-04.
2. **Fase 0 tugas 6–7 (staging):** buktikan atau bantah R-08, R-09, R-15, R-19 dan R-21 dengan data nyata.
3. **Fase 2–3 (v2):** R-03, R-06, R-10, R-12, R-20, R-22, R-26, R-27.
