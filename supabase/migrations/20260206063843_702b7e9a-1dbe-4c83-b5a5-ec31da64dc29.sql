-- Create storage bucket for document uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('documents', 'documents', true, 52428800); -- 50MB limit

-- Allow anyone to upload files (public form)
CREATE POLICY "Anyone can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'documents');

-- Allow anyone to read documents (for Bpium to fetch)
CREATE POLICY "Anyone can read documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents');

-- Allow anyone to delete their uploaded documents (by path)
CREATE POLICY "Anyone can delete documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'documents');