## Контекст

Загрузка файлов теперь работает (CORS починен через Cloudflare Worker). Но при отправке формы Edge Function `bpium-api` отвечает:

> `Invalid file URL: must be a Supabase Storage public URL for the documents bucket`

### Причина

В `supabase/functions/bpium-api/index.ts` (строки 165–170) URL файла валидируется по жёсткому префиксу:

```ts
const supabaseUrl = Deno.env.get('SUPABASE_URL'); // hombyvzvkdqwjwjnxdlx.supabase.co
const prefix = `${supabaseUrl}/storage/v1/object/public/documents/`;
return url.startsWith(prefix);
```

А `src/lib/storage.ts` после загрузки вызывает:
```ts
supabase.storage.from(BUCKET).getPublicUrl(filePath)
```
Клиент `supabase` теперь инициализирован прокси-доменом `https://api.aleksamois.ru`, поэтому возвращается ссылка через прокси — и валидатор её отбрасывает.

### Почему правильно чинить на стороне клиента, а не валидатора

1. **Семантика прокси:** Cloudflare Worker нужен только для обхода блокировки исходящих запросов из РФ от **браузера** к Supabase. У Bpium (внешний сервис) такой проблемы нет — пусть качает файл напрямую с `*.supabase.co`. Это разгружает прокси и убирает лишнее звено.
2. **Безопасность:** Валидатор в Edge Function правильный — он защищает от инъекции произвольных URL в Bpium. Ослаблять его (разрешать прокси-домен) — хуже.
3. **Ссылка и так уже идёт «прямо»** в текущем коде — есть комментарий в `storage.ts`:
   > `// Публичная ссылка должна вести на исходный домен Supabase, а не на прокси, чтобы Bpium / другие внешние системы могли её открыть напрямую.`
   
   Намерение было верное, но реализация сломалась, когда мы централизовали URL — `getPublicUrl()` теперь использует прокси-базу из клиента.

## План изменений

### 1. `src/lib/apiBase.ts` — добавить «прямой» URL Supabase

Дополнить файл новой константой, которая всегда указывает на исходный домен Supabase, не зависящий от `PROXY_URL`:

```ts
/**
 * Прямой URL Supabase, без прокси.
 * Используется для генерации публичных ссылок на файлы в Storage,
 * которые потом отправляются во внешние системы (Bpium) — они должны
 * скачивать файлы напрямую с *.supabase.co, а не через наш прокси.
 */
export const SUPABASE_DIRECT_URL: string = import.meta.env
  .VITE_SUPABASE_URL as string;
```

### 2. `src/lib/storage.ts` — формировать public URL вручную

Заменить последние строки `uploadDocumentFile`:

```ts
// БЫЛО:
const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
return urlData.publicUrl;

// СТАНЕТ:
return `${SUPABASE_DIRECT_URL}/storage/v1/object/public/${BUCKET}/${filePath}`;
```

Это даст ровно тот префикс, который ждёт валидатор в Edge Function:
`https://hombyvzvkdqwjwjnxdlx.supabase.co/storage/v1/object/public/documents/uploads/...`

И импортировать `SUPABASE_DIRECT_URL` из `@/lib/apiBase`.

### 3. (Опционально) `deleteDocumentFile` — оставить как есть

Удаление через `supabase.storage.from(BUCKET).remove()` уйдёт через прокси — это нормально, оно из браузера.

### 4. Обновить память проекта

Дополнить `mem://infrastructure/cloudflare-proxy`:
> Public-ссылки на файлы Storage генерируются вручную через `SUPABASE_DIRECT_URL` (прямой `*.supabase.co`), чтобы внешние системы (Bpium) могли их скачать и валидатор Edge Function `bpium-api` их пропустил.

## Что НЕ меняем

- `bpium-api/index.ts` — валидатор URL остаётся строгим (это правильно).
- Cloudflare Worker — он работает корректно.
- Остальные хуки и `supabase` клиент — продолжают ходить через прокси.

## Проверка после деплоя

1. Загрузить PDF → в DevTools запрос на `api.aleksamois.ru/storage/v1/object/...` → 200.
2. Submit → запрос `bpium-api?action=submit-document` → в payload `fileUrl` начинается с `https://hombyvzvkdqwjwjnxdlx.supabase.co/storage/v1/object/public/documents/...` → 200, в ответе `recordId`.
3. Открыть карточку в Bpium → файл прикреплён, открывается по клику.

## Откат

Если что-то пойдёт не так — вернуть строку `return urlData.publicUrl` в `storage.ts` (одна строка).