import { useQuery } from "@tanstack/react-query";

export interface CatalogOption {
  value: string;
  label: string;
}

// Заглушки для каталогов Bpium - будут заменены на реальные API-вызовы
const mockCatalogs: Record<string, CatalogOption[]> = {
  sources: [
    { value: "source-1", label: "Внутренние регламенты" },
    { value: "source-2", label: "Внешние документы" },
    { value: "source-3", label: "Законодательство РФ" },
    { value: "source-4", label: "Корпоративные стандарты" },
    { value: "source-5", label: "Методические указания" },
  ],
  directions: [
    { value: "dir-1", label: "IT-инфраструктура" },
    { value: "dir-2", label: "Бухгалтерия" },
    { value: "dir-3", label: "Кадры и HR" },
    { value: "dir-4", label: "Логистика" },
    { value: "dir-5", label: "Маркетинг" },
    { value: "dir-6", label: "Производство" },
    { value: "dir-7", label: "Продажи" },
  ],
  roles: [
    { value: "role-1", label: "Администратор" },
    { value: "role-2", label: "Аналитик" },
    { value: "role-3", label: "Менеджер" },
    { value: "role-4", label: "Руководитель" },
    { value: "role-5", label: "Специалист" },
    { value: "role-6", label: "Стажёр" },
  ],
  projects: [
    { value: "proj-1", label: "Автоматизация процессов" },
    { value: "proj-2", label: "Внедрение CRM" },
    { value: "proj-3", label: "Модернизация склада" },
    { value: "proj-4", label: "Оптимизация логистики" },
    { value: "proj-5", label: "Цифровая трансформация" },
  ],
  checklists: [
    { value: "check-1", label: "Адаптация нового сотрудника" },
    { value: "check-2", label: "Ежемесячная отчётность" },
    { value: "check-3", label: "Закрытие проекта" },
    { value: "check-4", label: "Подготовка к аудиту" },
    { value: "check-5", label: "Приёмка товара" },
  ],
  tags: [
    { value: "tag-1", label: "Важно" },
    { value: "tag-2", label: "Срочно" },
    { value: "tag-3", label: "Архив" },
    { value: "tag-4", label: "Новое" },
    { value: "tag-5", label: "Обновлено" },
    { value: "tag-6", label: "На проверке" },
    { value: "tag-7", label: "Утверждено" },
    { value: "tag-8", label: "Регламент" },
    { value: "tag-9", label: "Инструкция" },
    { value: "tag-10", label: "Отчёт" },
    { value: "tag-11", label: "Договор" },
    { value: "tag-12", label: "Приказ" },
    { value: "tag-13", label: "Техническая документация" },
    { value: "tag-14", label: "Финансы" },
    { value: "tag-15", label: "HR" },
  ],
};

// Симуляция API-запроса к Bpium
async function fetchCatalog(catalogName: string): Promise<CatalogOption[]> {
  // TODO: Заменить на реальный API-вызов к Bpium
  // const response = await fetch(`https://your-bpium-instance.bpium.ru/api/v1/catalogs/${catalogId}/records`);
  // return response.json();
  
  await new Promise((resolve) => setTimeout(resolve, 300)); // Имитация задержки сети
  return mockCatalogs[catalogName] || [];
}

export function useBpiumCatalog(catalogName: string) {
  return useQuery({
    queryKey: ["bpium-catalog", catalogName],
    queryFn: () => fetchCatalog(catalogName),
    staleTime: 5 * 60 * 1000, // Кэшируем на 5 минут
    gcTime: 10 * 60 * 1000,
  });
}

export function useAllCatalogs() {
  const sources = useBpiumCatalog("sources");
  const directions = useBpiumCatalog("directions");
  const roles = useBpiumCatalog("roles");
  const projects = useBpiumCatalog("projects");
  const checklists = useBpiumCatalog("checklists");
  const tags = useBpiumCatalog("tags");

  return {
    sources,
    directions,
    roles,
    projects,
    checklists,
    tags,
    isLoading:
      sources.isLoading ||
      directions.isLoading ||
      roles.isLoading ||
      projects.isLoading ||
      checklists.isLoading ||
      tags.isLoading,
  };
}
