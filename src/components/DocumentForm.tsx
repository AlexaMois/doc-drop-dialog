import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Send, CheckCircle, Loader2, Lock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/MultiSelect";
import { FileUpload } from "@/components/FileUpload";
import { TagSelector } from "@/components/TagSelector";
import { QuizGame } from "@/components/QuizGame";
import { useAllCatalogs, submitDocumentToBpium } from "@/hooks/useBpiumCatalogs";
import { useResponsiblePerson } from "@/hooks/useResponsiblePerson";
import { useAiTagSuggestions } from "@/hooks/useAiTagSuggestions";
import { uploadDocumentFile } from "@/lib/storage";

const formSchema = z.object({
  documentName: z.string().min(1, "Название документа обязательно"),
  file: z.instanceof(File, { message: "Файл документа обязателен" }).nullable().refine((val) => val !== null, "Файл документа обязателен"),
  responsiblePerson: z.string().min(1, "ФИО ответственного обязательно"),
  sources: z.array(z.string()).min(1, "Выберите хотя бы один источник"),
  directions: z.array(z.string()).min(1, "Выберите хотя бы одно направление"),
  roles: z.array(z.string()).min(1, "Выберите хотя бы одну роль"),
  projects: z.array(z.string()).min(1, "Выберите хотя бы один проект"),
  tags: z.array(z.string()).optional(),
});

type FormData = z.infer<typeof formSchema>;

