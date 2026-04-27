import { supabase } from "@/integrations/supabase/client";
import * as tus from "tus-js-client";
import { SUPABASE_BASE_URL, SUPABASE_ANON_KEY } from "@/lib/apiBase";

const SUPABASE_URL = SUPABASE_BASE_URL;

// Файлы крупнее этого порога заливаем resumable-протоколом TUS (чанками, с автоматическими ретраями)
const TUS_THRESHOLD_BYTES = 6 * 1024 * 1024; // 6 МБ — рекомендация Supabase
const TUS_CHUNK_SIZE = 6 * 1024 * 1024;
const BUCKET = "documents";

function buildFilePath(file: File): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 10);
  const ext = file.name.split(".").pop() || "bin";
  const fileName = `${timestamp}-${randomId}.${ext}`;
  return `uploads/${fileName}`;
}

function isFailedToFetch(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return /failed to fetch|networkerror|load failed/i.test(msg);
}

function describeUploadError(err: unknown): string {
  if (isFailedToFetch(err)) {
    return (
      "Не удалось связаться с хранилищем. " +
      "Проверьте интернет-соединение или попробуйте ещё раз через минуту."
    );
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Загрузка маленьких файлов напрямую через REST Storage API.
 * Не используем supabase-js .upload() — он шлёт multipart с заголовком
 * x-upsert, который ломает CORS-preflight через прокси.
 *
 * REST endpoint принимает чистое тело файла и возвращает 200/201.
 * upsert передаём query-параметром, никаких нестандартных заголовков нет.
 */
async function uploadViaRest(file: File, filePath: string): Promise<void> {
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filePath}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
      "content-type": file.type || "application/octet-stream",
      "cache-control": "3600",
    },
    body: file,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Storage REST upload error:", res.status, text);
    throw new Error(
      `Ошибка загрузки файла (HTTP ${res.status}): ${text || res.statusText}`,
    );
  }
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
        apikey: SUPABASE_ANON_KEY,
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: BUCKET,
        objectName: filePath,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      chunkSize: TUS_CHUNK_SIZE,
      onError: (error) => {
        console.error("TUS upload error:", error);
        reject(new Error(`Ошибка загрузки файла: ${describeUploadError(error)}`));
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
 * Маленькие файлы — обычным POST через REST (без supabase-js — иначе ломается CORS).
 * Крупные — через TUS resumable.
 */
export async function uploadDocumentFile(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const filePath = buildFilePath(file);

  try {
    if (file.size >= TUS_THRESHOLD_BYTES) {
      await uploadViaTus(file, filePath, onProgress);
    } else {
      await uploadViaRest(file, filePath);
      onProgress?.(100);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Ошибка загрузки файла")) {
      throw err;
    }
    throw new Error(`Ошибка загрузки файла: ${describeUploadError(err)}`);
  }

  // Публичная ссылка должна вести на исходный домен Supabase, а не на прокси,
  // чтобы Bpium / другие внешние системы могли её открыть напрямую.
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return urlData.publicUrl;
}

/**
 * Delete file from Supabase Storage
 */
export async function deleteDocumentFile(fileUrl: string): Promise<void> {
  const match = fileUrl.match(/\/documents\/(.+)$/);
  if (!match) return;

  const filePath = match[1];

  const { error } = await supabase.storage.from(BUCKET).remove([filePath]);

  if (error) {
    console.error("Storage delete error:", error);
  }
}
