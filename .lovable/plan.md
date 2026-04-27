
## Диагноз

Я проверил всё, что вы просили:

| Проверка | Результат |
|---|---|
| Логи `bpium-api` / `suggest-tags` — ошибки 4xx/5xx | **Нет ошибок за сутки.** Последние вызовы `bpium-api` минуту назад → `200 OK` |
| Логи Storage / upload | Чистые, ошибок на стороне сервера нет |
| Статус Supabase-проекта (пауза/план) | **Активен.** Если бы был на паузе, мы бы не получили данные каталогов в текущем preview |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Корректны, ключ валидный |
| CORS Edge Functions | OPTIONS preflight → `200 OK`, заголовки на месте |
| Custom domain | **Не настроен** |

**Вывод:** код, проект и Supabase-инфраструктура работают штатно. Симптом «работает только с VPN, у всех пользователей, и раньше работало без VPN» + ошибка `Failed to fetch` (без HTTP-статуса = сетевой обрыв до сервера) указывают на **блокировку домена `*.supabase.co` российскими провайдерами на сетевом уровне (РКН)**. Это внешняя причина, не баг приложения.

## Что НЕ поможет

- ❌ Менять код фронта/edge functions — ошибка не в них.
- ❌ Custom domain в Supabase (`api.dokumen-portal.ru` → CNAME на `hombyvzvkdqwjwjnxdlx.supabase.co`) — **не решает проблему**, т.к. блокировка часто работает по IP/SNI, а не только по доменному имени. CNAME просто переадресует на тот же заблокированный IP.
- ❌ Resumable upload (TUS) — мы его уже включили, он помогает против обрывов сети, но не против полной недоступности домена.

## Что поможет: проксирование через Cloudflare Worker

Идея: поднять Cloudflare Worker на вашем домене (например, `api.dokumen-portal.ru`), который принимает запросы от фронта и пересылает их на Supabase. Cloudflare-домены РКН блокировать массово не может — это разломает половину рунета.

### Архитектура

```
Браузер пользователя (РФ, без VPN)
        ↓ HTTPS
api.dokumen-portal.ru   ← ваш домен на Cloudflare (НЕ заблокирован)
        ↓ Cloudflare Worker проксирует
hombyvzvkdqwjwjnxdlx.supabase.co  ← заблокирован для пользователя напрямую,
                                    но Cloudflare обращается из своей сети
```

Worker прозрачно переписывает три типа путей:
- `/auth/v1/*` — авторизация (если появится)
- `/rest/v1/*` — PostgREST (CRUD к таблицам)
- `/functions/v1/*` — edge functions (`bpium-api`, `suggest-tags`)
- `/storage/v1/*` — Storage (загрузка файлов, в т.ч. resumable TUS)

### Что нужно от вас (вне Lovable)

1. **Домен.** Если у `dokumen-portal.lovable.app` нет своего домена — нужен любой домен (можно купить за ~200₽/год, например на reg.ru).
2. **Cloudflare-аккаунт** (бесплатный) → добавить домен → перевести NS-записи на Cloudflare (раз в жизни, ~5 минут + до 24 ч на распространение DNS).
3. **Создать Worker** в Cloudflare → я дам готовый код прокси (~30 строк) → привязать к поддомену `api.вашдомен.ru`.

### Что я сделаю в Lovable после настройки

1. Заменю `VITE_SUPABASE_URL` с `https://hombyvzvkdqwjwjnxdlx.supabase.co` на `https://api.вашдомен.ru` (по факту это меняется в `.env`, который вы редактируете сами через UI Lovable Cloud, потому что файл генерируется автоматически).
2. Проверю, что `src/integrations/supabase/client.ts` подхватывает новый URL (он подхватит — там `import.meta.env.VITE_SUPABASE_URL`).
3. Проверю `src/lib/storage.ts` — TUS endpoint собирается из `SUPABASE_URL`, тоже автоматически подхватит.
4. Передеплою edge functions (на всякий случай) и протестирую полный цикл: загрузка каталогов → upload файла → submit в Bpium.

### Альтернатива (быстрее, но без своего домена)

Если домен покупать не хочется — можно поднять Worker на бесплатном поддомене Cloudflare (`*.workers.dev`). Но: домен `*.workers.dev` тоже периодически попадает под блокировки РКН (был заблокирован летом 2024, потом разблокирован, но гарантий нет). Для надёжности всё-таки лучше свой домен.

## Готовый код Worker (для справки, чтобы вы понимали объём)

```js
// cloudflare-worker.js
const SUPABASE_HOST = 'hombyvzvkdqwjwjnxdlx.supabase.co';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.hostname = SUPABASE_HOST;
    url.protocol = 'https:';
    url.port = '';

    const proxied = new Request(url.toString(), request);
    proxied.headers.set('Host', SUPABASE_HOST);

    const resp = await fetch(proxied);
    // Прокидываем CORS, чтобы браузер не ругался
    const headers = new Headers(resp.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    return new Response(resp.body, { status: resp.status, headers });
  }
};
```

## План работ

1. **Вы:** покупаете домен (если нет) + регистрируетесь в Cloudflare + переводите NS.
2. **Вы:** создаёте Worker по коду выше + биндите его к `api.вашдомен.ru` через Cloudflare DNS (Route).
3. **Вы:** обновляете `VITE_SUPABASE_URL` в Lovable Cloud → Settings.
4. **Я:** проверяю клиент и storage-модуль, делаю тестовый прогон, при необходимости правлю мелочи.
5. **Я:** документирую решение в DOCUMENTATION.md, чтобы при следующих изменениях не сломать.

## Что делать прямо сейчас, пока прокси не настроен

Сообщите пользователям: «Если портал не открывается — включите VPN или используйте мобильный интернет другого оператора». Это временная мера на 1–2 дня, пока разворачивается прокси.

---

**Подтвердите**, что готовы идти по этому пути — и я после получения домена/Worker URL сразу подключу всё в коде. Если есть вопросы по шагам в Cloudflare — распишу пошагово с скриншотами что куда нажимать.
