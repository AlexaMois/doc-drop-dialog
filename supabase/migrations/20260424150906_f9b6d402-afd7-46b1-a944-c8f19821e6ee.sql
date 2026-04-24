-- Drop overly permissive DELETE policy on documents storage bucket
DROP POLICY IF EXISTS "Anyone can delete documents" ON storage.objects;

-- Replace broad SELECT (listing) with scoped read: keep public read of individual objects via public URL,
-- but disallow listing through the API. Public URL access does not require this policy when bucket is public.
DROP POLICY IF EXISTS "Anyone can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can read documents" ON storage.objects;