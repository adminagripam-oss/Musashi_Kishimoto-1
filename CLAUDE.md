# CLAUDE.md - Panduan Kolaborasi Proyek AGRIPAM & agripam-v2

Dokumen ini adalah instruksi kerja dan pedoman resmi untuk **Claude Code** saat beroperasi di repositori ini.

---

## 1. Arsitektur Kolaborasi: Claude Code & Antigravity

Proyek ini dikembangkan secara kolaboratif oleh dua AI Agent bersama USER:
- **Claude Code (Anda):** Bertanggung jawab atas eksekusi CLI/terminal, scripting (Node.js/Python), integrasi API/backend, migrasi SQL/Supabase, dan validasi kode via terminal.
- **Antigravity (IDE Agent):** Bertanggung jawab atas perancangan UI/Visual, integrasi CSS/shadcn, validasi visual browser langsung, inspeksi DevTools, dan refactoring komponen kompleks.

### Protokol Handoff & Single Active Agent
1. **Single Active Agent per Task:** Hanya satu agen yang aktif memodifikasi kode pada satu siklus pengerjaan fitur untuk menghindari file race condition / overwriting.
2. **Cek Pelacak Sebelum Bekerja:** Sebelum memulai task apa pun, periksa berkas `AGENT_HANDOFF.md` di root untuk memastikan status terakhir dan konteks serah terima.
3. **Catat Setelah Selesai:** Setelah menyelesaikan tugas, wajib perbarui `AGENT_HANDOFF.md`:
   - Ubah status & tandai `Next Responsible Agent` (misal diserahkan ke `Antigravity` untuk validasi UI).
   - Cantumkan daftar file yang dimodifikasi.
   - Berikan instruksi serah terima yang jelas untuk agen selanjutnya.

---

## 2. Aturan Mutlak Proyek (Non-Negotiable)

Aturan-aturan berikut selaras 100% dengan `.agents/AGENTS.md` dan **WAJIB** dipatuhi tanpa pengecualian:

### A. Backend-First Verification & Silent Fallback Prohibition Rule
1. **Verifikasi Skema Database Terlebih Dahulu:** Dilarang keras membuat input UI, kolom tabel, atau endpoint API yang menerima atribut data baru tanpa MEMVERIFIKASI terlebih dahulu bahwa tabel database (Supabase/PostgreSQL) sudah memiliki kolom tersebut.
2. **Dilarang Silent Local JSON Fallback di Produksi:** Berkas JSON lokal (seperti `data_kebun_tk.json`) HANYA boleh diperlakukan sebagai fallback *read-only* saat offline. Penulisan data baru WAJIB melempar error (*fail loud*) jika kolom Supabase belum ada, bukan diam-diam menyimpan ke file lokal sementara.
3. **Wajib SQL Migration Script:** Setiap perubahan data schema WAJIB menyertakan berkas skrip migrasi SQL (`.sql`) yang terverifikasi dan mendapat konfirmasi eksekusi dari user sebelum fitur dinyatakan selesai.

### B. Region Naming & Aggregation Harmonization Rule
1. **Label Region Standar:** Selalu gunakan **`Sumut 2`** sebagai nama region resmi untuk seluruh 10 kebun Sumut 2 (termasuk `Bukit Harapan I`).
2. **Normalisasi Modal Aggregation:** Normalisasi setiap nama region yang mengandung `"Sumatera Utara 2"` atau `"Torganda"` menjadi **`Sumut 2`** agar seluruh kebun Sumut 2 diagregasikan ke satu baris di bawah **CRO I** dalam `MonitorTKModal`.
3. **Pemetaan Autentikasi:** Pertahankan `'Sumut 2': 'ROSUMUT2'` di `LOCAL_REGIONS_MAP` (`api/auth.js`) untuk kelancaran login autentikasi.

### C. TK Panen Data Structure & KPI Cut-Off Rule
1. **Bulan Cut-Off Default:** Selalu gunakan **Oktober** (`tk_oktober` / `Oktober`) sebagai default cut-off month untuk kalkulasi kartu KPI dan ringkasan metrik.
2. **Sub-Kolom Ketersediaan TK Panen (11 Kolom):**
   `TK Mei`, `TK Juni`, `Trend (Jun vs Mei)`, `TK Juli`, `Trend (Jul vs Jun)`, `TK Ags`, `Trend (Ags vs Jul)`, `TK Sep`, `Trend (Sep vs Ags)`, `TK Okt`, `Trend (Okt vs Sep)`.
3. **Sub-Kolom Rencana Pemenuhan TK Panen (5 Kolom):**
   `Rencana Jul`, `Rencana Ags`, `Rencana Sep`, `Rencana Okt`, `Rencana Nov`.
4. **Persistensi Sinkron:** Pastikan handler `addKebun` dan `updateTK` di `api/kebunTK.js` serta form modal (Edit Kebun & Tambah Kebun) membaca, memvalidasi, dan menyimpan `tk_oktober` dan `target_november`.

### D. TK Panen New Month Column Expansion Checklist
Jika menambahkan kolom bulan baru (misal Oktober, November, dst.), ikuti urutan berikut:
1. **Database First:** Buat migrasi SQL (`ALTER TABLE data_kebun_tk ADD COLUMN IF NOT EXISTS ...`).
2. **Backend API (`api/kebunTK.js`):** Tambahkan di Supabase fetch mapping loop, `fullPayload`, dan `safePayload`.
3. **Frontend UI (`login.html` & `laporan_produksi.html`):** Table header, row rendering, dan Edit/Add modals.
4. **Excel Export Synchronization (`laporan_produksi.html`):** `headerRow1` colspans, `headerRow2` headers, formula `totalRowHtml`, dan `<colgroup>`.
5. **Verifikasi:** Uji nilai dengan restart dev server dan verifikasi export Excel.
6. **Perbarui Dokumentasi:** Perbarui `.agents/AGENTS.md` dan `CLAUDE.md`.

---

## 3. Konteks Migrasi & Ruang Lingkup Proyek

Proyek ini mencakup dua area kerja yang saling beririsan:
1. **AGRIPAM (Legacy):** Berjalan dengan Node.js vanilla/HTML/Apps Script/Express (`laporan_produksi.html`, `login.html`, `api/*`). Berfungsi sebagai baseline kebenaran fungsional (*source of truth business rules*).
2. **agripam-v2 (Next-Gen):** Monorepo TypeScript strict, Express API (`/api/v1/*`), Vite React 19, shadcn/ui.
   - Rujukan keputusan: lihat `docs/decisions.md` dan `docs/business-rules.md`.
   - Database migrasi bersifat *expand-only* (tidak boleh merusak struktur yang masih dipakai legacy selama masa paralel).

---

## 4. Perintah Umum & Panduan Operasional

- **Menjalankan Dev Server Legacy:**
  ```powershell
  node --env-file=.env dev-server.js
  # atau
  ./run-dev.bat
  ```
- **Uji Endpoint:**
  ```powershell
  curl -s http://localhost:3000/api/health
  ```
- **Git State:**
  - Pastikan selalu cek `git status` dan branch aktif sebelum melakukan perubahan.
  - Dokumentasikan commit secara teratur dengan format yang jelas.
