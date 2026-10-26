# Aturan Bisnis Legacy (AGRI-PAM v1)

Fase 0, tugas 4. Basis kode: commit `661b817`. Menurut spesifikasi migrasi, **kode legacy adalah kebenaran perilaku**. Kolom "Beda dengan PRD/spesifikasi" mencatat setiap ketidakcocokan dengan `prd.md` atau spesifikasi Fase 0–9. Butir bertanda **Q-BR** menunggu keputusan pemilik produk (daftar di bagian akhir).

## A. Akun, peran, sesi

| No | Aturan | Lokasi | Beda dengan PRD/spesifikasi |
|---|---|---|---|
| BR-01 | Login memakai nama **region** + password, tanpa username individu. Ada 26 entri akun: 23 region, 2 alias Sumut 2, `ADMIN`, `QC admin` | `api/auth.js:8-35`, `:46-113` | PRD menyebut 23 region + 1 ADMIN; `QC admin` tidak disebut |
| BR-02 | Tiga peran dengan halaman tujuan berbeda: `ADMIN` → `laporan_produksi.html`, `QC admin` → `qc_admin.html`, region lain → dashboard di `login.html` | `login.html:4940-4949` | PRD dan spesifikasi hanya mengenal 2 peran |
| BR-03 | Sesi JWT berlaku **mutlak 8 jam** dan sah hanya bila baris `sesi_aktif` berstatus `Aktif`. Action `refresh` tidak memperpanjang apa pun | `api/lib/auth.js:5`, `:14-20`, `:49-59`; `api/auth.js:123-127` | PRD/fitur menyebut heartbeat memperpanjang sesi; heartbeat juga rusak (lihat `docs/risks.md` R-07) |
| BR-04 | Klien memberi peringatan 15 menit sebelum sesi habis | `login.html:4387-4401` | Tidak disebut di PRD |
| BR-05 | Satu sesi per browser: login di tab baru memaksa logout tab lama lewat BroadcastChannel `agripam_bc`. Server **tidak** membatasi sesi paralel (login hanya menambah baris `sesi_aktif`) | `login.html:4266-4327`, `api/auth.js:101-110` | `agripam_features_module.md` (era GAS) menyebut sesi lama dibatalkan di perangkat lain. Q-BR-9 |
| BR-06 | Rate limit login 5×/10 menit **tidak berjalan**: konstantanya ada tetapi tidak dipakai | `api/auth.js:5-6` | PRD 3.1 mewajibkan rate limit |

## B. Realisasi per jam

| No | Aturan | Lokasi | Beda dengan PRD/spesifikasi |
|---|---|---|---|
| BR-07 | Ada **12 slot jam**: 06.00, 07.00, 08.00, 09.00, 10.00, 11.00, 12.00, 13.00, 14.00, 15.00, 16.00, **17.30**. Server tidak memvalidasi slot maupun format jam | `login.html:5456`, `:7453-7464`; `laporan_produksi.html:469`, `:976`; `rekap-cro-fullscreen.html:156` | PRD dan spesifikasi menyebut 07.00–18.00 |
| BR-08 | Jam masa depan ditolak: `Date.UTC(tanggal, jam) − offset > waktu server`. Pesan kesalahan menyebut waktu server lokal region | `api/realisasi.js:157-174` | Cocok |
| BR-09 | Zona waktu: **WITA (UTC+8)** untuk Kalimantan Selatan 1 & 2, Kalimantan Timur, Kalimantan Utara, Sulawesi Tenggara, Sulawesi Tengah; region lain **WIB (UTC+7)** | `api/realisasi.js:8-12` | Cocok |
| BR-10 | "Hari ini" dan "bulan berjalan" untuk penguncian dihitung dengan **WIB untuk semua region**, termasuk region WITA. Tanggal bawaan dashboard juga hari ini menurut WIB | `api/realisasi.js:34-39`, `:124-129`; `login.html:4965-4975` | Spesifikasi 5A.1 mengasumsikan zona region. Q-BR-3 |
| BR-11 | Simpan pada tanggal lampau **atau di luar bulan berjalan** wajib punya `unlock_requests` berstatus `APPROVED` untuk `(region, tanggal)`. ADMIN dikecualikan | `api/realisasi.js:123-155` | Cocok dengan PRD 3.7 dan rilis 2026-08-03 |
| BR-12 | Persetujuan berlaku untuk **semua jam** pada tanggal itu, untuk realisasi **dan** estimasi sekaligus (tabel tidak membedakan jenis), dan **tidak pernah kedaluwarsa** | `api/realisasi.js:132-137`, `api/estimasi.js:144-149` | Tidak diatur di PRD. Q-BR-6 |
| BR-13 | Hapus jam pada tanggal lampau wajib punya `unlock_requests` APPROVED. **Tanpa pengecualian ADMIN** dan **tanpa cek bulan** | `api/realisasi.js:204-221` | Tidak sejajar dengan BR-11 |
| BR-14 | Tonase harus **0–5000** | `api/realisasi.js:5-6`, `:176-178` | Spesifikasi hanya menyebut ≥ 0 |
| BR-15 | Data jam yang sudah ada **tidak dapat ditimpa**: harus "Hapus Jam Ini" lalu diisi ulang | `api/realisasi.js:180-186` | Spesifikasi 3C meminta upsert. Q-BR-7 |
| BR-16 | Akun regional hanya bisa menulis region miliknya, karena `verifyToken(token, region)` mencocokkan region dengan token. Akibatnya ADMIN pun tidak dapat menulis realisasi untuk region lain | `api/realisasi.js:111`, `:200` | — |

