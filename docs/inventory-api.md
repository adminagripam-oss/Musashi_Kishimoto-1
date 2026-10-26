# Inventaris API Legacy (`api/*.js`)

Fase 0, tugas 2. Basis kode: commit `661b817`.

**Cara kerja handler:** semua handler berupa fungsi `module.exports = async (req, res)` (pola Vercel Function). Saat lokal, handler dijalankan oleh `dev-server.js:75-94` (`/api/:route` → `api/<route>.js`).

**Parameter:** kecuali `vendor` dan `qcSheet`, parameter dibaca dari `req.body` untuk POST dan dari `req.query` untuk method lain. Frontend utama (`jsonpRequest`, `login.html:4659`) mengirim **semua** request lewat GET dengan query string.

**Format respons:** hampir semua error dikembalikan sebagai HTTP 200 dengan `{ success: false, message }`. Hanya `vendor` dan `qcSheet` yang memakai kode 401/403/405/500.

## 1. Pustaka bersama (`api/lib`)

| Berkas | Isi | Catatan |
|---|---|---|
| `lib/auth.js` | `signToken(region)`: JWT HS256 `{ region }`, `expiresIn: '8h'` (`:14-20`). `verifyToken(token, expectedRegion)` (`:30-62`): cek tanda tangan + kedaluwarsa, cocokkan `decoded.region` bila `expectedRegion` diisi, lalu cari baris `sesi_aktif` dengan `token` sama dan `status = 'Aktif'` | `SESSION_TTL_MS` 8 jam. Proses gagal start bila `JWT_SECRET` kosong (`:7-9`) |
| `lib/supabase.js` | Klien service role dengan `persistSession: false` | Bila env kosong, dipakai URL/key **placeholder** (`:28-29`): proses tetap start, lalu gagal saat dipakai. Juga ada parser `.env` manual (`:6-26`) |
| `lib/cors.js` | Allowlist `https://agri-pam.id`, `https://www.agri-pam.id`, `http://localhost:3000`; method GET/POST/OPTIONS; header Content-Type; credentials true | — |

## 2. Handler per handler

Kolom **Auth** berarti: `verifyToken(token, X)`. **Tidak ada** berarti endpoint terbuka.

### 2.1 `auth.js`

| Action | Parameter | Auth | Aturan | Tabel | Respons |
|---|---|---|---|---|---|
| `login` | `region`, `password`, `ip`, `clientTime` | — | Region harus `is_active`, lalu RPC `check_password`. **Fallback** ke `LOCAL_REGIONS_MAP` berisi password plaintext bila query Supabase error atau region tidak ditemukan (`:80-90`). Konstanta rate limit `:5-6` **tidak dipakai** | `regions` (baca), `sesi_aktif` (insert; error diabaikan `:110`) | `{success, message, token, ttlMs}` |
| `logout` | `token`, `region` | tidak ada (hanya update) | Ubah status sesi menjadi `Logout` | `sesi_aktif` | `{success, message}` |
| `refresh` | `token`, `region` | `verifyToken(token, region)` | **Tidak memperpanjang apa pun**; JWT tetap kedaluwarsa 8 jam setelah login | `sesi_aktif` (baca) | `{success, message, ttlMs}` |
| lainnya (termasuk `refreshToken` dari klien) | — | — | — | — | `{success:false, message:'Action tidak dikenal.'}` |

`ip_address` diambil dari parameter klien `ip` (hasil `api.ipify.org`) dengan fallback `x-forwarded-for` (`:48`), sehingga bisa dipalsukan.

### 2.2 `logout.js`

Stub yang selalu membalas sukses (`:3-9`).

### 2.3 `realisasi.js`

| Action | Parameter | Auth | Aturan bisnis | Tabel | Respons |
|---|---|---|---|---|---|
| `getData`, `getRunningTextData` | `tanggal`, `tanggal_akhir?`, `region` (`ALL`/nama) | **tidak ada** | Selalu 10 query paralel × 1000 baris (`:69-99`) | `database_input` | `{success, total, jamData, allRecords}` |
| `insert` | `token`, `region`, `tanggal`, `jam`, `tonase` | `verifyToken(token, region)` | Lihat daftar di bawah tabel | `database_input`, `unlock_requests` | `{success, message, total, jamData}` |
| `delete` | `token`, `region`, `tanggal`, `jam` | `verifyToken(token, region)` | Tanggal < hari ini (WIB) wajib punya `unlock_requests` APPROVED, tanpa pengecualian ADMIN dan tanpa cek bulan (`:204-221`) | `database_input`, `unlock_requests` | `{success, message, total, jamData}` |

