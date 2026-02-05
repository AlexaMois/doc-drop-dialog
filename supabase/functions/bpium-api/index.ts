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

// Безопасное преобразование массива в связи Bpium
function mapToLinks(ids: unknown, catalogId: string): { catalogId: string; recordId: number }[] {
  if (!ids || !Array.isArray(ids) || ids.length === 0) return [];
  return ids.map((id: string) => ({ 
    catalogId, 
    recordId: parseInt(id) 
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

        console.log('Received body:', JSON.stringify(body, null, 2));

        // Формируем значения для записи в Bpium
        const values: Record<string, unknown> = {
          [DOCUMENT_FIELDS.title]: body.documentName || '',
          [DOCUMENT_FIELDS.responsiblePerson]: body.responsiblePerson || '',
          [DOCUMENT_FIELDS.websiteUrl]: body.websiteUrl || '',
          [DOCUMENT_FIELDS.funPhrase]: body.funPhrase || '',
          [DOCUMENT_FIELDS.submissionDate]: body.submissionDate || new Date().toISOString(),
        };

        // Добавляем связанные поля только если есть данные
        const sourceLinks = mapToLinks(body.sourceIds, CATALOG_IDS.sources);
        if (sourceLinks.length > 0) values[DOCUMENT_FIELDS.sources] = sourceLinks;

        const directionLinks = mapToLinks(body.directionIds, CATALOG_IDS.directions);
        if (directionLinks.length > 0) values[DOCUMENT_FIELDS.directions] = directionLinks;

        const roleLinks = mapToLinks(body.roleIds, CATALOG_IDS.roles);
        if (roleLinks.length > 0) values[DOCUMENT_FIELDS.roles] = roleLinks;

        const projectLinks = mapToLinks(body.projectIds, CATALOG_IDS.projects);
        if (projectLinks.length > 0) values[DOCUMENT_FIELDS.projects] = projectLinks;

        const checklistLinks = mapToLinks(body.checklistIds, CATALOG_IDS.checklists);
        if (checklistLinks.length > 0) values[DOCUMENT_FIELDS.checklists] = checklistLinks;

        // Теги как простой массив
        if (body.tagIds && Array.isArray(body.tagIds) && body.tagIds.length > 0) {
          values[DOCUMENT_FIELDS.tags] = body.tagIds;
        }

        // Добавляем файл, если передан
        if (body.file && body.file.name && body.file.base64) {
          values[DOCUMENT_FIELDS.file] = [{
            name: body.file.name,
            data: body.file.base64,
          }];
        }

        console.log('Creating record with values:', JSON.stringify(values, null, 2));

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
