// AI-powered tag suggestions using Lovable AI Gateway
// Generates free-text tags (not from predefined list)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TagSuggestionRequest {
  documentName: string;
  fileName?: string;
  sources: string[];
  directions: string[];
  roles: string[];
  projects: string[];
}

// In-memory rate limiter per IP (resets on cold start)
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count++;
  return true;
}

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limit: 20 AI requests/minute per IP (защита AI-кредитов)
  const ip = getClientIp(req);
  if (!checkRateLimit(ip, 20, 60_000)) {
    return new Response(
      JSON.stringify({ error: "Too many requests", suggestedTags: [] }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body: TagSuggestionRequest = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Если нет данных для анализа, возвращаем пустой массив
    if (!body.documentName && !body.fileName && 
        body.sources.length === 0 && body.directions.length === 0 && 
        body.roles.length === 0 && body.projects.length === 0) {
      return new Response(JSON.stringify({ suggestedTags: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Формируем контекст для AI
    const context = `
Документ: "${body.documentName || 'Без названия'}"
Файл: "${body.fileName || 'Не указан'}"
Источники: ${body.sources.join(', ') || 'Не выбраны'}
Направления: ${body.directions.join(', ') || 'Не выбраны'}
Роли: ${body.roles.join(', ') || 'Не выбраны'}
Проекты: ${body.projects.join(', ') || 'Не выбраны'}
`.trim();

    const systemPrompt = `Ты — эксперт по классификации документов для ООО "АкТрансСервис" (АТС).

ОПИСАНИЕ КОМПАНИИ:
АТС — транспортное предприятие, обеспечивающее транспорт и поддержку буровых и промышленных объектов в вахтовом формате, на распределённых площадках в сложных климатических условиях. Парк ~200 единиц техники. Крупные контракты: КРС, Славнефть, Газпром. Управление строится вокруг 1С, с порталом охраны труда и промышленной безопасности, библиотекой документов, интеграциями с ГЛОНАСС.

ГЛОССАРИЙ АББРЕВИАТУР:
- БДД — Безопасность дорожного движения
- ВЧНГ — АО "Верхнечонскнефтегаз" (заказчик/проект/ЦФО)
- ВЧНГКМ — Верхнечонское нефтегазоконденсатное месторождение
- ДНГКМ/ЮКНГКМ — Дулисьминское нефтегазоконденсатное месторождение
- ГПНЗ — ООО «Газпромнефть-Заполярье» (заказчик/проект/ЦФО)
- СН — ООО «Славнефть-Красноярскнефтегаз» (заказчик/проект/ЦФО)
- СДМ — Северо-Даниловское Месторождение (заказчик АО "ВЧНГ")
- АК1–АК5 — Автоколонны (структурные подразделения на разных площадках)
- ФЗ — Федеральные законы и иные НПА РФ
- ВНД — Внутренний нормативный документ
- ЛНД — Локально-нормативный документ
- ПБОТОС — Промышленная безопасность, охрана труда и окружающей среды
- Пож.без — Пожарная безопасность
- ОТ — Охрана труда
- ОС/ООС — Охрана окружающей среды, экология
- МОЛ — Материально ответственное лицо
- СИЗ — Средства индивидуальной защиты
- ПЛ — Путевой лист
- КСЦ — Корпоративный сервисный центр КАМАЗ
- ВЧПУ, ДПУ, ЧПУ, КПУ — Производственные участки
- ИТР — Инженерно-технический персонал
- АУП — Административно-управленческий персонал
- СПБОТОС — Служба промышленной безопасности, охраны труда и окружающей среды
- СПО — Служба производственного обеспечения
- ГД, ЗГД, НО, РП, НУ, ЗНУ — Должности (генеральный директор, зам, начальник отдела, руководитель проекта, начальник участка, зам начальника участка)
- НД — Нормативный документ
- ШР — Штатное расписание

КАТЕГОРИИ ТЕГОВ (выбирай из этих групп):
1. Вид документа: Инструкция, Положение, Приказ, Регламент, Памятка, Акт, Протокол, Журнал, Отчёт, Договор, ФЗ, ВНД, ЛНД
2. Тематика/область: БДД, ОТ, Пож.без, ПБОТОС, ОС/ООС, ГСМ, СИЗ, Медосмотр, Техосмотр, Путевой лист, ГЛОНАСС, Аттестация, Обучение, Стажировка, Инструктаж
3. Заказчик/проект: ВЧНГ, ГПНЗ, СН, СДМ, КРС, Газпром, Славнефть
4. Подразделение/участок: ВЧПУ, ДПУ, ЧПУ, КПУ, Автоколонна, КСЦ
5. Должность/роль: Водитель, Механик, Диспетчер, ИТР, АУП, МОЛ, Руководитель
6. Процесс: Ознакомление, Контроль, Проверка, Вахта, Допуск, Расследование, Аудит

ПРАВИЛА:
1. Предлагай от 7 до 10 коротких, релевантных тегов
2. Теги на русском языке, 1–3 слова
3. Используй аббревиатуры из глоссария где уместно
4. Покрывай минимум 2 разные категории (например, вид документа + тематика)
5. Учитывай выбранные источники, направления, роли и проекты для контекста

Верни ТОЛЬКО массив строк в формате JSON, например: ["БДД", "Инструкция", "Водитель", "ВЧНГ", "ОТ", "Регламент", "Контроль", "Вахта"]`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: context },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded", suggestedTags: [] }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required", suggestedTags: [] }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error", suggestedTags: [] }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || "[]";
    
    // Парсим ответ AI — ищем JSON массив в ответе
    let suggestedTags: string[] = [];
    try {
      // Пробуем найти JSON массив в ответе
      const jsonMatch = aiResponse.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          // Фильтруем и очищаем теги
          suggestedTags = parsed
            .filter((tag: unknown) => typeof tag === 'string' && tag.trim().length > 0)
            .map((tag: string) => tag.trim())
            .slice(0, 10); // Максимум 10 тегов
        }
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", aiResponse, parseError);
    }

    console.log("AI suggested tags:", suggestedTags, "for context:", context.substring(0, 100));

    return new Response(JSON.stringify({ suggestedTags }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("suggest-tags error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error", suggestedTags: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