## C. Estimasi panen harian

| No | Aturan | Lokasi | Beda dengan PRD/spesifikasi |
|---|---|---|---|
| BR-17 | Server hanya menerima estimasi untuk **hari ini atau besok (WIB)**, termasuk lintas bulan. Tanggal lain wajib punya `unlock_requests` APPROVED, kecuali ADMIN. Aturan yang sama berlaku untuk hapus | `api/estimasi.js:136-165`, `:202-217` | Tidak ada di PRD maupun spesifikasi |
| BR-18 | Klien menutup pengisian dan penyimpanan draft untuk tanggal X pada **X-1 pukul 22.00 WIB**, kecuali status unlock APPROVED. Server **tidak** menegakkan aturan ini | `login.html:6433-6456`, `:6379-6384` | Ada di `agripam_features_module.md`, tidak ada di PRD maupun spesifikasi. Q-BR-2 |
| BR-19 | Semua field wajib diisi. Batas: Luas Panen 0–999.999; Restan Lalu, Estimasi Panen, Estimasi Kirim, Estimasi Restan 0–999.999.999; TK Panen 0–99.999. Server hanya mengecek NaN | `login.html:6428-6495`; `api/estimasi.js:132-134` | — |
| BR-20 | Output Panen (kg/HK) = Estimasi Panen ÷ TK Panen. Klien menghitung lalu menyimpan nilainya (`output_panen`); server menghitung ulang per region dengan pembulatan saat membaca | `api/estimasi.js:100-105`, `:128` | — |
| BR-21 | Simpan estimasi bersifat upsert per `(tanggal, region)`. ADMIN boleh menulis untuk region mana pun | `api/estimasi.js:117-122`, `:167-189` | Cocok |
| BR-22 | Toggle "Hanya Pengiriman Restan" (lihat daftar di bawah tabel) | `login.html:6330-6364`, `:6410-6417` | PRD 3.3 cocok sebagian. Pemulihan nilai dan kolom `is_tidak_panen` di spesifikasi = perilaku baru. Q-BR-4 |
| BR-23 | Draft estimasi disimpan di perangkat dengan key `draft_estimasi_<region>_<tanggal>` | `login.html:6366-6399` | Tidak disebut di PRD |
| BR-24 | Modal status wilayah: region yang sudah mengisi berlatar **hijau #16a34a + ✓**, yang belum berlatar **merah #dc2626 + ◯** | `FORMAT_ESTIMASI_PANEN.html:1713-1723` | PRD hanya menyebut kondisi hijau |

Rincian BR-22 (toggle "Hanya Pengiriman Restan"):
- Warna dan label: hijau `#28a745` "Status: Aktif Panen (Klik jika Tidak Panen)"; merah `#dc3545` "Status: Hanya Pengiriman Restan (Aktif)".
- Saat merah, enam field di-nol-kan dan dikunci: Luas Panen, Restan Lalu, TK Panen, Estimasi Panen, Estimasi Restan, Output Panen. **Estimasi Kirim tetap bisa diisi.**
- Saat kembali hijau, field bernilai "0" **dikosongkan**, tidak dipulihkan.
- Status toggle tidak disimpan ke server.

