import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CatalogOption {
  value: string;
  label: string;
}

interface CatalogsResponse {
  sources: CatalogOption[];
  directions: CatalogOption[];
  roles: CatalogOption[];
  projects: CatalogOption[];
  checklists: CatalogOption[];
  tags: CatalogOption[];
}

// Запрос к edge function для получения всех каталогов
async function fetchAllCatalogs(): Promise<CatalogsResponse> {
  const { data, error } = await supabase.functions.invoke('bpium-api', {
    body: null,
    method: 'GET',
  });

  // supabase.functions.invoke не поддерживает query params напрямую,
  // используем fetch с правильным URL
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  const response = await fetch(
    `${supabaseUrl}/functions/v1/bpium-api?action=get-catalogs`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch catalogs: ${errorText}`);
  }

  return await response.json();
}

export function useAllCatalogs() {
  const query = useQuery({
    queryKey: ["bpium-catalogs"],
    queryFn: fetchAllCatalogs,
    staleTime: 5 * 60 * 1000, // Кэшируем на 5 минут
    gcTime: 10 * 60 * 1000,
  });

  return {
    sources: { data: query.data?.sources, isLoading: query.isLoading },
    directions: { data: query.data?.directions, isLoading: query.isLoading },
    roles: { data: query.data?.roles, isLoading: query.isLoading },
    projects: { data: query.data?.projects, isLoading: query.isLoading },
    checklists: { data: query.data?.checklists, isLoading: query.isLoading },
    tags: { data: query.data?.tags, isLoading: query.isLoading },
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}

// Отправка документа в Bpium
export async function submitDocumentToBpium(data: {
  documentName: string;
  responsiblePerson: string;
  file: { name: string; base64: string };
  sourceIds: string[];
  directionIds: string[];
  roleIds: string[];
  projectIds: string[];
  checklistIds: string[];
  tagIds: string[];
  websiteUrl: string | null;
  funPhrase: string | null;
  submissionDate: string;
}): Promise<{ success: boolean; recordId: string }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  const response = await fetch(
    `${supabaseUrl}/functions/v1/bpium-api?action=submit-document`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to submit document: ${errorText}`);
  }

  return await response.json();
}