Aturan `insert`, dicek berurutan:
1. Tanggal lampau atau di luar bulan berjalan (keduanya dihitung dengan **WIB**) wajib punya `unlock_requests` APPROVED untuk `(region, tanggal)`, kecuali akun ADMIN (`:123-155`).
2. Jam masa depan ditolak. Target waktu = `Date.UTC(tanggal, jam) − offset`, dengan offset 7 jam (WIB) atau 8 jam (WITA, daftar `:8-12`) (`:157-174`).
3. Tonase harus 0–5000 (`:176-178`).
4. Jam yang sudah terisi ditolak: "Gunakan 'Hapus Jam Ini'" (`:180-186`).
5. **Format `jam` tidak divalidasi.** Nilai seperti `abc` menghasilkan `NaN` dan lolos cek masa depan.

### 2.4 `estimasi.js`

| Action | Parameter | Auth | Aturan bisnis | Tabel | Respons |
|---|---|---|---|---|---|
| `getEstimasi` | `tanggal`, `tanggal_akhir?`, `region` | **tidak ada** | 5 query paralel × 1000 baris. `outPanen` per region = `round(estPanen / tkPanen)` | `data_estimasi` | `{success, exists, allEstimasi, data, allRecords}` |
| `insertEstimasi` | `token`, `region`, `tanggal`, `estimasiRestanLalu`, `luasPanen`, `tkPanen`, `estimasiPanen`, `outputPanen`, `estimasiKirim`, `estimasiRestan` | `verifyToken(token, null)`; region harus sama dengan token kecuali ADMIN (`:120`) | Hanya hari ini atau besok (WIB). Selain itu wajib `unlock_requests` APPROVED kecuali ADMIN (`:136-165`). Upsert manual: select lalu update/insert (`:167-189`). **Batas 22.00 WIB H-1 tidak ada di server** | `data_estimasi`, `unlock_requests` | `{success, message}` |
| `deleteEstimasi` | `token`, `region`, `tanggal` | sama | Aturan tanggal sama | `data_estimasi` | `{success, message}` |

Kolom yang ditulis: `restan_lalu`, `luas_panen_ha`, `tk_panen_hk`, `estimasi_panen_kg`, `output_panen`, `estimasi_kirim_kg`, `estimasi_restan_kg` (`:170-182`).

### 2.5 `deleteRequest.js`

Semua action memakai `verifyToken(token, region)` (`:15`).

| Action | Parameter | Peran | Aturan | Tabel |
|---|---|---|---|---|
| `requestDelete` | `type` (huruf besar; **tanpa whitelist**), `tanggal`, `jam` | semua | Tolak duplikat PENDING. `jam` hanya disimpan untuk REALISASI/UNLOCK_REALISASI | `delete_requests` |
| `getDeleteRequests` | — | ADMIN | Hanya status PENDING, urut `requested_at` menurun | `delete_requests` |
| `resolveDeleteRequest` | `requestId`, `resolveAction` (APPROVE/REJECT) | ADMIN | APPROVE menghapus data dulu (`database_input` atau `data_estimasi`), baru mengubah status. **Tidak atomik.** Untuk UNLOCK_REALISASI hanya status yang berubah | `delete_requests`, `database_input`, `data_estimasi` |

### 2.6 `unlockRequest.js`

Semua action memakai `verifyToken(token, region)` (`:15`).

