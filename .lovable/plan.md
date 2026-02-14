

## Проверка дубликатов документов перед отправкой

### Проблема
Разные пользователи могут вносить один и тот же документ повторно, так как сейчас нет проверки на дубликаты.

### Решение
Перед отправкой документа проверять в Bpium, существует ли уже запись с таким же названием. Если дубликат найден -- показать предупреждение с информацией о том, кто и когда уже внёс этот документ, и дать пользователю выбор: отправить всё равно или отменить.

### План изменений

#### 1. Новый action `check-duplicate` в edge function (`supabase/functions/bpium-api/index.ts`)

Добавить обработчик, который:
- Получает все записи из каталога документов (ID 56)
- Ищет совпадение по полю "Название" (поле 2) -- нечёткое сравнение (приведение к нижнему регистру, удаление лишних пробелов)
- Возвращает найденные дубликаты: название, ФИО ответственного, дату внесения

#### 2. Проверка дубликатов в форме (`src/components/DocumentForm.tsx`)

В функции `onSubmit`, перед загрузкой файла:
- Вызвать `check-duplicate` с названием документа
- Если дубликат найден -- показать диалог подтверждения с информацией:
  - "Документ с похожим названием уже существует"
  - Кто внёс и когда
  - Кнопки: "Отправить всё равно" / "Отменить"
- Если дубликатов нет -- продолжить отправку как обычно

#### 3. Компонент диалога подтверждения (`src/components/DuplicateWarningDialog.tsx`)

Новый компонент на базе AlertDialog, показывающий:
- Предупреждение о найденном дубликате
- Название найденного документа, ФИО ответственного, дату
- Две кнопки: подтвердить отправку или отменить

### Технические детали

**Edge function -- новый action `check-duplicate`:**
```ts
case 'check-duplicate': {
  const { documentName } = await req.json();
  const records = await fetchCatalog(authHeaders, CATALOG_IDS.documents);
  const normalizedName = documentName.trim().toLowerCase();
  const duplicates = records.filter(r => {
    const title = String(r.values['2'] || '').trim().toLowerCase();
    return title === normalizedName;
  }).map(r => ({
    id: r.id,
    title: String(r.values['2'] || ''),
    responsiblePerson: String(r.values['15'] || ''),
    submissionDate: String(r.values['16'] || ''),
  }));
  return Response with { duplicates, hasDuplicates: duplicates.length > 0 };
}
```

**Фронтенд -- вызов проверки в `useBpiumCatalogs.ts`:**
```ts
export async function checkDocumentDuplicate(documentName: string): Promise<DuplicateResult>
```

**Форма -- логика в `onSubmit`:**
- Если дубликат найден, вместо прямой отправки -- открыть диалог
- Сохранить данные формы во временное состояние
- При подтверждении -- продолжить отправку

### Файлы для изменения
- `supabase/functions/bpium-api/index.ts` -- новый action `check-duplicate`
- `src/hooks/useBpiumCatalogs.ts` -- функция `checkDocumentDuplicate`
- `src/components/DuplicateWarningDialog.tsx` -- новый компонент
- `src/components/DocumentForm.tsx` -- интеграция проверки в onSubmit
