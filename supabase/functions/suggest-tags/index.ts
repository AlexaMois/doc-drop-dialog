// AI-powered tag suggestions for document uploads

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TagSuggestionRequest {
  documentName: string;
  fileName?: string;
  sources: { value: string; label: string }[];
  directions: { value: string; label: string }[];
  roles: { value: string; label: string }[];
  projects: { value: string; label: string }[];
  availableTags: { value: string; label: string }[];
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
    if (!body.documentName && !body.fileName && body.sources.length === 0 && 
        body.directions.length === 0 && body.roles.length === 0 && body.projects.length === 0) {
      return new Response(JSON.stringify({ suggestedTagIds: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Формируем контекст для AI
    const context = `
Документ: "${body.documentName || 'Без названия'}"
Файл: "${body.fileName || 'Не указан'}"
Источники: ${body.sources.map(s => s.label).join(', ') || 'Не выбраны'}
Направления: ${body.directions.map(d => d.label).join(', ') || 'Не выбраны'}
Роли: ${body.roles.map(r => r.label).join(', ') || 'Не выбраны'}
Проекты: ${body.projects.map(p => p.label).join(', ') || 'Не выбраны'}
`.trim();

    const availableTagsList = body.availableTags.map(t => `- ID: "${t.value}", Название: "${t.label}"`).join('\n');

    const systemPrompt = `Ты — эксперт по классификации документов для системы управления документами АТС (Автотранспортная служба).

Твоя задача — проанализировать информацию о документе и предложить наиболее подходящие теги из доступного списка.

ПРАВИЛА:
1. Выбирай только теги из предоставленного списка
2. Предлагай от 1 до 5 наиболее релевантных тегов
3. Учитывай контекст: направления работы, роли сотрудников, тип источника
4. Если документ связан с безопасностью (БДД, ОТ, ПБ) — выбирай соответствующие теги
5. Если документ регламентирующий (инструкция, положение, приказ) — учитывай это
6. НЕ ДОБАВЛЯЙ теги, которых нет в списке

ДОСТУПНЫЕ ТЕГИ:
${availableTagsList}

Верни ТОЛЬКО массив ID тегов в формате JSON, например: ["1", "3", "7"]
Если подходящих тегов нет, верни пустой массив: []`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: context },
        ],
        temperature: 0.3, // Низкая температура для более предсказуемых результатов
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded", suggestedTagIds: [] }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required", suggestedTagIds: [] }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error", suggestedTagIds: [] }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || "[]";
    
    // Парсим ответ AI — ищем JSON массив в ответе
    let suggestedTagIds: string[] = [];
    try {
      // Пробуем найти JSON массив в ответе
      const jsonMatch = aiResponse.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          // Фильтруем только валидные ID из доступных тегов
          const validIds = new Set(body.availableTags.map(t => t.value));
          suggestedTagIds = parsed.filter((id: unknown) => typeof id === 'string' && validIds.has(id));
        }
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", aiResponse, parseError);
    }

    console.log("AI suggested tags:", suggestedTagIds, "for context:", context.substring(0, 100));

    return new Response(JSON.stringify({ suggestedTagIds }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("suggest-tags error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error", suggestedTagIds: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