| Action | Parameter | Peran | Aturan | Tabel |
|---|---|---|---|---|
| `requestUnlock` | `tanggal` | semua | Buka akses estimasi; tolak duplikat PENDING | `unlock_requests` |
| `requestRevision` (atau `type=REVISI_REALISASI`) | `tanggal` | semua | Insert `delete_requests` (UNLOCK_REALISASI, **tanpa jam**) dan `unlock_requests` (error diabaikan) (`:26-45`) | keduanya |
| `checkRevisionStatus` | `tanggal` | semua | Status terbaru `delete_requests` UNLOCK_REALISASI; fallback ke `unlock_requests` | keduanya |
| `checkUnlock` | `tanggal`, `jam?` | semua | Dengan `jam`: cari `delete_requests` UNLOCK_REALISASI dengan jam yang sama. Baris dari `requestRevision` (jam null) tidak pernah cocok. Tanpa `jam`: status terbaru `unlock_requests` | keduanya |
| `getUnlockRequests`, `getRevisionRequests` | — | ADMIN | Hanya PENDING. Filter `type = REVISI_REALISASI` dengan fallback bila kolom `type` tidak ada (`:147-158`) | `unlock_requests` |
| `resolveUnlockRequest`, `resolveRevisionRequest` | `requestId`, `resolveAction` | ADMIN | Ubah status, `resolved_at`, `resolved_by` | `unlock_requests` |

Catatan: cek APPROVED di realisasi dan estimasi **hanya** membaca `unlock_requests`, dan tabel ini tidak membedakan jenis permohonan. Lihat `docs/business-rules.md` BR-12.

### 2.7 `kebunTK.js`

**Tidak ada autentikasi sama sekali.** `verifyToken` di-import (`:4`) tetapi tidak pernah dipanggil.

Setiap request (`:73-102`):
1. membaca `data_kebun_tk.json`;
2. mengambil **seluruh** `data_kebun_tk` dari Supabase;
3. menggabungkan keduanya, dengan JSON sebagai fallback per kolom;
4. menyeragamkan nama `Sumatera Utara 2 Ex Torganda` menjadi `Sumut 2`.

| Action | Parameter | Penentu admin/region | Aturan | Tulis |
|---|---|---|---|---|
| `getKebun` | `filterRegion` / `region` | — | `ADMIN` / kosong / `ALL` berarti semua kebun; selain itu pencocokan *fuzzy* `normalizeRegion` (`:10-40`, `:112-118`). Urut CRO, region, nama. Ringkasan: `totalLuas`, `totalReqTk`, `totalCutOff` (dari `tk_september`), `kekurangTK`; cut-off "September" di-*hardcode* (`:136-139`) | — |
| `updateTK` | `region`, `edits[]` (atau satu objek) | `region === 'ADMIN'` dari **parameter klien** (`:175`) | Field yang dapat diubah: `req_tk` (int), `luasan`, `tk_juni`, `target_juli`, `target_agustus`, `target_september`, `target_oktober`, `tk_juli`, `tk_agustus`, `tk_september` (semua ≥ 0) | Supabase `update` dengan `fullPayload`, lalu `safePayload` bila gagal. Error **hanya di-log** (`:223-262`), lalu JSON ditulis ke disk |
| `deleteKebun` | `region`, `id` | parameter klien | Admin, atau region sama setelah normalisasi | JSON ditulis ke disk + Supabase `delete` (error hanya di-log) |
| `addKebun` | `region`, `nama_kebun`, `cro`, `luasan`, `req_tk`, `tk_*`, `target_*` | `regionParam` **dan** region tujuan sama-sama dibaca dari `p.region` (`:70`, `:348`), dengan `p = {...query, ...body}` | Pengecekan regional selalu lolos. ID baru = `max(896, maxId + 1)` (`:362`) | JSON + Supabase `insert` (error hanya di-log) |

**Normalisasi region:** `Kalimantan Barat 1A` dan `1B` keduanya menjadi `KALBAR 1` (`:18`). Akibatnya region 1A dan 1B dapat mengubah kebun satu sama lain.

### 2.8 `sap.js`: SAP Persuratan

`region` dan `token` wajib diisi, lalu `verifyToken(token, region)` (`:16-23`).

| Action | Peran | Aturan / perilaku | Tabel / Storage |
|---|---|---|---|
| `getSurat` | semua | Non-admin: hanya surat dengan `regional_pengirim = region`. Tanpa paginasi | `surat` |
| `insertSurat` | semua | `regional_pengirim = asal_surat \|\| region`, sehingga **bisa diisi region lain** (`:71`). Berkas base64 maksimal 50 MB diunggah dengan nama dari klien dan `upsert: true` (`:45-68`), lalu disimpan sebagai URL publik | `surat`, bucket `berkas_surat` |
| `updateSurat` | ADMIN | Ubah status/catatan/tujuan/tanggal; bila kolom belum ada, fallback update status saja (`:105-112`). Tambah `log_tracking`. Bisa membuat "Surat Balasan" beserta berkasnya | `surat`, `log_tracking`, bucket `surat_files` |
| `saveSuratDocx` | **semua (tanpa cek pemilik)** | HTML diubah menjadi .docx (html-to-docx), diunggah, lalu `surat.file_url` diganti (`:180-212`) | `surat`, `berkas_surat` |
| `deleteSurat`, `deleteSuratMultiple` | ADMIN | — | `surat` |

