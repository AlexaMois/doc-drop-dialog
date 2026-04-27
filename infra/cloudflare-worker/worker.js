/**
 * Cloudflare Worker: прозрачный прокси к Supabase.
 *
 * Принимает запросы на ваш домен (api.вашдомен.ru) и пересылает их
 * на hombyvzvkdqwjwjnxdlx.supabase.co, обходя блокировки РКН.
 *
 * Поддерживает:
 *  - /auth/v1/*       — авторизация
 *  - /rest/v1/*       — PostgREST (CRUD)
 *  - /functions/v1/*  — edge functions (bpium-api, suggest-tags)
 *  - /storage/v1/*    — Storage, включая resumable TUS
 *  - /realtime/v1/*   — WebSocket realtime
 */

const SUPABASE_HOST = "hombyvzvkdqwjwjnxdlx.supabase.co";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-upsert, " +
    "tus-resumable, upload-length, upload-metadata, upload-offset, " +
    "x-supabase-client-platform, x-supabase-client-platform-version, " +
    "x-supabase-client-runtime, x-supabase-client-runtime-version, " +
    "range, prefer, accept-profile, content-profile",
  "Access-Control-Expose-Headers":
    "content-range, x-upsert, location, upload-offset, upload-length, tus-resumable",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request) {
    // Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    url.hostname = SUPABASE_HOST;
    url.protocol = "https:";
    url.port = "";

    // Создаём проксированный запрос. Сохраняем тело, метод, заголовки.
    const proxied = new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : request.body,
      redirect: "manual",
    });
    proxied.headers.set("Host", SUPABASE_HOST);

    let response;
    try {
      response = await fetch(proxied);
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Upstream fetch failed", detail: String(err) }),
        {
          status: 502,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    // Прокидываем ответ + добавляем CORS-заголовки.
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(CORS_HEADERS)) {
      headers.set(k, v);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
