import { useState, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import { SUPABASE_BASE_URL, SUPABASE_ANON_KEY } from "@/lib/apiBase";

// Глобальный реестр активных AbortController'ов suggest-tags.
// Позволяет извне (из performSubmit) отменить все висящие AI-запросы
// перед началом загрузки файла, чтобы они не делили ресурсы с upload.
const activeSuggestTagsControllers = new Set<AbortController>();

export function abortAllSuggestTagsRequests() {
  console.log(`[suggest-tags] Abort всех активных запросов: ${activeSuggestTagsControllers.size}`);
  for (const ctrl of activeSuggestTagsControllers) {
    try { ctrl.abort(); } catch { /* noop */ }
  }
  activeSuggestTagsControllers.clear();
}

interface UseAiTagSuggestionsParams {
  documentName: string;
  fileName?: string;
  sources: string[];  // Labels, not IDs
  directions: string[];
  roles: string[];
  projects: string[];
}

interface AiTagSuggestionsResult {
  suggestedTags: string[];  // Array of tag names (strings)
  isLoading: boolean;
  error: string | null;
}

const DEBOUNCE_MS = 1000; // Задержка перед запросом к AI

export function useAiTagSuggestions({
  documentName,
  fileName,
  sources,
  directions,
  roles,
  projects,
}: UseAiTagSuggestionsParams): AiTagSuggestionsResult {
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Стабильные строковые ключи для зависимостей
  const sourcesKey = sources.join(",");
  const directionsKey = directions.join(",");
  const rolesKey = roles.join(",");
  const projectsKey = projects.join(",");

  // Проверяем, есть ли достаточно данных для запроса
  const hasData = useMemo(() => {
    return documentName.trim().length > 2 || 
           sources.length > 0 || 
           directions.length > 0 ||
           roles.length > 0 ||
           projects.length > 0;
  }, [documentName, sources.length, directions.length, roles.length, projects.length]);

  // Debounced effect для вызова AI
  useEffect(() => {
    // Очищаем предыдущий таймер
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Не запускаем если нет данных
    if (!hasData) {
      setSuggestedTags([]);
      setIsLoading(false);
      return;
    }

    // Показываем загрузку сразу
    setIsLoading(true);

    debounceTimerRef.current = setTimeout(async () => {
      // Отменяем предыдущий запрос
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        activeSuggestTagsControllers.delete(abortControllerRef.current);
      }
      abortControllerRef.current = new AbortController();
      activeSuggestTagsControllers.add(abortControllerRef.current);

      try {
        const supabaseUrl = SUPABASE_BASE_URL;
        const supabaseKey = SUPABASE_ANON_KEY;

        console.log("Fetching AI tag suggestions...", { documentName, sources, directions });

        const response = await fetch(
          `${supabaseUrl}/functions/v1/suggest-tags`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              documentName,
              fileName,
              sources,
              directions,
              roles,
              projects,
            }),
            signal: abortControllerRef.current.signal,
          }
        );

        if (!response.ok) {
          if (response.status === 429) {
            setError("Слишком много запросов, попробуйте позже");
            toast.error("AI временно недоступен, попробуйте позже");
            return;
          }
          if (response.status === 402) {
            setError("Требуется пополнение баланса AI");
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log("AI suggested tags:", data.suggestedTags);
        setSuggestedTags(data.suggestedTags || []);
        setError(null);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return; // Запрос отменён, это нормально
        }
        console.error("AI tag suggestion error:", err);
        setError("Не удалось получить рекомендации");
      } finally {
        if (abortControllerRef.current) {
          activeSuggestTagsControllers.delete(abortControllerRef.current);
        }
        setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [
    documentName, 
    fileName, 
    sourcesKey, 
    directionsKey, 
    rolesKey, 
    projectsKey, 
    hasData,
  ]);

  // Cleanup при размонтировании
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    suggestedTags,
    isLoading,
    error,
  };
}
