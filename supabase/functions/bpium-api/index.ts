// Bpium API Integration - v4 with file upload via Bpium Files API

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ID каталогов в Bpium (справочники)
const CATALOG_IDS = {
  documents: '56',      // Документы (загрузка) АТС
  directions: '55',     // Направления АТС
  roles: '57',          // Роли АТС
  projects: '54',       // Проекты АТС
  sources: '59',        // Источники АТС
};

// Правильный маппинг полей для каталога документов (ID=56)
const DOCUMENT_FIELDS = {
  title: '2',             // Название (text)
  file: '3',              // Файл (file, single)
  directions: '4',        // Направление (object, связь с 55, multiselect)
  roles: '5',             // Роли (object, связь с 57, multiselect)
  projects: '6',          // Проекты (object, связь с 54, multiselect)
  artifacts: '10',        // Артефакты (file, multiselect)
  websiteUrl: '11',       // Сайт/ссылка (contact/site)
  status: '12',           // Статус (dropdown: 1=Черновик, 2=На проверке, 3=Утверждён, 4=Отклонён)
  sources: '13',          // Источник (object, связь с 59, single)
  tags: '14',             // Теги (checkboxes, НЕ связанный объект!)
  responsiblePerson: '15', // ФИО ответственного (text)
  submissionDate: '16',   // Дата внесения (date)
};

interface BpiumRecord {
  id: string;
  values: Record<string, unknown>;
}

function getBpiumAuthHeaders(): { Authorization: string; 'Content-Type': string } {
  const domain = Deno.env.get('BPIUM_DOMAIN');
  const login = Deno.env.get('BPIUM_LOGIN');
  const password = Deno.env.get('BPIUM_PASSWORD');

  if (!domain || !login || !password) {
    throw new Error('Bpium credentials not configured');
  }

  const credentials = btoa(`${login}:${password}`);
  
  return {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/json',
  };
}

async function fetchCatalog(headers: { Authorization: string; 'Content-Type': string }, catalogId: string): Promise<BpiumRecord[]> {
  const domain = Deno.env.get('BPIUM_DOMAIN');
  
  const response = await fetch(`${domain}/api/v1/catalogs/${catalogId}/records`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch catalog ${catalogId}: ${error}`);
  }

  return await response.json();
}

async function fetchCatalogInfo(headers: { Authorization: string; 'Content-Type': string }, catalogId: string): Promise<unknown> {
  const domain = Deno.env.get('BPIUM_DOMAIN');
  
  const response = await fetch(`${domain}/api/v1/catalogs/${catalogId}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch catalog info ${catalogId}: ${error}`);
  }

  return await response.json();
}

// Примечание: Bpium Files API возвращает "Not implement yet"
// Используем data URL напрямую для небольших файлов (до 5MB)

async function createRecord(
  headers: { Authorization: string; 'Content-Type': string }, 
  catalogId: string, 
  values: Record<string, unknown>
): Promise<BpiumRecord> {
  const domain = Deno.env.get('BPIUM_DOMAIN');
  
  const response = await fetch(`${domain}/api/v1/catalogs/${catalogId}/records`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ values }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create record: ${error}`);
  }

  return await response.json();
}

