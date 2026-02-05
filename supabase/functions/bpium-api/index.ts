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
  title: '2',              // Название документа
  responsiblePerson: '3',  // ФИО ответственного
  sources: '4',            // Источники (связь)
  directions: '5',         // Направления (связь)
  roles: '6',              // Роли (связь)
  projects: '7',           // Проекты (связь)
  checklists: '8',         // Чек-листы (связь)
  tags: '10',              // Теги (связь)
  websiteUrl: '14',        // Ссылка
  funPhrase: '15',         // Фраза для футболки
  submissionDate: '16',    // Дата внесения
  file: '9',               // Файл документа
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
  
  console.log('=== CREATE RECORD ===');
  console.log('Catalog ID:', catalogId);
  console.log('Values:', JSON.stringify(values, null, 2));
  
  const payload = { values };

  // Проверка: все значения-объекты в values должны быть массивами
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && typeof value === 'object') {
      if (!Array.isArray(value)) {
        console.error(`Field ${key} is not an array:`, value);
      }
    }
  }

  console.log('Payload to Bpium:', JSON.stringify(payload, null, 2));
  
  const response = await fetch(`${domain}/api/v1/catalogs/${catalogId}/records`, {
    method: 'POST',
    headers: {
      'Authorization': getBpiumAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  console.log('Response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('=== BPIUM ERROR ===');
    console.error('Status:', response.status);
    console.error('Response:', errorText);
    throw new Error(`Failed to create record: ${errorText}`);
  }

  const result = await response.json();
  console.log('Bpium response:', JSON.stringify(result, null, 2));
  return result;
}

// Преобразование записей Bpium в формат для MultiSelect
function transformRecords(records: BpiumRecord[]): { value: string; label: string }[] {
  return records.map(record => ({
    value: record.id,
    label: String(record.values['2'] || record.id), // Поле 2 = Название
  }));
}

// Безопасное преобразование массива в ID записей для Bpium
function mapToLinks(ids: unknown): number[] {
  if (!ids || !Array.isArray(ids) || ids.length === 0) return [];
  return ids.map((id: string) => parseInt(id));
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
        try {
          const body = await req.json();
          console.log('=== RECEIVED BODY ===');
          console.log(JSON.stringify(body, null, 2));

          const values: Record<string, unknown> = {
            [DOCUMENT_FIELDS.title]: body.documentName || '',
            [DOCUMENT_FIELDS.responsiblePerson]: body.responsiblePerson || '',
            [DOCUMENT_FIELDS.submissionDate]: new Date().toISOString().split('.')[0] + 'Z',
          };

          // Добавляем URL только если заполнен
          if (body.websiteUrl && String(body.websiteUrl).trim() !== '') {
            values[DOCUMENT_FIELDS.websiteUrl] = body.websiteUrl;
          }

          // Добавляем фразу только если заполнена
          if (body.funPhrase && String(body.funPhrase).trim() !== '') {
            values[DOCUMENT_FIELDS.funPhrase] = body.funPhrase;
          }

          console.log('=== STEP 1: Basic fields OK ===');

          // Добавляем связанные поля в формате {catalogId, recordId}
          if (body.sourceIds && Array.isArray(body.sourceIds) && body.sourceIds.length > 0) {
            values[DOCUMENT_FIELDS.sources] = body.sourceIds.map((id: string) => ({
              catalogId: CATALOG_IDS.sources,
              recordId: parseInt(id)
            }));
            console.log('Sources OK:', values[DOCUMENT_FIELDS.sources]);
          }

          if (body.directionIds && Array.isArray(body.directionIds) && body.directionIds.length > 0) {
            values[DOCUMENT_FIELDS.directions] = body.directionIds.map((id: string) => ({
              catalogId: CATALOG_IDS.directions,
              recordId: parseInt(id)
            }));
            console.log('Directions OK:', values[DOCUMENT_FIELDS.directions]);
          }

          if (body.roleIds && Array.isArray(body.roleIds) && body.roleIds.length > 0) {
            values[DOCUMENT_FIELDS.roles] = body.roleIds.map((id: string) => ({
              catalogId: CATALOG_IDS.roles,
              recordId: parseInt(id)
            }));
            console.log('Roles OK:', values[DOCUMENT_FIELDS.roles]);
          }

          if (body.projectIds && Array.isArray(body.projectIds) && body.projectIds.length > 0) {
            values[DOCUMENT_FIELDS.projects] = body.projectIds.map((id: string) => ({
              catalogId: CATALOG_IDS.projects,
              recordId: parseInt(id)
            }));
            console.log('Projects OK:', values[DOCUMENT_FIELDS.projects]);
          }

          if (body.checklistIds && Array.isArray(body.checklistIds) && body.checklistIds.length > 0) {
            values[DOCUMENT_FIELDS.checklists] = body.checklistIds.map((id: string) => ({
              catalogId: CATALOG_IDS.checklists,
              recordId: parseInt(id)
            }));
            console.log('Checklists OK:', values[DOCUMENT_FIELDS.checklists]);
          }

          console.log('=== STEP 2: Links OK ===');

          // Теги - массив чисел
          if (body.tagIds && Array.isArray(body.tagIds) && body.tagIds.length > 0) {
            values[DOCUMENT_FIELDS.tags] = body.tagIds.map((id: string) => parseInt(id));
            console.log('Tags OK:', values[DOCUMENT_FIELDS.tags]);
          }

          console.log('=== STEP 3: Tags OK ===');

          // Файл
          if (body.file && body.file.name && body.file.base64) {
            values[DOCUMENT_FIELDS.file] = [{
              name: body.file.name,
              data: body.file.base64,
            }];
            console.log('File OK:', body.file.name);
          }

          console.log('=== STEP 4: File OK ===');
          console.log('=== SENDING TO BPIUM ===');
          console.log(JSON.stringify(values, null, 2));

          const record = await createRecord(CATALOG_IDS.documents, values);

          return new Response(JSON.stringify({ success: true, recordId: record.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (error: unknown) {
          console.error('=== ERROR IN SUBMIT-DOCUMENT ===');
          console.error(error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return new Response(
            JSON.stringify({ error: errorMessage, stack: error instanceof Error ? error.stack : '' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
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
