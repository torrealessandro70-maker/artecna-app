-- SOLO fixture locale: la baseline schema-only non include il servizio Supabase Storage.
-- Replica esclusivamente il catalogo minimo necessario alle policy; nessuna prova S3/API.
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (
 id text PRIMARY KEY, name text NOT NULL, public boolean NOT NULL DEFAULT false,
 file_size_limit bigint, allowed_mime_types text[]
);
CREATE TABLE storage.objects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text REFERENCES storage.buckets(id),
 name text NOT NULL, metadata jsonb, owner_id text, UNIQUE(bucket_id,name)
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage,auth TO authenticated,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated,anon;
