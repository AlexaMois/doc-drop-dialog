# Cloudflare Worker — прокси для обхода блокировки Supabase в РФ

## Зачем

Домен `*.supabase.co` периодически попадает под блокировки РКН. Симптом:
ошибка `Failed to fetch` в браузере без HTTP-статуса; работает только с VPN.

Этот Worker принимает запросы на ваш домен (например `api.dokumen-portal.ru`)
и прозрачно проксирует их на Supabase. Cloudflare-сеть в РФ не блокируется,
поэтому пользователи получают доступ без VPN.

## Шаги настройки (вне Lovable)

### 1. Домен
Купите любой домен (≈200₽/год, например на reg.ru). Если уже есть — используйте.

### 2. Cloudflare
1. Зарегистрируйтесь на https://cloudflare.com (бесплатный план).
2. **Add site** → введите домен → выберите Free plan.
3. Cloudflare покажет **2 NS-сервера** (например `xxx.ns.cloudflare.com`).
4. У регистратора домена замените NS-серверы на эти два. Распространение DNS
   занимает от 5 минут до 24 часов.

### 3. Создать Worker
1. В Cloudflare: **Workers & Pages → Create → Create Worker**.
2. Назовите, например, `supabase-proxy`.
3. Замените код на содержимое `worker.js` из этой папки.
4. **Deploy**.

### 4. Привязать поддомен к Worker
1. В Worker: **Settings → Domains & Routes → Add Custom Domain**.
2. Введите `api.вашдомен.ru` (или любой другой поддомен).
3. Cloudflare сам создаст DNS-запись и выпустит SSL.

### 5. Обновить Lovable
1. **Project Settings → Environment** (Lovable Cloud).
2. Замените `VITE_SUPABASE_URL` с
   `https://hombyvzvkdqwjwjnxdlx.supabase.co`
   на
   `https://api.вашдомен.ru`
3. Передеплойте проект (кнопка **Publish → Update**).

Готово. Никаких правок в коде не нужно — клиент Supabase, storage и edge
functions автоматически подхватят новый URL.

## Проверка

Откройте в браузере без VPN:
- `https://api.вашдомен.ru/functions/v1/bpium-api?action=get-catalogs`
  должен вернуть JSON со списком направлений.
- В приложении: загрузка каталогов и upload файлов работают.

## Обратный путь

Если что-то пошло не так — верните `VITE_SUPABASE_URL` к исходному
значению и передеплойте. Сайт мгновенно вернётся к прямой работе с Supabase.
