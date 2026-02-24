import { Loader2, AlertTriangle, AlertCircle } from "lucide-react";
import type { DuplicateMatch } from "@/hooks/useDuplicateCheck";

interface DuplicateInlineWarningProps {
  exactMatches: DuplicateMatch[];
  similarMatches: DuplicateMatch[];
  isChecking: boolean;
}

export function DuplicateInlineWarning({
  exactMatches,
  similarMatches,
  isChecking,
}: DuplicateInlineWarningProps) {
  if (isChecking) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Проверка дубликатов…
      </div>
    );
  }

  if (exactMatches.length === 0 && similarMatches.length === 0) return null;

  return (
    <div className="space-y-2">
      {exactMatches.length > 0 && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Документ с таким названием уже есть в базе
          </div>
          {exactMatches.map((m) => (
            <div key={m.id} className="text-sm text-foreground pl-6 space-y-0.5">
              <p className="font-medium">{m.title}</p>
              <p className="text-muted-foreground">
                {[
                  m.responsiblePerson && `Загружен: ${m.responsiblePerson}`,
                  m.submissionDate &&
                    new Date(m.submissionDate).toLocaleDateString("ru-RU"),
                  m.status && `статус — ${m.status}`,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>
          ))}
          <p className="text-xs text-muted-foreground pl-6">
            Проверьте, нужна ли новая версия?
          </p>
        </div>
      )}

      {similarMatches.length > 0 && (
        <div className="rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-yellow-700 dark:text-yellow-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Найдены похожие документы ({similarMatches.length} шт.)
          </div>
          <ul className="text-sm text-foreground pl-6 space-y-1 list-disc list-inside">
            {similarMatches.slice(0, 5).map((m) => (
              <li key={m.id}>{m.title}</li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground pl-6">
            Убедитесь, что загружаете новый документ, а не дубликат.
          </p>
        </div>
      )}
    </div>
  );
}
