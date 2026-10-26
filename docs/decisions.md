# Catatan Keputusan Migrasi AGRI-PAM v2

Setiap keputusan menyebut tanggal, status, dan alasannya.

Status:
- **Disetujui:** sudah dikonfirmasi pemilik produk.
- **Usulan:** menunggu konfirmasi.
- **Terbuka:** belum diputuskan.

## Keputusan arsitektur

| ID | Tanggal | Keputusan | Status | Alasan |
|---|---|---|---|---|
| D1 | 2026-10-26 | TypeScript strict di semua paket | Disetujui (spesifikasi) | Ditetapkan di bagian STACK TARGET / KONVENSI KODE spesifikasi |
| D2 | 2026-10-26 | **React 19**, bukan React 18 seperti di spesifikasi | Disetujui | Komponen shadcn/ui versi Tailwind v4 sudah menghapus `forwardRef`. Dengan React 18, ref tidak sampai ke DOM pada pola `asChild` Radix (Popover, Dropdown, Tooltip, Dialog) |
| D3 | 2026-10-26 | API Express di **Render atau Railway** dengan domain `api.agri-pam.id` (staging `api-staging.agri-pam.id`); web Vite di Vercel; sesi di cookie `HttpOnly; Secure; SameSite=Lax` host-only di domain API | Disetujui. **Terbuka:** pilihan Render vs Railway | Web dan API berada di *registrable domain* yang sama, jadi cookie tetap *first-party*. Domain `*.onrender.com` / `*.up.railway.app` tidak boleh dipakai untuk login |
| D3a | 2026-10-26 | CORS: allowlist persis dari env `CORS_ORIGIN` dengan credentials. CSRF: untuk method yang mengubah data, wajib `Origin` dalam allowlist + `Content-Type: application/json` + header `X-Requested-With` | Usulan | Konsekuensi teknis D3 |
| D3b | 2026-10-26 | Region server di Singapura, satu lokasi dengan project Supabase; instance berbayar yang tidak *sleep* | Usulan (lokasi Supabase dicek di tugas 6) | Tier gratis Render tidur setelah idle |
| D4 | 2026-10-26 | **Tanpa alias** path API lama di backend baru; v2 hanya melayani `/api/v1/*` | Disetujui | Legacy-v1 tetap berjalan dengan `api/` miliknya selama masa paralel (Fase 9); alias akan menghidupkan pola tidak aman (password lewat GET) |
| D5 | 2026-10-26 | Hotfix keamanan legacy sebagai PR terpisah `fix/legacy-security-hotfix`; tidak di-merge atau di-deploy tanpa izin | Disetujui | Legacy tetap menjadi produksi selama migrasi (lihat `docs/risks.md` R-01, R-02, R-04, R-05, R-07) |
| D6 | 2026-10-26 | Tema Terang / Gelap / Sistem. Bawaan Terang, key `agripam_theme`, atribut `data-theme` | Usulan | Paritas dengan legacy (bawaan `light`), ditambah opsi Sistem agar adaptif |
| D7 | 2026-10-26 | Repo v2 di `D:\AGRINAS PALMA NUSANTARA\agripam-v2` (repo git baru) | Disetujui | Spesifikasi Fase 1. Pembuatan repo GitHub dilakukan pemilik karena `gh` belum terpasang |
| D8 | 2026-10-26 | Semua modul aktif ikut dimigrasi: Vendor, QC, PalmOps, LHP, Target Challenge, Infografis, portal, panduan, halaman fullscreen. Berkas usang tidak dimigrasi | Disetujui (bersama rencana) | Permintaan awal: "perbaiki autentikasi setiap pages". Daftar usang di `docs/inventory-pages.md` |
| D9 | 2026-10-26 | Toast memakai **Sonner**; style shadcn `new-york` | Usulan | Komponen `toast` shadcn sudah deprecated |
| D10 | 2026-10-26 | Grafik: react-chartjs-2 + plugin legacy dipindahkan; warna dari CSS variable; animasi mati di rute bot | Usulan | Paritas visual plugin kustom (persentase ▲/▼) |
| D11 | 2026-10-26 | Excel: ekspor dengan exceljs; parsing dengan SheetJS ≥ 0.20.3 (cdn.sheetjs.com) atau exceljs + papaparse | Usulan | `xlsx@0.18.5` punya celah keamanan (`docs/risks.md` R-12) |
| D12 | 2026-10-26 | Migrasi DB *expand-only* selama masa paralel: memakai ulang `data_kebun_tk`, `delete_requests` dan `unlock_requests` (bukan tabel baru); tanpa rename/drop sampai legacy dimatikan | Usulan | Legacy dan v2 memakai database yang sama selama masa paralel; tabel baru akan membuat datanya berbeda |
| D13 | 2026-10-26 | Paritas visual: label, urutan dan warna semantik mengikuti legacy; kerangka tampilan (layout, tipografi, input, dialog) mengikuti shadcn. Selisih yang disengaja dicatat di dokumen ini | Usulan | Menyatukan permintaan "UI berkiblat shadcn" dengan aturan paritas visual di spesifikasi |
| D14 | 2026-10-26 | *Fit to screen* / *fit to page*: shell `h-dvh`, tanpa scroll horizontal halaman pada lebar ≥ 360 px, tabel lebar dalam container scroll dengan header dan kolom pertama *sticky*, mode layar penuh, cetak A4 landscape | Usulan | Permintaan awal pemilik |
| D15 | 2026-10-26 | Polling: dashboard 30 detik (paritas), notifikasi 15–30 detik (menggantikan 1 detik) | Usulan | `docs/risks.md` R-13 |