### 2.9 `vendor.js`

Token dibaca dari `Authorization: Bearer` / body / query; region dari header `x-region` / body / query. Lalu `verifyToken(token, region)`.

| Method / action | Peran | Perilaku |
|---|---|---|
| GET | semua | Admin melihat semua; regional hanya baris dengan `regional = region` |
| POST `generate-spk` | semua (**tanpa cek pemilik**) | Membuat .docx lalu **menulisnya ke `public/docs` di disk lokal** (`:98-110`). Tidak berfungsi di FS read-only Vercel. Kemudian status menjadi "Penerbitan SPK" |
| POST `create` | semua | Non-admin hanya boleh untuk region sendiri (`:140`) |
| POST `update` | semua (**tanpa cek pemilik**) | `updates` berisi kolom apa saja langsung dikirim ke Supabase (*mass assignment*) (`:155-168`) |

Tabel: `vendor_monitoring` (`vendor_rahasia` ada di SQL tetapi tidak dipakai API).

### 2.10 `qcSheet.js`

Region wajib `QC admin` atau `ADMIN` (`:20`), lalu `verifyToken`. GET membaca dan POST mengubah satu baris `qc_spreadsheet` dengan `id = 00000000-...` berisi kolom `data`, `columns`, `settings`.

### 2.11 `palmops.js`, `targetChallenge.js`, `laporanRealisasi.js`

| Handler | Baca (tanpa auth) | Tulis (ADMIN) | Tabel |
|---|---|---|---|
| `palmops` | `get`: total tonase per region untuk satu tanggal/rentang; paginasi berurutan | `save`: upsert `(tanggal, region)`. `delete`: semua region pada satu tanggal. Auth `verifyToken(token, 'ADMIN')` | `database_palmops` |
| `targetChallenge` | `getTarget`: data JSON per bulan `YYYY-MM` | `saveTarget` (upsert `bulan`), `deleteTarget` | `target_challenge_bulanan` |
| `laporanRealisasi` | `getLaporan`: data JSON per tanggal | `saveLaporan` (upsert `tanggal`), `deleteLaporan` | `laporan_realisasi_panen` |

## 3. Logika yang terduplikasi antara frontend dan backend

| Logika | Backend | Frontend | Risiko |
|---|---|---|---|
| Daftar region WITA dan offset zona | `realisasi.js:8-12` | `login.html` (16 kemunculan `WITA`/`isWita`) | Bisa berbeda bila salah satu diubah |
| Slot jam (12 slot, termasuk 17.30) | tidak divalidasi | `login.html:5456`, `:7453-7464`; `laporan_produksi.html:469`, `:976`; `rekap-cro-fullscreen.html:156` | Server menerima jam apa pun |
| Batas 22.00 WIB H-1 untuk estimasi | tidak ada | `login.html:6433-6456`, `:6379-6384` | Bisa dilewati lewat API langsung |
| Batas angka field estimasi | hanya cek NaN | `login.html:6458-6495` | Bisa dilewati lewat API langsung |
| "Hari ini WIB" | `realisasi.js:34-39`, `estimasi.js:14-31` | `login.html:4701-4712`, `:4965-4975`, `:6434-6436` | Rumus diulang di banyak tempat |
| Output panen (kg/HK) | `estimasi.js:100-105` (dihitung ulang) | dihitung klien lalu disimpan `output_panen` | Dua sumber nilai |
| Normalisasi region (Sumut 2, Kalbar 1) | `kebunTK.js:10-40`, `:87-89` | `laporan_produksi.html`, `login.html` (lihat `.agents/AGENTS.md`) | — |
| Bulan cut-off KPI | `kebunTK.js:136-139` | `login.html`, `laporan_produksi.html` | Wajib diubah serentak tiap bulan |
| Pemetaan CRO → region | — | `laporan_produksi.html:522-534` (juga `admin.html`) | Hanya ada di klien |
