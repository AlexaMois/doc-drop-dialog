import { useState, useEffect, useCallback, useRef } from "react";
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

const DEBOUNCE_MS = 800; // Задержка перед запросом к AI

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
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Преобразуем выбранные ID в объекты с labels
  const getSelectedItems = useCallback((ids: string[], items: CatalogOption[]) => {
    return items.filter(item => ids.includes(item.value));
  }, []);

  const fetchSuggestions = useCallback(async () => {
    // Проверяем, есть ли достаточно данных для запроса
    const hasData = documentName.trim().length > 2 || 
                    selectedSourceIds.length > 0 || 
                    selectedDirectionIds.length > 0 ||
                    selectedRoleIds.length > 0 ||
                    selectedProjectIds.length > 0;

    if (!hasData || availableTags.length === 0) {
      setSuggestedTagIds([]);
      return;
    }

    // Отменяем предыдущий запрос
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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
      setSuggestedTagIds(data.suggestedTagIds || []);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return; // Запрос отменён, это нормально
      }
      console.error("AI tag suggestion error:", err);
      setError("Не удалось получить рекомендации");
    } finally {
      setIsLoading(false);
    }
  }, [
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
    getSelectedItems,
  ]);

  // Debounced effect для вызова AI
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions();
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [fetchSuggestions]);

  // Cleanup при размонтировании
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Преобразуем ID в полные объекты тегов
  const suggestedTags = availableTags.filter(tag => suggestedTagIds.includes(tag.value));

  return {
    suggestedTags,
    isLoading,
    error,
  };
}
