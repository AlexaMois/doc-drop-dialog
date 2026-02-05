import { useMemo } from "react";
import type { CatalogOption } from "./useBpiumCatalogs";

// Ключевые слова для сопоставления с тегами
const tagKeywords: Record<string, string[]> = {
  "tag-1": ["важно", "критично", "приоритет", "срочно важно"],
  "tag-2": ["срочно", "немедленно", "быстро", "asap", "дедлайн"],
  "tag-3": ["архив", "архивный", "старый", "устаревший", "история"],
  "tag-4": ["новое", "новый", "создан", "добавлен"],
  "tag-5": ["обновлено", "обновлён", "актуализация", "редакция", "версия"],
  "tag-6": ["проверка", "ревью", "согласование", "рассмотрение"],
  "tag-7": ["утверждено", "одобрено", "подписан", "согласован", "принят"],
  "tag-8": ["регламент", "положение", "правило", "порядок", "процедура"],
  "tag-9": ["инструкция", "руководство", "manual", "гайд", "памятка"],
  "tag-10": ["отчёт", "отчет", "report", "статистика", "аналитика"],
  "tag-11": ["договор", "контракт", "соглашение", "nda"],
  "tag-12": ["приказ", "распоряжение", "указание", "постановление"],
  "tag-13": ["технический", "техническая", "спецификация", "схема", "чертёж"],
  "tag-14": ["финансы", "бюджет", "оплата", "счёт", "invoice", "акт"],
  "tag-15": ["hr", "кадры", "сотрудник", "персонал", "штат", "увольнение", "найм"],
};

export function useTagSuggestions(
  documentName: string,
  fileName: string | undefined,
  availableTags: CatalogOption[]
): CatalogOption[] {
  return useMemo(() => {
    if (!documentName && !fileName) {
      return [];
    }

    const textToAnalyze = `${documentName} ${fileName || ""}`.toLowerCase();
    const suggestedTagIds = new Set<string>();

    // Ищем совпадения по ключевым словам
    for (const [tagId, keywords] of Object.entries(tagKeywords)) {
      for (const keyword of keywords) {
        if (textToAnalyze.includes(keyword.toLowerCase())) {
          suggestedTagIds.add(tagId);
          break;
        }
      }
    }

    // Фильтруем доступные теги по найденным ID
    return availableTags.filter((tag) => suggestedTagIds.has(tag.value));
  }, [documentName, fileName, availableTags]);
}