## D. Permohonan hapus dan buka akses

| No | Aturan | Lokasi | Beda dengan PRD/spesifikasi |
|---|---|---|---|
| BR-25 | Ada dua tabel. `delete_requests` menampung `REALISASI` dan `ESTIMASI` (hapus data) serta `UNLOCK_REALISASI` (revisi realisasi). `unlock_requests` (tanpa jenis) menampung buka akses estimasi dan salinan permohonan revisi. Satu permohonan PENDING per kunci | `api/deleteRequest.js:18-37`; `api/unlockRequest.js:18-63` | PRD hanya mengenal `delete_requests` |
| BR-26 | Admin menyetujui `REALISASI`/`ESTIMASI`: data dihapus dulu, baru status diubah (tidak atomik). Untuk `UNLOCK_REALISASI`, hanya status yang berubah | `api/deleteRequest.js:62-82` | — |
| BR-27 | Panel admin menggabungkan kedua tabel dan menghapus duplikat berdasarkan `region + tanggal + jam`, dengan baris `delete_requests` didahulukan | `FORMAT_ESTIMASI_PANEN.html:1838-1882` | — |
| BR-28 | Label tipe: `Buka Real. Produksi` (UNLOCK/REVISI_REALISASI); `Buka Est. Panen` (`unlock_requests` lainnya); `Hapus ` + tipe, jadi `Hapus REALISASI` / `Hapus ESTIMASI` | `FORMAT_ESTIMASI_PANEN.html:1846-1865` | PRD menyebut label `Hapus Data` |
| BR-29 | Hanya token ADMIN yang dapat melihat dan memutus permohonan | `api/deleteRequest.js:40`, `:49`; `api/unlockRequest.js:144`, `:164` | Cocok |

**Dugaan bug pada alur revisi (bukti kode, akan dibuktikan di staging):**
1. `requestRevision` menulis dua baris: satu di `delete_requests` dan satu di `unlock_requests`.
2. Panel admin hanya menampilkan baris `delete_requests` (BR-27). Menyetujuinya hanya mengubah `delete_requests` (BR-26).
3. Simpan realisasi memeriksa `unlock_requests` (BR-11), yang masih PENDING. Akibatnya **revisi tetap tertolak**.
4. Baris PENDING yang tersisa juga membuat permohonan buka akses estimasi untuk tanggal yang sama ditolak sebagai duplikat (`api/unlockRequest.js:48-53`).

## E. Region, CRO, luasan

| No | Aturan | Lokasi | Beda dengan PRD/spesifikasi |
|---|---|---|---|
| BR-30 | Pemetaan CRO (lihat daftar di bawah tabel) | `laporan_produksi.html:522-545` | Q-BR-5 |
| BR-31 | Nama resmi **`Sumut 2`**. `Sumatera Utara 2 Ex Torganda` / `Torganda` dinormalisasi ke nama ini | `.agents/AGENTS.md`; `api/kebunTK.js:17`, `:87-89`; `api/auth.js:11-12` | Q-BR-8 (akun mana yang resmi di tabel `regions`) |
| BR-32 | Luasan Planted Kalbar 1A = 39.838,88 Ha dan Kalbar 1B = 38.117,11 Ha. Kalbar 1 = 1A + 1B. Total Planted 444.447 Ha. Papua Selatan dikeluarkan dari agregat | `FORMAT_ESTIMASI_PANEN.html:813-814`; `laporan_produksi.html:3336-3337`, `:5080`; `rekap_tk_panen.html:168-169`; `table-modal-fullscreen.html:178-179`; `login.html:1855` | Cocok dengan PRD 2026-07-25 / 2026-08-07. Konstanta yang sama diulang di 5 berkas |

Rincian BR-30 (pemetaan CRO):

