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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    const systemPrompt = `Ты — эксперт по классификации документов для системы управления документами АТС (Автотранспортная служба).

Твоя задача — проанализировать информацию о документе и предложить подходящие теги/ключевые слова для классификации.

КОНТЕКСТ КОМПАНИИ АТС:
- Автотранспортное предприятие
- Основные направления: БДД (безопасность дорожного движения), охрана труда, пожарная безопасность
- Сотрудники: водители, механики, диспетчеры, руководители
- Документы: инструкции, положения, приказы, регламенты, памятки

ПРАВИЛА:
1. Предлагай от 2 до 5 коротких, релевантных тегов
2. Теги должны быть на русском языке
3. Каждый тег — 1-2 слова (максимум 3)
4. Теги должны отражать: тематику, тип документа, целевую аудиторию
5. Используй профессиональную терминологию АТС

ПРИМЕРЫ ХОРОШИХ ТЕГОВ:
- БДД, Охрана труда, Пожарная безопасность
- Инструкция, Положение, Приказ, Регламент, Памятка
- Водитель, Механик, Диспетчер
- ГСМ, Медосмотр, Обучение, Аттестация
- Техобслуживание, Путевой лист, Страховка

Верни ТОЛЬКО массив строк тегов в формате JSON, например: ["БДД", "Инструкция", "Водитель"]`;

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
            .slice(0, 5); // Максимум 5 тегов
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