## Koreksi terhadap spesifikasi (kode legacy adalah kebenaran)

| ID | Butir spesifikasi | Koreksi | Bukti |
|---|---|---|---|
| K1 | Slot jam 07.00–18.00 | 12 slot: 06.00–16.00 + 17.30 | `docs/business-rules.md` BR-07 |
| K2 | Realisasi `PUT` upsert | *Insert* + *delete*, kecuali Q-BR-7 memutuskan lain | BR-15 |
| K3 | Tonase ≥ 0 | 0–5000 | BR-14 |
| K4 | Tidak ada aturan tanggal estimasi | Hari ini/besok WIB + unlock (server); 22.00 WIB H-1 (klien) | BR-17, BR-18 |
| K5 | Tanggal bawaan menurut zona region | WIB untuk semua region, kecuali Q-BR-3 memutuskan lain | BR-10 |
| K6 | Toggle Restan memulihkan nilai + kolom `is_tidak_panen` | Mengosongkan nilai, tidak disimpan; Estimasi Kirim tetap aktif | BR-22 |
| K7 | SAP = truk/driver/PKS/netto | SAP = Sistem Administrasi Persuratan (surat, log, berkas, .docx) | BR-47; `login.html:5121` |
| K8 | 2 peran | 3 peran: `admin`, `regional`, `qc` | BR-02 |
| K9 | Satu tabel permohonan + kolom `decided_by`/`decided_at` | Dua tabel; kolom `resolved_by`/`resolved_at` sudah ada | BR-25 – BR-28 |
| K10 | Tabel baru `kebun_tk` | Pakai `data_kebun_tk`; bulan sampai `tk_september`/`target_oktober`; tambah DELETE | BR-33 – BR-36 |
| K11 | Tambah `restan_lalu`, `tk_panen`, unique estimasi | Sebagian besar sudah ada (`tk_panen_hk`, UNIQUE `(tanggal, region)`) | `api/estimasi.js:170-182`; `supabase/schema.sql:52` |

## Keputusan yang masih ditunggu dari pemilik

- Langkah manual Fase 0:
  - **a.** tag `legacy-v1`;
  - **b.** project Supabase staging;
  - **c.** rotasi password;
  - **e.** screenshot baseline.
- Halaman yang dipotret bot beserta viewport-nya (menunggu skrip bot → `docs/bot-inventory.md`).
- Q-BR-1 sampai Q-BR-9 (`docs/business-rules.md`).
- Render atau Railway (D3).
