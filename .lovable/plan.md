

## Сворачиваемый список похожих документов

### Что изменится
Жёлтая карточка "Найдены похожие документы" станет сворачиваемой. По умолчанию список скрыт, виден только заголовок. Клик по заголовку разворачивает/сворачивает список с анимацией.

### Изменения в `src/components/DuplicateInlineWarning.tsx`

- Добавить `useState<boolean>(false)` для управления состоянием open/closed
- Сделать заголовок жёлтой карточки кликабельным (`cursor-pointer`, `onClick`)
- Добавить иконку `ChevronDown` справа от заголовка с поворотом: `rotate-0` (свёрнуто) / `rotate-180` (развёрнуто)
- Обернуть список `<ul>` и подсказку в контейнер с `overflow-hidden`, `transition-all duration-200`, и условным скрытием через `max-height: 0` / `max-height: auto` (или условный рендеринг)
- Красная карточка остаётся без изменений

### Технические детали

```tsx
// Добавить import
import { useState } from "react";
import { ChevronDown } from "lucide-react"; // уже есть в lucide-react

// Внутри компонента
const [similarOpen, setSimilarOpen] = useState(false);

// Заголовок жёлтой карточки:
<div
  className="flex items-center justify-between cursor-pointer"
  onClick={() => setSimilarOpen(!similarOpen)}
>
  <div className="flex items-center gap-2 text-sm font-medium text-yellow-700 dark:text-yellow-400">
    <AlertTriangle className="h-4 w-4 shrink-0" />
    Найдены похожие документы ({similarMatches.length} шт.)
  </div>
  <ChevronDown className={`h-4 w-4 transition-transform duration-200 text-yellow-700 dark:text-yellow-400 ${similarOpen ? "rotate-180" : ""}`} />
</div>

// Содержимое -- условный рендеринг:
{similarOpen && (
  <>
    <ul>...</ul>
    <p>...</p>
  </>
)}
```

### Файлы для изменения
- `src/components/DuplicateInlineWarning.tsx` -- добавить useState, сворачиваемость жёлтой карточки

