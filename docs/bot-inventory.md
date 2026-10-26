# Inventaris Bot Screenshot

Fase 0, tugas 8. **Status: MENUNGGU skrip bot** dari repo GitHub terpisah (ditempel oleh pemilik). Bagian yang bertanda TIDAK DIKETAHUI diisi setelah skrip diterima.

## 1. Yang sudah diketahui dari repo ini

### Kandidat halaman yang dipotret

Semua halaman berikut bisa dibuka tanpa login dan memanggil endpoint tanpa token.

| Halaman | Bukti | Data |
|---|---|---|
| `rekap_tk_panen.html` | PRD 2026-08-19: "halaman kloning publik … untuk bot screenshot tanpa login", mendukung Fit to Screen / Fit to Paper dan default Light Mode | `/api/kebunTK?action=getKebun&region=ALL` (`:218`) |
| `rekap-cro-fullscreen.html` | Halaman fullscreen tanpa guard, refresh tiap 5 menit (`:213`) | `/api/realisasi?action=getData&region=ALL` (`:220`) |
| `table-modal-fullscreen.html` | Halaman fullscreen tanpa guard, refresh tiap 5 menit (`:234`) | `/api/estimasi?action=getEstimasi&region=ALL` (`:241`) |
| `admin-screenshot.html` | Judul "Screenshot Mode"; sesi admin palsu `token: "screenshot-mode"` (`:892`) | endpoint publik |

### Otomasi laporan lain (bukan bot website)

- `Kode2.gs` (Google Apps Script, berjalan di Google Drive) mengekspor **spreadsheet** ke PDF (`:39`, `:230`), mengubahnya menjadi JPG lewat ConvertAPI (`:49`, `:249`), lalu mengirimnya ke WhatsApp lewat Fonnte (`:168-173`, `:290-296`). Alur ini tidak memotret website.
- `Code.js` (backend GAS lama, tidak aktif menurut `README.md:33`) masih berisi handler screenshot: `handleUploadScreenshot` (`:1008`), `handleSendScreenshotSummary` (`:1043`), `handleSendActiveDashboardScreenshot` (`:1128`).
- `README.md:111-119` menyebut loop 30 detik di `index.html` yang memicu screenshot pukul 06.00–17.30. Loop itu **tidak ada lagi** di kode sekarang (`index.html` hanya redirect), dan tombol `btn-screenshot-harian`/`-sore` di `admin.html:243-259` / `loginPANDUAN.html:299-315` tinggal CSS tanpa pemakai. Dokumentasi README sudah usang.

## 2. Yang perlu diisi dari skrip bot (TIDAK DIKETAHUI)

| Butir | Isi |
|---|---|
| URL yang dipotret (lengkap dengan query string) | TIDAK DIKETAHUI |
| Viewport (lebar × tinggi, deviceScaleFactor) dan mode (fullPage / elemen) | TIDAK DIKETAHUI |
| Selector atau waktu tunggu sebelum screenshot | TIDAK DIKETAHUI |
| Jadwal cron (zona waktu; bila GitHub Actions, jadwal dalam UTC) | TIDAK DIKETAHUI |
| Format laporan (gambar, caption, tujuan grup WhatsApp, gateway: Fonnte?) | TIDAK DIKETAHUI |
| Apakah bot login, atau hanya membuka halaman publik | TIDAK DIKETAHUI |
| Penanganan galat dan retry | TIDAK DIKETAHUI |

Dokumen ini menjadi dasar `docs/bot-contract.md` (Fase 7).
