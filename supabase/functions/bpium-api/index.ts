import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ID каталогов в Bpium
const CATALOG_IDS = {
  documents: '56',      // Документы (загрузка) АТС
  directions: '55',     // Направления АТС
  roles: '57',          // Роли АТС
  projects: '54',       // Проекты АТС
  sources: '59',        // Источники АТС
  checklists: '58',     // Чек-листы АТС (предположительно)
  tags: '60',           // Теги АТС (предположительно)
};

// Маппинг полей для каталога документов (ID=56)
const DOCUMENT_FIELDS = {
  title: '2',           // Название документа
  responsiblePerson: '3', // ФИО ответственного
  sources: '4',         // Источники (связь)
  directions: '5',      // Направления (связь)
  roles: '6',           // Роли (связь)
  projects: '10',       // Проекты (связь)
  checklists: '11',     // Чек-листы (связь)
  tags: '13',           // Теги (связь)
  websiteUrl: '14',     // Ссылка
  funPhrase: '15',      // Фраза для футболки
  file: '16',           // Файл документа
  submissionDate: '17', // Дата внесения
};

interface BpiumRecord {
  id: string;
  values: Record<string, unknown>;
}

// Получение заголовка авторизации Basic Auth
function getBpiumAuthHeader(): string {
  const login = Deno.env.get('BPIUM_LOGIN');
  const password = Deno.env.get('BPIUM_PASSWORD');

  if (!login || !password) {
    throw new Error('Bpium credentials not configured');
  }

  // Кодируем логин:пароль в Base64
  const credentials = btoa(`${login}:${password}`);
  return `Basic ${credentials}`;
}

// Получение записей каталога
async function fetchCatalog(catalogId: string): Promise<BpiumRecord[]> {
  const domain = Deno.env.get('BPIUM_DOMAIN');
  
  const response = await fetch(`${domain}/api/v1/catalogs/${catalogId}/records`, {
    method: 'GET',
    headers: {
      'Authorization': getBpiumAuthHeader(),
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
  catalogId: string, 
  values: Record<string, unknown>
): Promise<BpiumRecord> {
  const domain = Deno.env.get('BPIUM_DOMAIN');
  
  const response = await fetch(`${domain}/api/v1/catalogs/${catalogId}/records`, {
    method: 'POST',
    headers: {
      'Authorization': getBpiumAuthHeader(),
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

// Преобразование записей Bpium в формат для MultiSelect
function transformRecords(records: BpiumRecord[]): { value: string; label: string }[] {
  return records.map(record => ({
    value: record.id,
    label: String(record.values['2'] || record.id), // Поле 2 = Название
  }));
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    switch (action) {
      case 'get-catalogs': {
        // Загружаем все справочники параллельно
        const [directionsRecords, rolesRecords, projectsRecords, sourcesRecords, checklistsRecords, tagsRecords] = 
          await Promise.all([
            fetchCatalog(CATALOG_IDS.directions),
            fetchCatalog(CATALOG_IDS.roles),
            fetchCatalog(CATALOG_IDS.projects),
            fetchCatalog(CATALOG_IDS.sources),
            fetchCatalog(CATALOG_IDS.checklists),
            fetchCatalog(CATALOG_IDS.tags),
          ]);

        const result = {
          directions: transformRecords(directionsRecords),
          roles: transformRecords(rolesRecords),
          projects: transformRecords(projectsRecords),
          sources: transformRecords(sourcesRecords),
          checklists: transformRecords(checklistsRecords),
          tags: transformRecords(tagsRecords),
        };

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'submit-document': {
        const body = await req.json();

        // Формируем значения для записи в Bpium
        // Связанные поля отправляются как массивы объектов {catalogId, recordId}
        const values: Record<string, unknown> = {
          [DOCUMENT_FIELDS.title]: body.documentName,
          [DOCUMENT_FIELDS.responsiblePerson]: body.responsiblePerson,
          [DOCUMENT_FIELDS.sources]: body.sourceIds.map((id: string) => ({ 
            catalogId: CATALOG_IDS.sources, 
            recordId: parseInt(id) 
          })),
          [DOCUMENT_FIELDS.directions]: body.directionIds.map((id: string) => ({ 
            catalogId: CATALOG_IDS.directions, 
            recordId: parseInt(id) 
          })),
          [DOCUMENT_FIELDS.roles]: body.roleIds.map((id: string) => ({ 
            catalogId: CATALOG_IDS.roles, 
            recordId: parseInt(id) 
          })),
          [DOCUMENT_FIELDS.projects]: body.projectIds.map((id: string) => ({ 
            catalogId: CATALOG_IDS.projects, 
            recordId: parseInt(id) 
          })),
          [DOCUMENT_FIELDS.tags]: body.tagIds || [],
          [DOCUMENT_FIELDS.websiteUrl]: body.websiteUrl || '',
          [DOCUMENT_FIELDS.funPhrase]: body.funPhrase || '',
          [DOCUMENT_FIELDS.submissionDate]: body.submissionDate,
        };

        // Добавляем чек-листы только если заполнены
        if (body.checklistIds && body.checklistIds.length > 0) {
          values[DOCUMENT_FIELDS.checklists] = body.checklistIds.map((id: string) => ({ 
            catalogId: CATALOG_IDS.checklists, 
            recordId: parseInt(id) 
          }));
        }

        // Добавляем файл, если передан
        if (body.file) {
          values[DOCUMENT_FIELDS.file] = [{
            name: body.file.name,
            data: body.file.base64,
          }];
        }

        const record = await createRecord(CATALOG_IDS.documents, values);

        return new Response(JSON.stringify({ success: true, recordId: record.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Use: get-catalogs, submit-document' }),
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
