## Обновление Cloudflare Worker

### Что делаем
Синхронизируем `infra/cloudflare-worker/worker.js` с актуально задеплоенной версией в Cloudflare.

### Изменения
1. **Добавить `duplex: 'half'`** в конструктор `Request` при проксировании запроса.
   - Необходимо для корректной передачи streaming body (file uploads) в Cloudflare Workers.
   - Место: объект `proxied` (внутри `new Request(...)`).
2. **Добавить `'Content-Length'` в список разрешенных заголовков CORS**.
   - Заголовок уже присутствует как `"content-length"` (строчная запись), убедимся что он на месте.

### Почему это важно
Без `duplex: 'half'` Cloudflare Worker может отбрасывать или ломать тело запроса при upload файлов через Storage REST / TUS, что приводит к ошибкам типа `Failed to fetch` без HTTP-статуса.

### Технические детали
```text
Current:
  const proxied = new Request(url.toString(), {
    method: request.method,
    headers: upstreamHeaders,
    body: ...,
    redirect: "manual",
  });

Target:
  const proxied = new Request(url.toString(), {
    method: request.method,
    headers: upstreamHeaders,
    body: ...,
    redirect: "manual",
    duplex: "half",
  });
```

После мержа нужно будет обновить деплой в Cloudflare (Wrangler / Dashboard).