| CRO | Region |
|---|---|
| I | Aceh, Sumatera Utara 1, Sumut 2 |
| II | Riau 1 |
| III | Riau 2, Riau 3 |
| IV | Riau 4 |
| V | Sumatera Barat, Jambi, Bangka Belitung |
| VI | Kalimantan Barat 1A, 1B, 2 |
| VII | Kalimantan Selatan 1, 2, Kalimantan Timur, Kalimantan Utara |
| VIII | Kalimantan Tengah 1, 3 |
| IX | Kalimantan Tengah 2 |
| X | Sulawesi Tenggara, Sulawesi Tengah |

**Sumatera Selatan** ada di `ALL_REGIONS` tetapi tidak masuk CRO mana pun.

## F. TK Panen (data kebun)

| No | Aturan | Lokasi | Beda dengan PRD/spesifikasi |
|---|---|---|---|
| BR-33 | Kolom Ketersediaan (9): TK Juni, TK Juli, Trend (Jul vs Jun), TK Ags, Trend (Ags vs Jul), TK Sep, Trend (Sep vs Ags), SD Ags, SD Sep. Kolom Rencana Pemenuhan (4): Jul, Ags, Sep, Okt | `.agents/AGENTS.md` | Spesifikasi 6B.3 hanya sampai Agustus/September |
| BR-34 | Bulan cut-off KPI **September** (`tk_september`) di-*hardcode* di server | `api/kebunTK.js:136-139` | Spesifikasi 6B.5 meminta diambil dari tabel pengaturan |
| BR-35 | Field yang dapat diubah: `req_tk`, `luasan`, `tk_juni`, `tk_juli`, `tk_agustus`, `tk_september`, `target_juli`, `target_agustus`, `target_september`, `target_oktober` (semua ≥ 0). Regional dan admin sama-sama boleh mengubah `req_tk` dan `luasan` | `api/kebunTK.js:189-218`; PRD 2026-08-19 | Cocok |
| BR-36 | Pencocokan region kebun bersifat *fuzzy*. Kalbar 1A dan 1B sama-sama menjadi `KALBAR 1` sehingga saling dapat mengubah. ID kebun baru = `max(896, maxId + 1)` | `api/kebunTK.js:10-40`, `:116`, `:362` | Q-BR-5 |
| BR-37 | Pada modal Tambah Kebun, akun regional mendapat CRO dan Region terisi otomatis dan terkunci; admin bebas. Kunci ini hanya di UI, server tidak menegakkannya | PRD 2026-08-19; `api/kebunTK.js:344-358` | — |
| BR-38 | Ekspor Excel TK Panen: header #4BACC6, Arial tebal, rata tengah, garis 0,5 pt, ikon trend diganti ▲ (hijau) / ▼ (merah). `<colgroup>` 20 kolom | `laporan_produksi.html:4325-4405`; `.agents/AGENTS.md`; PRD 2026-08-11 | Cocok |
| BR-39 | Panel Executive Intelligence Highlight: latar #d9d9d9, emas #B8860B, teks hitam/putih adaptif | `laporan_produksi.html:4115`; PRD 2026-08-11 | Cocok |

## G. Dashboard, filter, pengumuman

| No | Aturan | Lokasi | Beda dengan PRD/spesifikasi |
|---|---|---|---|
| BR-40 | Mode tanggal admin (lihat daftar di bawah tabel) | `laporan_produksi.html:5933-5961` | Tidak disebut di PRD |
| BR-41 | Running text menampilkan produksi kumulatif semua region dan % terhadap estimasi; diperbarui tiap 30 detik | `login.html:4714`, `:4880-4905`, `:7025` | Spesifikasi aturan 9 melarang regional membaca data region lain. Q-BR-1 |
| BR-42 | Refresh otomatis: dashboard admin versi `login.html` tiap 30 detik; **dashboard admin `laporan_produksi.html` tidak refresh otomatis**; halaman fullscreen tiap 5 menit | `login.html:5051-5066`; `laporan_produksi.html:5963-6028`; `rekap-cro-fullscreen.html:213` | Fitur lama menyebut admin auto-update 30 detik |
| BR-43 | Notifikasi: badge SAP (surat berstatus `menunggu`) dan permohonan baru di-*polling* tiap 1 detik, hanya untuk ADMIN | `login.html:5080-5111`; `FORMAT_ESTIMASI_PANEN.html:1004` | — |
| BR-44 | Pop-up Agripam Update tampil sekali setelah login berhasil (500 ms), dilewati saat refresh (`sessionStorage agripam_update_shown`; key dihapus saat logout) | `login.html:4383`, `:4985`; `shadcn_overrides.js:697-804` | Cocok |
| BR-45 | Dialog konfirmasi: tombol `emerald-600` (varian sukses / Oke) dan `emerald-800` (varian Revisi); tombol REVISI pada alert inline `bg-emerald-800` | `shadcn_overrides.js:547`, `:550`, `:646`, `:675` | Cocok |
| BR-46 | Tombol "Input Laporan Panen" berwarna cyan #46bdc6 di baris Filter; tombol tutup berbentuk silang merah berbingkai | PRD 2026-08-07 (lokasi di `login.html`: **perlu dicek**) | — |

