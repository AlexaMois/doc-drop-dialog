import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Send, CheckCircle, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/MultiSelect";
import { FileUpload } from "@/components/FileUpload";
import {
  sourcesData,
  directionsData,
  rolesData,
  projectsData,
  checklistsData,
  tagsData,
} from "@/data/catalogData";

const formSchema = z.object({
  documentName: z.string().min(1, "Название документа обязательно"),
  file: z.instanceof(File, { message: "Файл документа обязателен" }).nullable().refine((val) => val !== null, "Файл документа обязателен"),
  sources: z.array(z.string()).min(1, "Выберите хотя бы один источник"),
  directions: z.array(z.string()).min(1, "Выберите хотя бы одно направление"),
  roles: z.array(z.string()).min(1, "Выберите хотя бы одну роль"),
  projects: z.array(z.string()).min(1, "Выберите хотя бы один проект"),
  checklists: z.array(z.string()).min(1, "Выберите хотя бы один чек-лист"),
  tags: z.array(z.string()).min(1, "Выберите хотя бы один тег"),
  websiteUrl: z.string().url("Введите корректный URL").optional().or(z.literal("")),
  funPhrase: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function DocumentForm() {
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

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
      sources: [],
      directions: [],
      roles: [],
      projects: [],
      checklists: [],
      tags: [],
      websiteUrl: "",
      funPhrase: "",
    },
  });

  const file = watch("file");
  const sources = watch("sources");
  const directions = watch("directions");
  const roles = watch("roles");
  const projects = watch("projects");
  const checklists = watch("checklists");
  const tags = watch("tags");

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    
    // Добавляем служебные поля
    const submitData = {
      ...data,
      submissionDate: new Date().toISOString(),
      userName: "Текущий пользователь", // В реальном приложении - из auth
    };
    
    console.log("Отправка данных в Bpium:", submitData);
    
    // Симуляция отправки
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  const handleReset = () => {
    reset();
    setIsSubmitted(false);
  };

  if (isSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in-0 zoom-in-95 duration-500">
        <div className="p-4 bg-accent rounded-full mb-6">
          <CheckCircle className="h-12 w-12 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold mb-2">Документ принят!</h2>
        <p className="text-muted-foreground mb-6">
          Документ отправлен на проверку
        </p>
        <Button onClick={handleReset} variant="outline">
          Добавить ещё документ
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
          options={sourcesData}
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
          options={directionsData}
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
          options={rolesData}
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
          options={projectsData}
          selected={projects}
          onChange={(v) => setValue("projects", v, { shouldValidate: true })}
          placeholder="Выберите проекты"
        />
        {errors.projects && (
          <p className="text-sm text-destructive">{errors.projects.message}</p>
        )}
      </div>

      {/* Чек-листы */}
      <div className="space-y-2">
        <Label>
          Чек-листы <span className="text-destructive">*</span>
        </Label>
        <MultiSelect
          options={checklistsData}
          selected={checklists}
          onChange={(v) => setValue("checklists", v, { shouldValidate: true })}
          placeholder="Выберите чек-листы"
        />
        {errors.checklists && (
          <p className="text-sm text-destructive">{errors.checklists.message}</p>
        )}
      </div>

      {/* Теги */}
      <div className="space-y-2">
        <Label>
          Теги <span className="text-destructive">*</span>
        </Label>
        <MultiSelect
          options={tagsData}
          selected={tags}
          onChange={(v) => setValue("tags", v, { shouldValidate: true })}
          placeholder="Выберите теги"
          searchPlaceholder="Введите для поиска..."
        />
        {errors.tags && (
          <p className="text-sm text-destructive">{errors.tags.message}</p>
        )}
      </div>

      {/* Сайт / ссылка */}
      <div className="space-y-2">
        <Label htmlFor="websiteUrl">Сайт / ссылка</Label>
        <Input
          id="websiteUrl"
          placeholder="https://example.com"
          {...register("websiteUrl")}
          className="bg-card"
        />
        {errors.websiteUrl && (
          <p className="text-sm text-destructive">{errors.websiteUrl.message}</p>
        )}
      </div>

      {/* Юмор */}
      <div className="space-y-2 pt-4 border-t border-border">
        <Label htmlFor="funPhrase" className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Фраза для футболки (по желанию)
        </Label>
        <Input
          id="funPhrase"
          placeholder="Ваш креатив здесь..."
          {...register("funPhrase")}
          className="bg-card"
        />
      </div>

      {/* Кнопка отправки */}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent mr-2" />
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
