-- =====================================================================
-- G3 — PROPOSED hardening of the legacy database. NOT YET RUN.
-- Run ONLY after the owner approves, on STAGING first, then production.
--
-- Closes what the 2026-10-26 audit confirmed (docs/db-schema.md):
--   R-08  anon/authenticated may EXECUTE check_password (A5, A6)
--   R-09  data_kebun_tk is readable/writable through open policies (A8)
--   R-09  bucket surat_files: anyone may upload and list objects (A8, A9)
--   R-33  surat/log_tracking/profiles grant rights to "authenticated"
-- This applies Fase 2 steps 3-4 early to the legacy database.
--
-- Safe for the legacy app: every page talks to the database through
-- api/ with the service role (no HTML page creates a Supabase client or
-- calls the REST/storage endpoints), the service role bypasses RLS, and
-- it keeps its own EXECUTE grant on check_password.
-- Buckets stay public until cutover: api/sap.js uses getPublicUrl
-- (:63, :143, :203), and public URLs do not need a SELECT policy.
--
-- Two transactions: if part 2 is refused (storage.objects owned by
-- another role), part 1 stays applied; then delete the two storage
-- policies in Dashboard > Storage > Policies instead.
-- Verify afterwards: run docs/db-audit.sql again and check A5-A8.
-- Rollback: commented block at the end.
-- =====================================================================

-- Part 1: schema public ------------------------------------------------
BEGIN;

-- R-08: only the API (service_role, explicit grant in A5) may call these.
REVOKE EXECUTE ON FUNCTION public.check_password(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_sessions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- R-09: data_kebun_tk is written only by api/kebunTK.js (service role).
DROP POLICY IF EXISTS "Allow public insert on data_kebun_tk" ON public.data_kebun_tk;
DROP POLICY IF EXISTS "Allow public select on data_kebun_tk" ON public.data_kebun_tk;
DROP POLICY IF EXISTS "Allow public update on data_kebun_tk" ON public.data_kebun_tk;
CREATE POLICY block_public ON public.data_kebun_tk FOR ALL TO public USING (false);

-- R-33: Supabase Auth is not used (profiles is empty, no page signs in
-- with it), so the auth.uid() policies only matter to someone who
-- creates an account; close them like the other tables.
DROP POLICY IF EXISTS "Admin bisa melihat semua surat" ON public.surat;
DROP POLICY IF EXISTS "Admin bisa mengedit semua surat" ON public.surat;
DROP POLICY IF EXISTS "Regional bisa menambah surat" ON public.surat;
DROP POLICY IF EXISTS "Regional melihat surat sendiri" ON public.surat;
CREATE POLICY block_public ON public.surat FOR ALL TO public USING (false);

DROP POLICY IF EXISTS "Admin bisa melihat semua log" ON public.log_tracking;
DROP POLICY IF EXISTS "Admin bisa menambah log" ON public.log_tracking;
DROP POLICY IF EXISTS "Regional bisa melihat log suratnya" ON public.log_tracking;
CREATE POLICY block_public ON public.log_tracking FOR ALL TO public USING (false);

DROP POLICY IF EXISTS "User bisa melihat profiles" ON public.profiles;
CREATE POLICY block_public ON public.profiles FOR ALL TO public USING (false);

COMMIT;

-- Part 2: storage -------------------------------------------------------
BEGIN;

-- R-09: uploads to surat_files go through api/sap.js (service role).
DROP POLICY IF EXISTS "Allow Uploads" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

COMMIT;


-- =====================================================================
-- ROLLBACK (only if the legacy app breaks after G3). Re-opens the
-- exposures above; definitions copied from audit block A8.
-- =====================================================================
-- GRANT EXECUTE ON FUNCTION public.check_password(text, text) TO PUBLIC, anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.cleanup_expired_sessions() TO PUBLIC, anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.handle_new_user() TO PUBLIC, anon, authenticated;
--
-- DROP POLICY IF EXISTS block_public ON public.data_kebun_tk;
-- CREATE POLICY "Allow public insert on data_kebun_tk" ON public.data_kebun_tk FOR INSERT TO public WITH CHECK (true);
-- CREATE POLICY "Allow public select on data_kebun_tk" ON public.data_kebun_tk FOR SELECT TO public USING (true);
-- CREATE POLICY "Allow public update on data_kebun_tk" ON public.data_kebun_tk FOR UPDATE TO public USING (true);
--
-- DROP POLICY IF EXISTS block_public ON public.surat;
-- CREATE POLICY "Admin bisa melihat semua surat" ON public.surat FOR SELECT TO public
--   USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role));
-- CREATE POLICY "Admin bisa mengedit semua surat" ON public.surat FOR UPDATE TO public
--   USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role));
-- CREATE POLICY "Regional bisa menambah surat" ON public.surat FOR INSERT TO public
--   WITH CHECK (dibuat_oleh = auth.uid());
-- CREATE POLICY "Regional melihat surat sendiri" ON public.surat FOR SELECT TO public
--   USING (dibuat_oleh = auth.uid());
--
-- DROP POLICY IF EXISTS block_public ON public.log_tracking;
-- CREATE POLICY "Admin bisa melihat semua log" ON public.log_tracking FOR SELECT TO public
--   USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role));
-- CREATE POLICY "Admin bisa menambah log" ON public.log_tracking FOR INSERT TO public
--   WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role));
-- CREATE POLICY "Regional bisa melihat log suratnya" ON public.log_tracking FOR SELECT TO public
--   USING (EXISTS (SELECT 1 FROM surat WHERE surat.id = log_tracking.surat_id AND surat.dibuat_oleh = auth.uid()));
--
-- DROP POLICY IF EXISTS block_public ON public.profiles;
-- CREATE POLICY "User bisa melihat profiles" ON public.profiles FOR SELECT TO public
--   USING (auth.role() = 'authenticated'::text);
--
-- CREATE POLICY "Allow Uploads" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'surat_files');
-- CREATE POLICY "Public Access" ON storage.objects FOR SELECT TO public USING (bucket_id = 'surat_files');
