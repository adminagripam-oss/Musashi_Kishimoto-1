-- ============================================================
-- AGRIPAM — Penambahan Kolom Oktober (Ketersediaan) & November (Rencana)
-- Jalankan di: Supabase Dashboard > SQL Editor
-- Project: https://wcocmwkccntmmtlofowe.supabase.co
-- ============================================================
-- Tujuan: Menambahkan kolom tk_oktober dan target_november 
-- ke tabel data_kebun_tk agar data tidak hilang (persistent)
-- ============================================================

ALTER TABLE data_kebun_tk
ADD COLUMN IF NOT EXISTS tk_oktober INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS target_november INT DEFAULT 0;

-- Verifikasi kolom berhasil ditambahkan
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'data_kebun_tk' 
  AND column_name IN ('tk_oktober', 'target_november');
