import { useMemo } from "react";
import type { CatalogOption } from "./useBpiumCatalogs";

// Ключевые слова для сопоставления с тегами
const tagKeywords: Record<string, string[]> = {
  "1": ["бдд", "дорожн", "движени", "транспорт", "водител", "автомобил"],
  "2": ["здоровь", "медицин", "медосмотр", "врач", "лечени"],
  "3": ["пусков", "аудит", "проверк", "ревизи"],
  "4": ["рн бдд", "региональн"],
  "5": ["соц", "быт", "социальн"],
  "6": ["укэб", "контрол"],
};

// Предустановленные теги на основе направлений
const directionTagSuggestions: Record<string, string[]> = {
  // Безопасность дорожного движения (ID: 4)
  "4": ["1", "4"], // БДД, РН БДД
  // Пожарная безопасность (ID: 5)
  "5": ["3"], // Пусковой Аудит
  // Кадровое делопроизводство (ID: 8)
  "8": ["5"], // Соц Быт
  // Медицина (ID: 15)
  "15": ["2"], // Охрана Здоровья
  // Общие документы по ПБ, ОТ и ООС (ID: 12)
  "12": ["3", "6"], // Пусковой Аудит, УКЭБ
};

export function useTagSuggestions(
  documentName: string,
  fileName: string | undefined,
  availableTags: CatalogOption[],
  selectedDirections?: string[]
): CatalogOption[] {
  return useMemo(() => {
    const suggestedTagIds = new Set<string>();

    // 1. Предложения на основе выбранных направлений
    if (selectedDirections && selectedDirections.length > 0) {
      for (const directionId of selectedDirections) {
        const suggestedTags = directionTagSuggestions[directionId];
        if (suggestedTags) {
          suggestedTags.forEach(tagId => suggestedTagIds.add(tagId));
        }
      }
    }

    // 2. Предложения на основе названия документа и имени файла
    if (documentName || fileName) {
      const textToAnalyze = `${documentName} ${fileName || ""}`.toLowerCase();
      
      for (const [tagId, keywords] of Object.entries(tagKeywords)) {
        for (const keyword of keywords) {
          if (textToAnalyze.includes(keyword.toLowerCase())) {
            suggestedTagIds.add(tagId);
            break;
          }
        }
      }
    }

    // Фильтруем доступные теги по найденным ID
    return availableTags.filter((tag) => suggestedTagIds.has(tag.value));
  }, [documentName, fileName, availableTags, selectedDirections]);
}
