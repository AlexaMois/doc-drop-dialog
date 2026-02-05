import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BpiumAuthResponse {
  token: string;
}

interface BpiumCatalogRecord {
  id: string;
  values: Record<string, unknown>;
}

// Получение токена авторизации Bpium
async function getBpiumToken(): Promise<string> {
  const domain = Deno.env.get('BPIUM_DOMAIN');
  const login = Deno.env.get('BPIUM_LOGIN');
  const password = Deno.env.get('BPIUM_PASSWORD');

  if (!domain || !login || !password) {
    throw new Error('Bpium credentials not configured');
  }

  const response = await fetch(`${domain}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ login, password }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Bpium auth failed: ${error}`);
  }

  const data: BpiumAuthResponse = await response.json();
  return data.token;
}

// Получение записей каталога
async function fetchCatalog(token: string, catalogId: string): Promise<BpiumCatalogRecord[]> {
  const domain = Deno.env.get('BPIUM_DOMAIN');
  
  const response = await fetch(`${domain}/api/v1/catalogs/${catalogId}/records`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch catalog ${catalogId}: ${error}`);
  }

  return await response.json();
}

// Создание записи в каталоге
async function createRecord(
  token: string, 
  catalogId: string, 
  values: Record<string, unknown>
): Promise<BpiumCatalogRecord> {
  const domain = Deno.env.get('BPIUM_DOMAIN');
  
  const response = await fetch(`${domain}/api/v1/catalogs/${catalogId}/records`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create record: ${error}`);
  }

  return await response.json();
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Получаем токен для всех операций
    const token = await getBpiumToken();

    switch (action) {
      case 'get-catalogs': {
        // Получаем все справочные каталоги
        // ID каталогов нужно будет настроить в секретах или передать параметрами
        const catalogIds = {
          sources: url.searchParams.get('sources_id'),
          directions: url.searchParams.get('directions_id'),
          roles: url.searchParams.get('roles_id'),
          projects: url.searchParams.get('projects_id'),
          checklists: url.searchParams.get('checklists_id'),
          tags: url.searchParams.get('tags_id'),
        };

        const results: Record<string, { value: string; label: string }[]> = {};

        for (const [key, catalogId] of Object.entries(catalogIds)) {
          if (catalogId) {
            const records = await fetchCatalog(token, catalogId);
            // Преобразуем записи Bpium в формат для MultiSelect
            // Предполагаем, что название находится в поле "2" (стандартное поле Title в Bpium)
            results[key] = records.map(record => ({
              value: record.id,
              label: String(record.values['2'] || record.values['title'] || record.id),
            }));
          }
        }

        return new Response(JSON.stringify(results), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get-catalog': {
        const catalogId = url.searchParams.get('catalog_id');
        if (!catalogId) {
          throw new Error('catalog_id is required');
        }

        const records = await fetchCatalog(token, catalogId);
        const options = records.map(record => ({
          value: record.id,
          label: String(record.values['2'] || record.values['title'] || record.id),
        }));

        return new Response(JSON.stringify(options), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'submit-document': {
        const body = await req.json();
        const catalogId = Deno.env.get('BPIUM_CATALOG_ID_DOCS_UPLOAD') || '56';

        // Формируем значения для записи в Bpium
        // Структура полей зависит от конфигурации каталога в Bpium
        const values: Record<string, unknown> = {
          // Поля будут настроены в соответствии со структурой каталога 56
          // Примерная структура:
          '2': body.documentName, // Название документа
          '3': body.responsiblePerson, // ФИО ответственного
          '4': body.sourceIds, // Источники (связь с каталогом)
          '5': body.directionIds, // Направления
          '6': body.roleIds, // Роли
          '7': body.projectIds, // Проекты
          '8': body.checklistIds, // Чек-листы
          '9': body.tagIds, // Теги
          '10': body.websiteUrl, // Ссылка
          '11': body.funPhrase, // Фраза для футболки
          '12': body.submissionDate, // Дата отправки
        };

        const record = await createRecord(token, catalogId, values);

        return new Response(JSON.stringify({ success: true, recordId: record.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Use: get-catalogs, get-catalog, submit-document' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    console.error('Bpium API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
