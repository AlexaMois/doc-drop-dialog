

## Исправление белого экрана при загрузке файла в Chrome

### Проблема
При загрузке файла в Google Chrome приложение падает и показывает белый экран. Файл загружается (видно на скриншоте), но дальнейшие действия могут приводить к краху.

### Причины
1. **`z.instanceof(File)` в Zod-схеме** -- в production-сборках Vite `instanceof File` может работать некорректно из-за особенностей бандлинга. При валидации формы это вызывает необработанную ошибку.
2. **Нет Error Boundary** -- любая ошибка рендеринга убивает всё приложение без возможности восстановления.
3. **Конфликт onChange** у поля ФИО -- `register()` и явный `onChange` перезатирают друг друга.

### План исправлений

#### 1. Заменить Zod-валидацию файла (`src/components/DocumentForm.tsx`)
Заменить `z.instanceof(File)` на безопасную проверку:
```ts
file: z.any()
  .refine((val) => val !== null && val !== undefined, "Файл документа обязателен")
  .refine((val) => val && typeof val === 'object' && 'name' in val && 'size' in val, "Некорректный файл"),
```

#### 2. Добавить Error Boundary (`src/App.tsx`)
Обернуть приложение в компонент-перехватчик ошибок, чтобы при любом сбое пользователь видел сообщение об ошибке и кнопку "Попробовать снова", а не белый экран.

#### 3. Исправить onChange для ФИО (`src/components/DocumentForm.tsx`)
Объединить обработчики react-hook-form и пользовательской логики:
```ts
onChange={(e) => {
  register("responsiblePerson").onChange(e);
  if (!responsible.isLocked) {
    responsible.updateTempName(e.target.value);
  }
}}
```

### Файлы для изменения
- `src/components/DocumentForm.tsx` -- пункты 1 и 3
- `src/App.tsx` -- пункт 2
