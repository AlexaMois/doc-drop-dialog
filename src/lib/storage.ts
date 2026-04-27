import { supabase } from "@/integrations/supabase/client";
import * as tus from "tus-js-client";
import { SUPABASE_BASE_URL, SUPABASE_ANON_KEY } from "@/lib/apiBase";

const SUPABASE_URL = SUPABASE_BASE_URL;

// Файлы крупнее этого порога заливаем resumable-протоколом TUS (чанками, с автоматическими ретраями)
const TUS_THRESHOLD_BYTES = 6 * 1024 * 1024; // 6 МБ — рекомендация Supabase
const TUS_CHUNK_SIZE = 6 * 1024 * 1024;

function buildFilePath(file: File): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 10);
  const ext = file.name.split('.').pop() || 'bin';
  const fileName = `${timestamp}-${randomId}.${ext}`;
  return `uploads/${fileName}`;
}

/**
 * Загрузка большого файла через TUS (resumable upload).
 * Переживает кратковременные обрывы сети — клиент автоматически ретраит чанки.
 */
function uploadViaTus(
  file: File,
  filePath: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: "documents",
        objectName: filePath,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      chunkSize: TUS_CHUNK_SIZE,
      onError: (error) => {
        console.error("TUS upload error:", error);
        reject(new Error(`Ошибка загрузки файла: ${error.message || "сетевая ошибка"}`));
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        if (onProgress && bytesTotal > 0) {
          onProgress(Math.round((bytesUploaded / bytesTotal) * 100));
        }
      },
      onSuccess: () => resolve(),
    });

    // Возобновляем с предыдущей попытки, если был обрыв
    upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length > 0) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }
      upload.start();
    });
  });
}

/**
 * Upload file to Supabase Storage and return public URL.
 * Маленькие файлы — обычным POST, крупные — через TUS resumable.
 */
export async function uploadDocumentFile(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const filePath = buildFilePath(file);

  if (file.size >= TUS_THRESHOLD_BYTES) {
    await uploadViaTus(file, filePath, onProgress);
  } else {
    const { error } = await supabase.storage
      .from("documents")
      .upload(filePath, file, { cacheControl: "3600", upsert: false });

    if (error) {
      console.error("Storage upload error:", error);
      throw new Error(`Ошибка загрузки файла: ${error.message}`);
    }
    onProgress?.(100);
  }

  const { data: urlData } = supabase.storage
    .from("documents")
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

/**
 * Delete file from Supabase Storage
 */
export async function deleteDocumentFile(fileUrl: string): Promise<void> {
  const match = fileUrl.match(/\/documents\/(.+)$/);
  if (!match) return;

  const filePath = match[1];

  const { error } = await supabase.storage
    .from("documents")
    .remove([filePath]);

  if (error) {
    console.error("Storage delete error:", error);
  }
}
