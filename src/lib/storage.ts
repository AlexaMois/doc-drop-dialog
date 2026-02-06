import { supabase } from "@/integrations/supabase/client";

/**
 * Upload file to Supabase Storage and return public URL
 */
export async function uploadDocumentFile(file: File): Promise<string> {
  // Generate unique file name
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 10);
  const ext = file.name.split('.').pop() || 'bin';
  const fileName = `${timestamp}-${randomId}.${ext}`;
  const filePath = `uploads/${fileName}`;

  // Upload to storage
  const { data, error } = await supabase.storage
    .from('documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Storage upload error:', error);
    throw new Error(`Ошибка загрузки файла: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('documents')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

/**
 * Delete file from Supabase Storage
 */
export async function deleteDocumentFile(fileUrl: string): Promise<void> {
  // Extract path from URL
  const match = fileUrl.match(/\/documents\/(.+)$/);
  if (!match) return;

  const filePath = match[1];

  const { error } = await supabase.storage
    .from('documents')
    .remove([filePath]);

  if (error) {
    console.error('Storage delete error:', error);
  }
}
