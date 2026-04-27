import { supabase } from "@/integrations/supabase/client";
import * as tus from "tus-js-client";
import { SUPABASE_BASE_URL, SUPABASE_ANON_KEY, SUPABASE_DIRECT_URL } from "@/lib/apiBase";

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
// Таймаут на одну попытку REST-загрузки. Большие файлы идут через TUS,
// поэтому здесь хватает 2 минут даже для медленных мобильных сетей.
const REST_UPLOAD_TIMEOUT_MS = 120_000;
const REST_UPLOAD_MAX_RETRIES = 2; // 1 основная попытка + 2 ретрая
const REST_UPLOAD_BASE_DELAY_MS = 1000;

const sleepMs = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function uploadViaRest(file: File, filePath: string): Promise<void> {
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filePath}`;

  const loggedHeaders: Record<string, string> = {
    authorization: "Bearer <redacted>",
    "content-type": file.type || "application/octet-stream",
    "cache-control": "3600",
  };
  console.log("[uploadViaRest] Начало загрузки", {
    url,
    headers: loggedHeaders,
    fileSize: file.size,
    fileName: file.name,
    timeoutMs: REST_UPLOAD_TIMEOUT_MS,
  });

  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= REST_UPLOAD_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REST_UPLOAD_TIMEOUT_MS);
    const started = Date.now();
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
          "content-type": file.type || "application/octet-stream",
          "cache-control": "3600",
        },
        body: file,
        signal: controller.signal,
      });
      clearTimeout(timer);

      console.log("[uploadViaRest] Ответ fetch", {
        attempt: attempt + 1,
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
        elapsedMs: Date.now() - started,
      });

      if (res.ok) return;

      const text = await res.text().catch(() => "");
      // Ретраим только на транзиентных upstream-ошибках
      if ([502, 503, 504, 408, 429].includes(res.status) && attempt < REST_UPLOAD_MAX_RETRIES) {
        const delay = REST_UPLOAD_BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[uploadViaRest] HTTP ${res.status} (попытка ${attempt + 1}), повтор через ${delay}мс`,
          text,
        );
        await sleepMs(delay);
        continue;
      }
      console.error("Storage REST upload error:", res.status, text);
      throw new Error(
        `Ошибка загрузки файла (HTTP ${res.status}): ${text || res.statusText}`,
      );
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      const isAbort = err instanceof Error && err.name === "AbortError";
      const elapsed = Date.now() - started;
      console.error("[uploadViaRest] fetch исключение", {
        attempt: attempt + 1,
        elapsedMs: elapsed,
        aborted: isAbort,
        message: err instanceof Error ? err.message : String(err),
      });
      // Сообщение об ошибке от !res.ok — пробрасываем без ретрая
      if (err instanceof Error && err.message.startsWith("Ошибка загрузки файла")) {
        throw err;
      }
      // Сетевые ошибки и таймауты — ретраим
      if (attempt < REST_UPLOAD_MAX_RETRIES) {
        const delay = REST_UPLOAD_BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[uploadViaRest] сетевая ошибка, повтор через ${delay}мс`);
        await sleepMs(delay);
        continue;
      }
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("Не удалось загрузить файл после нескольких попыток");
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
 * Дедупликация одновременных вызовов: если тот же файл (по name+size+lastModified)
 * уже грузится — возвращаем существующий Promise вместо повторной загрузки.
 * Это устраняет дубли при двойном клике / повторных submit / React strict mode.
 */
const inFlightUploads = new Map<string, Promise<string>>();

function fileDedupeKey(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}`;
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
  const dedupeKey = fileDedupeKey(file);
  const existing = inFlightUploads.get(dedupeKey);
  if (existing) {
    console.log("[uploadDocumentFile] Дедупликация: файл уже грузится, переиспользуем Promise", {
      name: file.name,
      size: file.size,
    });
    return existing;
  }

  const promise = (async () => {
    const filePath = buildFilePath(file);
    try {
      if (file.size >= TUS_THRESHOLD_BYTES) {
        await uploadViaTus(file, filePath, onProgress);
      } else {
        await uploadViaRest(file, filePath);
        onProgress?.(100);
      }
    } catch (err) {
      console.log("[uploadDocumentFile] Ошибка в catch-блоке:", err);
      if (err instanceof Error && err.message.startsWith("Ошибка загрузки файла")) {
        throw err;
      }
      throw new Error(`Ошибка загрузки файла: ${describeUploadError(err)}`);
    }
    // Публичная ссылка должна вести на исходный домен Supabase (не на прокси):
    // 1) внешним системам (Bpium) проще качать напрямую без посредников;
    // 2) Edge Function bpium-api валидирует префикс URL по SUPABASE_URL.
    return `${SUPABASE_DIRECT_URL}/storage/v1/object/public/${BUCKET}/${filePath}`;
  })();

  inFlightUploads.set(dedupeKey, promise);
  try {
    return await promise;
  } finally {
    inFlightUploads.delete(dedupeKey);
  }
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