export function DocumentForm() {
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [quizPassed, setQuizPassed] = React.useState(false);
  
  const catalogs = useAllCatalogs();
  const responsible = useResponsiblePerson();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      documentName: "",
      file: null,
      responsiblePerson: "",
      sources: [],
      directions: [],
      roles: [],
      projects: [],
      tags: [],
    },
  });

  // Синхронизация ФИО из localStorage
  React.useEffect(() => {
    if (responsible.name) {
      setValue("responsiblePerson", responsible.name);
    }
  }, [responsible.name, setValue]);

  const file = watch("file");
  const documentName = watch("documentName");
  const sources = watch("sources");
  const directions = watch("directions");
  const roles = watch("roles");
  const projects = watch("projects");
  const tags = watch("tags") || [];

  // AI-подсказки тегов на основе всех введённых данных
  const { suggestedTags, isLoading: isAiTagsLoading } = useAiTagSuggestions({
    documentName,
    fileName: file?.name,
    sources: catalogs.sources.data || [],
    directions: catalogs.directions.data || [],
    roles: catalogs.roles.data || [],
    projects: catalogs.projects.data || [],
    availableTags: catalogs.tags.data || [],
    selectedSourceIds: sources,
    selectedDirectionIds: directions,
    selectedRoleIds: roles,
    selectedProjectIds: projects,
  });

  // Валидация: проверка что все выбранные значения существуют в каталогах
  const validateCatalogValues = (
    selectedIds: string[],
    catalogData: { value: string; label: string }[] | undefined,
    fieldName: string
  ): boolean => {
    if (!catalogData) return false;
    const catalogIds = new Set(catalogData.map((item) => item.value));
    const invalidIds = selectedIds.filter((id) => !catalogIds.has(id));
    if (invalidIds.length > 0) {
      console.error(`Недопустимые значения в поле "${fieldName}":`, invalidIds);
      return false;
    }
    return true;
  };

  const onSubmit = async (data: FormData) => {
    // Строгая валидация: все значения должны существовать в каталогах
    const validations = [
      { ids: data.sources, catalog: catalogs.sources.data, name: "Источники" },
      { ids: data.directions, catalog: catalogs.directions.data, name: "Направления" },
      { ids: data.roles, catalog: catalogs.roles.data, name: "Роли" },
      { ids: data.projects, catalog: catalogs.projects.data, name: "Проекты" },
      // Теги валидируем только если они реальные (не fallback)
      ...(!catalogs.tagsAreFallback ? [{ ids: data.tags || [], catalog: catalogs.tags.data, name: "Теги" }] : []),
    ];

    for (const { ids, catalog, name } of validations) {
      if (!validateCatalogValues(ids, catalog, name)) {
        toast.error(`Обнаружены недопустимые значения в поле "${name}"`);
        return;
      }
    }

    // Сохраняем ФИО при первой отправке
    if (!responsible.isLocked) {
      responsible.saveName(data.responsiblePerson);
    }

    setIsSubmitting(true);

    try {
      // Загружаем файл в Supabase Storage
      console.log("Загрузка файла в хранилище...");
      const fileUrl = await uploadDocumentFile(data.file!);
      console.log("Файл загружен:", fileUrl);

      // Формируем данные для отправки в Bpium
      const submitData = {
        documentName: data.documentName.trim(),
        responsiblePerson: data.responsiblePerson.trim(),
        fileUrl: fileUrl,
        fileName: data.file!.name,
        sourceIds: data.sources,
        directionIds: data.directions,
        roleIds: data.roles,
        projectIds: data.projects,
        checklistIds: [], // Чек-листы убраны из формы
        // Если теги fallback (демо), не отправляем их в Bpium
        tagIds: catalogs.tagsAreFallback ? [] : (data.tags || []),
        websiteUrl: null,
        funPhrase: null,
        submissionDate: new Date().toISOString(),
      };

      console.log("Отправка данных в Bpium:", submitData);

      // Отправляем в Bpium через edge function
      const result = await submitDocumentToBpium(submitData);
      
      console.log("Документ успешно создан в Bpium:", result);
      toast.success("Документ успешно отправлен!");
      setIsSubmitted(true);
    } catch (error) {
      console.error("Ошибка отправки документа:", error);
      toast.error(error instanceof Error ? error.message : "Ошибка отправки документа");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    reset({
      documentName: "",
      file: null,
      responsiblePerson: responsible.name,
      sources: [],
      directions: [],
      roles: [],
      projects: [],
      tags: [],
    });
    setIsSubmitted(false);
    setQuizPassed(false);
  };

  if (responsible.isLoading || catalogs.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Загрузка справочников из Bpium...</p>
      </div>
    );
  }

  if (catalogs.isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Ошибка загрузки справочников</h2>
        <p className="text-muted-foreground mb-4">
          {catalogs.error instanceof Error ? catalogs.error.message : "Не удалось подключиться к Bpium"}
        </p>
        <Button onClick={() => window.location.reload()} variant="outline">
          Попробовать снова
        </Button>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in-0 zoom-in-95 duration-500">
        <div className="p-4 bg-accent rounded-full mb-6">
          <CheckCircle className="h-12 w-12 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold mb-2">Документ принят!</h2>
        <p className="text-muted-foreground mb-6">
          Документ принят и отправлен на проверку
        </p>
        <Button onClick={handleReset} variant="outline">
          Добавить ещё документ
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* ФИО ответственного */}
      <div className="space-y-2">
        <Label htmlFor="responsiblePerson" className="flex items-center gap-2">
          ФИО ответственного <span className="text-destructive">*</span>
          {responsible.isLocked && (
            <Lock className="h-3 w-3 text-muted-foreground" />
          )}
        </Label>
        <Input
          id="responsiblePerson"
          placeholder="Введите ваше ФИО"
          {...register("responsiblePerson")}
          disabled={responsible.isLocked}
          className={responsible.isLocked ? "bg-muted cursor-not-allowed" : "bg-card"}
          onChange={(e) => {
            if (!responsible.isLocked) {
              responsible.updateTempName(e.target.value);
            }
          }}
        />
        {responsible.isLocked && (
          <p className="text-xs text-muted-foreground">
            ФИО зафиксировано и не может быть изменено
          </p>
        )}
        {errors.responsiblePerson && (
          <p className="text-sm text-destructive">{errors.responsiblePerson.message}</p>
        )}
      </div>

      {/* Название документа */}
      <div className="space-y-2">
        <Label htmlFor="documentName">
          Название документа <span className="text-destructive">*</span>
        </Label>
        <Input
          id="documentName"
          placeholder="Введите название документа"
          {...register("documentName")}
          className="bg-card"
        />
        {errors.documentName && (
          <p className="text-sm text-destructive">{errors.documentName.message}</p>
        )}
      </div>

      {/* Файл документа */}
      <div className="space-y-2">
        <Label>
          Основной файл документа <span className="text-destructive">*</span>
        </Label>
        <FileUpload
          file={file}
          onChange={(f) => setValue("file", f, { shouldValidate: true })}
        />
        {errors.file && (
          <p className="text-sm text-destructive">{errors.file.message}</p>
        )}
      </div>

      {/* Источник документа */}
      <div className="space-y-2">
        <Label>
          Источник документа <span className="text-destructive">*</span>
        </Label>
        <MultiSelect
          options={catalogs.sources.data || []}
          selected={sources}
          onChange={(v) => setValue("sources", v, { shouldValidate: true })}
          placeholder="Выберите источники"
        />
        {errors.sources && (
          <p className="text-sm text-destructive">{errors.sources.message}</p>
        )}
      </div>

      {/* Направления */}
      <div className="space-y-2">
        <Label>
          Направления <span className="text-destructive">*</span>
        </Label>
        <MultiSelect
          options={catalogs.directions.data || []}
          selected={directions}
          onChange={(v) => setValue("directions", v, { shouldValidate: true })}
          placeholder="Выберите направления"
        />
        {errors.directions && (
          <p className="text-sm text-destructive">{errors.directions.message}</p>
        )}
      </div>

      {/* Роли */}
      <div className="space-y-2">
        <Label>
          Роли <span className="text-destructive">*</span>
        </Label>
        <MultiSelect
          options={catalogs.roles.data || []}
          selected={roles}
          onChange={(v) => setValue("roles", v, { shouldValidate: true })}
          placeholder="Выберите роли"
        />
        {errors.roles && (
          <p className="text-sm text-destructive">{errors.roles.message}</p>
        )}
      </div>

      {/* Проекты */}
      <div className="space-y-2">
        <Label>
          Проекты <span className="text-destructive">*</span>
        </Label>
        <MultiSelect
          options={catalogs.projects.data || []}
          selected={projects}
          onChange={(v) => setValue("projects", v, { shouldValidate: true })}
          placeholder="Выберите проекты"
        />
        {errors.projects && (
          <p className="text-sm text-destructive">{errors.projects.message}</p>
        )}
      </div>


      {/* Теги с AI-подсказками */}
      <TagSelector
        availableTags={catalogs.tags.data || []}
        suggestedTags={suggestedTags}
        selectedTags={tags}
        onChange={(v) => setValue("tags", v)}
        isLoading={catalogs.tags.isLoading}
        isAiLoading={isAiTagsLoading}
      />

      {/* Мини-викторина */}
      <QuizGame onCorrectAnswer={setQuizPassed} />

      {/* Кнопка отправки */}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isSubmitting || !quizPassed}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Отправка...
          </>
        ) : (
          <>
            <Send className="h-4 w-4 mr-2" />
            Отправить в портал
          </>
        )}
      </Button>
    </form>
  );
}
