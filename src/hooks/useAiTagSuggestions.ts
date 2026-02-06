import { useState, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import type { CatalogOption } from "./useBpiumCatalogs";

interface UseAiTagSuggestionsParams {
  documentName: string;
  fileName?: string;
  sources: CatalogOption[];
  directions: CatalogOption[];
  roles: CatalogOption[];
  projects: CatalogOption[];
  availableTags: CatalogOption[];
  selectedSourceIds: string[];
  selectedDirectionIds: string[];
  selectedRoleIds: string[];
  selectedProjectIds: string[];
}

interface AiTagSuggestionsResult {
  suggestedTags: CatalogOption[];
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
  availableTags,
  selectedSourceIds,
  selectedDirectionIds,
  selectedRoleIds,
  selectedProjectIds,
}: UseAiTagSuggestionsParams): AiTagSuggestionsResult {
  const [suggestedTagIds, setSuggestedTagIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Стабильные строковые ключи для зависимостей
  const sourceIdsKey = selectedSourceIds.join(",");
  const directionIdsKey = selectedDirectionIds.join(",");
  const roleIdsKey = selectedRoleIds.join(",");
  const projectIdsKey = selectedProjectIds.join(",");
  const tagsAvailable = availableTags.length > 0;

  // Проверяем, есть ли достаточно данных для запроса
  const hasData = useMemo(() => {
    return documentName.trim().length > 2 || 
           selectedSourceIds.length > 0 || 
           selectedDirectionIds.length > 0 ||
           selectedRoleIds.length > 0 ||
           selectedProjectIds.length > 0;
  }, [documentName, selectedSourceIds.length, selectedDirectionIds.length, selectedRoleIds.length, selectedProjectIds.length]);

  // Debounced effect для вызова AI
  useEffect(() => {
    // Очищаем предыдущий таймер
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Не запускаем если нет данных или тегов
    if (!hasData || !tagsAvailable) {
      setSuggestedTagIds([]);
      setIsLoading(false);
      return;
    }

    // Показываем загрузку сразу
    setIsLoading(true);

    debounceTimerRef.current = setTimeout(async () => {
      // Отменяем предыдущий запрос
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        // Преобразуем выбранные ID в объекты
        const getSelectedItems = (ids: string[], items: CatalogOption[]) => {
          return items.filter(item => ids.includes(item.value));
        };

        console.log("Fetching AI tag suggestions...", { documentName, selectedSourceIds, selectedDirectionIds });

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
              sources: getSelectedItems(selectedSourceIds, sources),
              directions: getSelectedItems(selectedDirectionIds, directions),
              roles: getSelectedItems(selectedRoleIds, roles),
              projects: getSelectedItems(selectedProjectIds, projects),
              availableTags,
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
        console.log("AI suggested tags:", data.suggestedTagIds);
        setSuggestedTagIds(data.suggestedTagIds || []);
        setError(null);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return; // Запрос отменён, это нормально
        }
        console.error("AI tag suggestion error:", err);
        setError("Не удалось получить рекомендации");
      } finally {
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
    sourceIdsKey, 
    directionIdsKey, 
    roleIdsKey, 
    projectIdsKey, 
    hasData, 
    tagsAvailable,
    // Передаём источники данных для getSelectedItems внутри эффекта
    sources,
    directions,
    roles,
    projects,
    availableTags,
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

  // Преобразуем ID в полные объекты тегов
  const suggestedTags = useMemo(() => {
    return availableTags.filter(tag => suggestedTagIds.includes(tag.value));
  }, [availableTags, suggestedTagIds]);

  return {
    suggestedTags,
    isLoading,
    error,
  };
}
