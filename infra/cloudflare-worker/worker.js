/**
 * Cloudflare Worker: прозрачный прокси к Supabase.
 *
 * Принимает запросы на ваш домен (api.aleksamois.ru) и пересылает их
 * на hombyvzvkdqwjwjnxdlx.supabase.co, обходя блокировки РКН.
 *
 * Поддерживает:
 *  - /auth/v1/*       — авторизация
 *  - /rest/v1/*       — PostgREST (CRUD)
 *  - /functions/v1/*  — edge functions (bpium-api, suggest-tags)
 *  - /storage/v1/*    — Storage, включая resumable TUS и multipart upload
 *  - /realtime/v1/*   — WebSocket realtime (через WebSocket-апгрейд)
 *
 * ВАЖНО: Worker сам отвечает на OPTIONS (CORS preflight), чтобы гарантировать
 * корректные allow-заголовки. Если пустить OPTIONS в Supabase напрямую — он
 * вернёт свой набор заголовков, в котором может не быть, например, x-upsert,
 * и браузер заблокирует основной запрос с "Failed to fetch" без HTTP-статуса.
 */

const SUPABASE_HOST = "hombyvzvkdqwjwjnxdlx.supabase.co";

// Полный список заголовков, которые могут прилететь от supabase-js,
// tus-js-client и нашего собственного fetch для Storage REST.
const ALLOWED_HEADERS = [
  "authorization",
  "apikey",
  "content-type",
  "content-length",
  "cache-control",
  "x-upsert",
  "x-client-info",
  "x-supabase-client-platform",
  "x-supabase-client-platform-version",
  "x-supabase-client-runtime",
  "x-supabase-client-runtime-version",
  "prefer",
  "accept",
  "accept-profile",
  "content-profile",
  "range",
  // TUS
  "tus-resumable",
  "tus-version",
  "upload-length",
  "upload-metadata",
  "upload-offset",
  "upload-defer-length",
  "upload-concat",
  "x-http-method-override",
].join(", ");

const EXPOSED_HEADERS = [
  "content-range",
  "content-length",
  "content-type",
  "x-upsert",
  "location",
  "etag",
  "tus-resumable",
  "tus-version",
  "tus-extension",
  "tus-max-size",
  "upload-offset",
  "upload-length",
  "upload-metadata",
].join(", ");

function corsHeaders(origin) {
  return {
    // Если у фронта credentials=true — нельзя ставить "*", надо отражать origin.
    // У нас credentials не используется, но всё равно безопаснее отражать.
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods":
      "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Expose-Headers": EXPOSED_HEADERS,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin, Access-Control-Request-Headers",
  };
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "*";

    // Preflight — отвечаем сами, в Supabase не ходим.
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    url.hostname = SUPABASE_HOST;
    url.protocol = "https:";
    url.port = "";

    // Готовим заголовки для апстрима: убираем браузерный Origin/Referer,
    // которые могут мешать Supabase Storage.
    const upstreamHeaders = new Headers(request.headers);
    upstreamHeaders.delete("origin");
    upstreamHeaders.delete("referer");
    upstreamHeaders.set("Host", SUPABASE_HOST);

    const hasBody =
      request.method !== "GET" && request.method !== "HEAD";

    const proxied = new Request(url.toString(), {
      method: request.method,
      headers: upstreamHeaders,
      body: hasBody ? request.body : undefined,
      redirect: "manual",
      // duplex: "half" обязательно при стримящемся теле запроса
      // (file uploads через Storage REST / TUS). Без него Cloudflare
      // ругается "RequestInit: duplex option is required when sending a body".
      ...(hasBody ? { duplex: "half" } : {}),
    });

    let response;
    try {
      response = await fetch(proxied);
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: "Upstream fetch failed",
          detail: String(err),
        }),
        {
          status: 502,
          headers: {
            ...corsHeaders(origin),
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Перезаписываем CORS-заголовки своими (даже если Supabase прислал свои).
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(corsHeaders(origin))) {
      headers.set(k, v);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