function transformRecords(records: BpiumRecord[]): { value: string; label: string }[] {
  return records.map(record => ({
    value: record.id,
    label: String(record.values['2'] || record.id),
  }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const authHeaders = getBpiumAuthHeaders();

    switch (action) {
      case 'get-catalog-structure': {
        const catalogId = url.searchParams.get('catalogId') || CATALOG_IDS.documents;
        const catalogInfo = await fetchCatalogInfo(authHeaders, catalogId);
        return new Response(JSON.stringify(catalogInfo), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get-catalogs': {
        const [directionsRecords, rolesRecords, projectsRecords, sourcesRecords] = 
          await Promise.all([
            fetchCatalog(authHeaders, CATALOG_IDS.directions),
            fetchCatalog(authHeaders, CATALOG_IDS.roles),
            fetchCatalog(authHeaders, CATALOG_IDS.projects),
            fetchCatalog(authHeaders, CATALOG_IDS.sources),
          ]);

        // Теги загружаются из структуры каталога (поле 14 - checkboxes)
        // Если в Bpium теги не настроены, используем тестовый набор
        const FALLBACK_TAGS = [
          { value: "1", label: "БДД" },
          { value: "2", label: "Охрана труда" },
          { value: "3", label: "Пожарная безопасность" },
          { value: "4", label: "Инструкция" },
          { value: "5", label: "Положение" },
          { value: "6", label: "Приказ" },
          { value: "7", label: "Памятка" },
          { value: "8", label: "Регламент" },
          { value: "9", label: "Водитель" },
          { value: "10", label: "Механик" },
          { value: "11", label: "ГСМ" },
          { value: "12", label: "Медосмотр" },
          { value: "13", label: "Обучение" },
          { value: "14", label: "Аттестация" },
          { value: "15", label: "Проверка" },
        ];

        const catalogInfo = await fetchCatalogInfo(authHeaders, CATALOG_IDS.documents) as { fields: Array<{ id: string; config?: { items?: Array<{ id: string; name: string }> } }> };
        const tagsField = catalogInfo.fields?.find(f => f.id === '14');
        const tagsItems = tagsField?.config?.items || [];
        
        // Флаг показывает, используются ли реальные теги из Bpium или fallback
        const usingFallbackTags = tagsItems.length === 0;
        
        const tags = usingFallbackTags 
          ? FALLBACK_TAGS
          : tagsItems.map((item: { id: string; name: string }) => ({
              value: item.id,
              label: item.name,
            }));

        const result = {
          directions: transformRecords(directionsRecords),
          roles: transformRecords(rolesRecords),
          projects: transformRecords(projectsRecords),
          sources: transformRecords(sourcesRecords),
          checklists: [], // Нет отдельного каталога чек-листов
          tags: tags,
          // Сообщаем клиенту, что теги — демо и не должны отправляться в Bpium
          tagsAreFallback: usingFallbackTags,
        };

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'submit-document': {
        const body = await req.json();

        // Для полей типа "связанный объект" (object) формат ВСЕГДА массив:
        // [{ catalogId, recordId }, ...]
        // Даже для single-select Bpium ожидает массив с одним элементом
        const toLinkedRecords = (ids: string[] | undefined, catalogId: string) => {
          if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return [];
          }
          return ids.map(id => ({ catalogId, recordId: id }));
        };

        // Формируем значения для записи
        const values: Record<string, unknown> = {};

        // Текстовые поля
        if (body.documentName) values[DOCUMENT_FIELDS.title] = body.documentName;
        if (body.responsiblePerson) values[DOCUMENT_FIELDS.responsiblePerson] = body.responsiblePerson;

        // Связанные объекты (object type) - ВСЕ передаются как массивы
        const sources = toLinkedRecords(body.sourceIds, CATALOG_IDS.sources);
        if (sources.length > 0) values[DOCUMENT_FIELDS.sources] = sources;
        
        const directions = toLinkedRecords(body.directionIds, CATALOG_IDS.directions);
        if (directions.length > 0) values[DOCUMENT_FIELDS.directions] = directions;
        
        const roles = toLinkedRecords(body.roleIds, CATALOG_IDS.roles);
        if (roles.length > 0) values[DOCUMENT_FIELDS.roles] = roles;
        
        const projects = toLinkedRecords(body.projectIds, CATALOG_IDS.projects);
        if (projects.length > 0) values[DOCUMENT_FIELDS.projects] = projects;

        // Теги (checkboxes) - просто массив ID
        if (body.tagIds && body.tagIds.length > 0) {
          values[DOCUMENT_FIELDS.tags] = body.tagIds;
        }

        // Сайт/ссылка (contact type) - формат: [{contact: url, comment: ""}]
        if (body.websiteUrl) {
          values[DOCUMENT_FIELDS.websiteUrl] = [{
            contact: body.websiteUrl,
            comment: ""
          }];
        }

        // Дата внесения
        if (body.submissionDate) {
          values[DOCUMENT_FIELDS.submissionDate] = body.submissionDate;
        }

        // Статус - устанавливаем "Черновик" (1) по умолчанию
        values[DOCUMENT_FIELDS.status] = ['1'];

        // Файл - используем URL из Supabase Storage
        if (body.fileUrl) {
          values[DOCUMENT_FIELDS.file] = [{
            src: body.fileUrl,
            title: body.fileName || 'document',
          }];
          console.log(`File attached: ${body.fileName} -> ${body.fileUrl}`);
        }

        console.log('Submitting to Bpium catalog 56:', JSON.stringify({ ...values, [DOCUMENT_FIELDS.file]: '[FILE]' }, null, 2));

        const record = await createRecord(authHeaders, CATALOG_IDS.documents, values);

        return new Response(JSON.stringify({ success: true, recordId: record.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Use: get-catalogs, get-catalog-structure, submit-document' }),
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