Rincian BR-40 (mode tanggal admin):

| Mode | Rentang |
|---|---|
| `TUNGGAL` | satu tanggal |
| `SD_BULAN_INI` | 1 Januari sampai tanggal acuan |
| `SD_HARI_INI` | tanggal 1 bulan berjalan sampai tanggal acuan |
| `KUSTOM` | bebas |

## H. Modul lain

| No | Aturan | Lokasi |
|---|---|---|
| BR-47 | SAP Persuratan: surat baru berstatus `menunggu`; admin mengubah status, dan setiap perubahan dicatat di `log_tracking`; surat balasan berstatus `Sudah dikirim ke Regional`; berkas maksimal 50 MB; regional hanya melihat suratnya sendiri | `api/sap.js:27`, `:50`, `:71`, `:116-118`, `:158` |
| BR-48 | Vendor: status bawaan `Menunggu Jawaban Region`, tahap `Tahap 1`; SPK mengubah status menjadi `Penerbitan SPK`; regional hanya membuat dan melihat data region sendiri | `supabase_setup_vendor.sql:19`, `:25`; `api/vendor.js:31-34`, `:117`, `:140` |
| BR-49 | PalmOps: tonase per `(tanggal, region)`, diunggah admin, dibandingkan dengan realisasi di Validasi Data | `api/palmops.js`; `laporan_produksi.html:2102` |
| BR-50 | Target Challenge: target bulanan disimpan sebagai JSON per `bulan`. Parser format baru mengenali kolom `CRO / Wilayah`, `Regional`, `Tgl 1-31`, melewati baris Subtotal CRO, lalu menghitung subtotal sendiri | `api/targetChallenge.js`; `laporan_produksi.html:3028`; PRD 2026-08-03 |
| BR-51 | LHP / Laporan Realisasi disimpan sebagai JSON per tanggal. Deteksi kolom: TBS Kirim (F), TBS Panen (M) | `api/laporanRealisasi.js`; `laporan_produksi.html:3366`; PRD 2026-08-11 |

## Pertanyaan untuk pemilik produk (Q-BR)

- **Q-BR-1** Isolasi region: apakah regional tetap boleh melihat agregat nasional (running text BR-41, modal status BR-24), tetapi bukan baris detail region lain?
- **Q-BR-2** Apakah batas H-1 pukul 22.00 WIB (BR-18) juga ditegakkan di server pada v2?
- **Q-BR-3** "Hari ini" untuk penguncian dan tanggal bawaan: tetap WIB untuk semua region (BR-10), atau zona masing-masing region?
- **Q-BR-4** Toggle Restan (BR-22): tetap seperti legacy, atau nilai dipulihkan dan statusnya disimpan?
- **Q-BR-5** Sumatera Selatan masuk CRO mana (BR-30)? Apakah Kalbar 1A dan 1B memang berbagi data kebun (BR-36)?
- **Q-BR-6** Persetujuan revisi (BR-12): berlaku selamanya untuk semua jam, atau sekali pakai / berbatas waktu? Apakah persetujuan estimasi dan realisasi dipisah?
- **Q-BR-7** Realisasi (BR-15): tetap *insert* + "Hapus Jam Ini", atau boleh menimpa langsung?
- **Q-BR-8** Akun resmi Sumut 2 di tabel `regions`: `Sumut 2` atau `Sumatera Utara 2 Ex Torganda` (BR-31)?
- **Q-BR-9** Sesi tunggal (BR-05): cukup per browser seperti legacy, atau satu sesi aktif per region yang ditegakkan server?
