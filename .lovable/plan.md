
## Цель
Перевести фронтенд на работу через прокси `https://api.aleksamois.ru` вместо прямого `https://hombyvzvkdqwjwjnxdlx.supabase.co`, чтобы портал работал в РФ без VPN.

## Почему правим код, а не `.env`
В Lovable файл `.env` и `src/integrations/supabase/client.ts` управляются Lovable Cloud. Прямой UI для подмены `VITE_SUPABASE_URL` в проекте отсутствует — `.env` пересоздаётся автоматически. Поэтому прокси-URL надо зашить в коде с возможностью отката.

## Изменения

### 1. `src/integrations/supabase/client.ts`
Добавить константу прокси и использовать её вместо `import.meta.env.VITE_SUPABASE_URL`:

```ts
// Прокси через Cloudflare Worker (обход блокировки *.supabase.co в РФ).
// Чтобы откатиться на прямой Supabase — поставить PROXY_URL = "".
const PROXY_URL = "https://api.aleksamois.ru";
const SUPABASE_URL = PROXY_URL || import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
```

Остальное (createClient, опции auth) остаётся без изменений.

### 2. `src/lib/storage.ts`
TUS-аплоад в `uploadViaTus` сейчас, скорее всего, тоже строит endpoint из `VITE_SUPABASE_URL`. Нужно убедиться, что он использует тот же базовый URL, что и `supabase` клиент. Варианты:
- взять URL из `supabase.storage.url` (если задействуется напрямую), либо
- импортировать из клиента переменную `SUPABASE_URL` (экспортировать её из `client.ts`) и собирать TUS endpoint как `${SUPABASE_URL}/storage/v1/upload/resumable`.

Я проверю текущую реализацию и поправлю строку формирования endpoint так, чтобы она шла через `api.aleksamois.ru`.

### 3. Worker — проверить заголовки для TUS
В `infra/cloudflare-worker/worker.js` уже добавлены заголовки `tus-resumable`, `upload-length`, `upload-metadata`, `upload-offset`, `x-upsert` в Allow-Headers и `location`, `upload-offset`, `upload-length`, `tus-resumable` в Expose-Headers. Менять не нужно.

## Что НЕ меняется
- `.env` — не трогаем (управляется Lovable).
- `src/integrations/supabase/types.ts` — не трогаем.
- Edge Functions, RLS, миграции — не затрагиваются. Они продолжают жить на `hombyvzvkdqwjwjnxdlx.supabase.co`, но клиент будет ходить к ним через `api.aleksamois.ru/functions/v1/...`.

## Проверка после деплоя
1. Открыть портал без VPN → форма загружается, каталоги Bpium подтягиваются (вызов `bpium-api` через `/functions/v1/`).
2. В DevTools → Network: все запросы идут на `api.aleksamois.ru`, статусы 200.
3. Загрузить файл >6 МБ → TUS-аплоад завершается успешно (PATCH-запросы на `api.aleksamois.ru/storage/v1/upload/resumable/...`).
4. Загрузить мелкий файл (<6 МБ) → стандартный POST через прокси работает.
5. Submit документа → запись появляется в Bpium.

## Откат
Если прокси сломается — поменять одну строку в `src/integrations/supabase/client.ts`:
```ts
const PROXY_URL = ""; // вернётся к прямому Supabase
```
и сделать Publish → Update.
