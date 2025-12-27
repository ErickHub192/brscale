-- Create storage bucket for legal documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'legal-documents',
  'legal-documents',
  false, -- Private bucket, requires authentication
  10485760, -- 10MB limit per file
  ARRAY['application/pdf']::text[]
);

-- Storage policies for legal documents
CREATE POLICY "Service role has full access to legal documents"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'legal-documents')
WITH CHECK (bucket_id = 'legal-documents');

CREATE POLICY "Authenticated users can view their own legal documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'legal-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Authenticated users can upload their own legal documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'legal-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
