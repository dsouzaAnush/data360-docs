const fs = require('fs/promises');
const path = require('path');
const YAML = require('yaml');

const ROOT_DIR = path.resolve(__dirname, '..');
const SPEC_PATH = path.join(ROOT_DIR, 'openapi', 'data360-api.yaml');
const CONNECT_API_DIR = path.join(ROOT_DIR, 'apis', 'connect-api');
const DOCS_JSON_PATH = path.join(ROOT_DIR, 'docs.json');
const OFFICIAL_REFERENCE_URL = 'https://developer.salesforce.com/docs/data/connectapi/references/spec';

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

const LEGACY_PAGES = [
  {
    file: 'data-ingestion.mdx',
    title: 'Data Ingestion in Connect REST API',
    description: 'Where ingestion-related operations appear in the official Data 360 Connect REST API spec.',
    target: '/apis/connect-api/data-streams',
    body: [
      'The official Connect REST API spec does not define the old `/ssot/streaming/{streamName}` or `/ssot/streaming-batch/{streamName}` routes that previously appeared here.',
      '',
      'Use the official Connect API families below when you are working with ingestion-adjacent setup and orchestration:',
      '',
      '- [Data Streams](/apis/connect-api/data-streams) for creating, updating, deleting, and running data streams.',
      '- [Data Lake Objects](/apis/connect-api/data-lake-objects) for DLO metadata operations.',
      '- [Data Model Objects](/apis/connect-api/data-model-objects) for DMO metadata operations.',
      '- [Data Transforms](/apis/connect-api/data-transforms) for transform lifecycle operations.'
    ]
  },
  {
    file: 'identity-resolution.mdx',
    title: 'Identity Resolution API',
    description: 'Compatibility page for the official Identity Resolutions Connect API family.',
    target: '/apis/connect-api/identity-resolutions',
    body: [
      'The official Connect REST API spec names this API family **Identity Resolutions** and uses `/ssot/identity-resolutions` routes.',
      '',
      'The old local paths under `/ssot/identity-resolution/rules` and `/ssot/identity-resolution/jobs` are not present in the current official spec.'
    ]
  },
  {
    file: 'sql-segment-rules.mdx',
    title: 'SQL Segment and Query Rules',
    description: 'Compatibility page for segment and SQL query operations in the official Connect API spec.',
    target: '/apis/connect-api/segments',
    body: [
      'The official Connect REST API spec exposes segment lifecycle operations under [Segments](/apis/connect-api/segments) and SQL query execution under [Query (Current)](/apis/connect-api/query-current).',
      '',
      'This repo previously carried a hand-written SQL validation guide here. The generated API reference now uses the official operation descriptions and schemas from Salesforce instead.'
    ]
  }
];

function normalizeText(value) {
  return String(value ?? '')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u00a0/g, ' ')
    .trim();
}

function frontmatterString(value) {
  return normalizeText(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function slugifyTag(tagName) {
  return normalizeText(tagName)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' ')
    .replace(/[()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeTableCell(value) {
  return normalizeText(value)
    .replace(/\|/g, '\\|')
    .replace(/\n+/g, '<br />');
}

function getOperations(spec) {
  const operations = [];

  for (const [apiPath, pathItem] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem || {})) {
      if (!HTTP_METHODS.has(method) || !operation || typeof operation !== 'object') {
        continue;
      }

      const tags = Array.isArray(operation.tags) && operation.tags.length ? operation.tags : ['Untagged'];
      const description = normalizeText(operation.description || '');
      const availableVersion = description.match(/\*\*Available Version:\*\*\s*([0-9.]+)/)?.[1] || '';

      operations.push({
        method: method.toUpperCase(),
        path: apiPath,
        summary: normalizeText(operation.summary || operation.operationId || `${method.toUpperCase()} ${apiPath}`),
        tag: tags[0],
        availableVersion
      });
    }
  }

  return operations;
}

function firstMeaningfulLine(description) {
  const lines = normalizeText(description)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('|') && !line.startsWith(':---'));

  return lines[0] || '';
}

function buildTagPage({ tag, operations, version }) {
  const firstOperation = operations[0];
  const openapi = firstOperation ? `${firstOperation.method} ${firstOperation.path}` : '';
  const summary = firstMeaningfulLine(tag.description) || `Official Data 360 Connect REST API endpoints for ${tag.name}.`;
  const rows = operations.map((operation) => {
    return `| \`${operation.method}\` | \`${escapeTableCell(operation.path)}\` | ${escapeTableCell(operation.summary)} | ${operation.availableVersion || '-'} |`;
  });
  const operationsContent = rows.length
    ? `| Method | Path | Summary | Available Version |\n| --- | --- | --- | --- |\n${rows.join('\n')}`
    : 'The official spec defines this tag but does not currently tag any operations with it. Check the neighboring API families in the generated overview and the full OpenAPI reference for related operations.';

  return `---\ntitle: "${frontmatterString(tag.name)}"\ndescription: "${frontmatterString(summary)}"\n${openapi ? `openapi: "${frontmatterString(openapi)}"\n` : ''}---\n\n# ${normalizeText(tag.name)}\n\n<Note>\nGenerated from the official Salesforce Data 360 Connect REST API spec (${version}). Run \`npm run sync:apis\` to refresh this page and \`openapi/data360-api.yaml\`.\n</Note>\n\n${summary}\n\n## Operations\n\n${operationsContent}\n\n## Source\n\n- [Official Data 360 Connect REST API reference](${OFFICIAL_REFERENCE_URL})\n`;
}

function buildIndexPage({ spec, tags, operationsByTag }) {
  const version = normalizeText(spec.info?.version);
  const title = normalizeText(spec.info?.title || 'Salesforce Data 360 Connect REST API');
  const serverUrl = normalizeText(spec.servers?.[0]?.url || 'https://{dne_cdpInstanceUrl}/services/data/v{version}');
  const rows = tags.map((tag) => {
    const operations = operationsByTag.get(tag.name) || [];
    const firstPath = operations[0]?.path || '-';
    const summary = firstMeaningfulLine(tag.description) || `Official endpoints for ${tag.name}.`;
    return `| [${escapeTableCell(tag.name)}](/apis/connect-api/${slugifyTag(tag.name)}) | ${operations.length} | \`${escapeTableCell(firstPath)}\` | ${escapeTableCell(summary)} |`;
  });

  return `---\ntitle: "Connect REST API Overview"\ndescription: "Official Salesforce Data 360 Connect REST API inventory generated from the Salesforce spec."\n---\n\n# ${title}\n\n<Snippet file="/snippets/note-rebranding.mdx" />\n\n<Note>\nThis Connect API section is generated from Salesforce's official OpenAPI spec (${version}). Run \`npm run sync:apis\` to refresh the spec, pages, and API Reference navigation together.\n</Note>\n\nData 360 Connect REST API manages and orchestrates Data 360 resources through Salesforce Connect REST endpoints. The checked-in OpenAPI file is the source of truth for the rendered API playground and the pages below.\n\n## Official Spec\n\n| Field | Value |\n| --- | --- |\n| Spec title | ${escapeTableCell(title)} |\n| Version | \`${escapeTableCell(version)}\` |\n| Base URL | \`${escapeTableCell(serverUrl)}\` |\n| API families | ${tags.length} |\n| Operations | ${Array.from(operationsByTag.values()).reduce((total, group) => total + group.length, 0)} |\n| Source | [Salesforce Developers](${OFFICIAL_REFERENCE_URL}) |\n\n## Authentication\n\nConnect REST API uses Salesforce OAuth for the Data 360 home org. Use the \`instance_url\` returned by the auth request as \`dne_cdpInstanceUrl\`, then call paths under \`/services/data/v{version}\`.\n\n## API Families\n\n| Family | Operations | First Path | Description |\n| --- | ---: | --- | --- |\n${rows.join('\n')}\n`;
}

function buildLegacyPage(page, version) {
  return `---\ntitle: "${frontmatterString(page.title)}"\ndescription: "${frontmatterString(page.description)}"\n---\n\n# ${normalizeText(page.title)}\n\n<Note>\nThis compatibility page was updated during the official spec sync for Data 360 Connect REST API ${version}. The active generated reference is [here](${page.target}).\n</Note>\n\n${page.body.join('\n')}\n\n## Official Source\n\n- [Official Data 360 Connect REST API reference](${OFFICIAL_REFERENCE_URL})\n`;
}

async function updateDocsJson(generatedPages) {
  const docs = JSON.parse(await fs.readFile(DOCS_JSON_PATH, 'utf8'));
  const apiTab = docs.navigation?.tabs?.find((tab) => tab.tab === 'API Reference');

  if (!apiTab) {
    throw new Error('Could not find API Reference tab in docs.json');
  }

  let connectGroup = apiTab.groups.find((group) => group.group === 'Connect REST API');
  if (!connectGroup) {
    connectGroup = { group: 'Connect REST API', pages: [] };
    apiTab.groups.unshift(connectGroup);
  }

  connectGroup.pages = ['apis/connect-api/index', ...generatedPages];

  let queryGroup = apiTab.groups.find((group) => group.group === 'Query API');
  if (!queryGroup) {
    queryGroup = {
      group: 'Query API',
      pages: []
    };
    apiTab.groups.splice(apiTab.groups.indexOf(connectGroup) + 1, 0, queryGroup);
  }

  queryGroup.pages = [
    'apis/query-api/index',
    'apis/query-api/query-services',
    'apis/query-api/profile-api',
    'apis/query-api/metadata-api',
    'apis/query-api/calculated-insights-api',
    'apis/query-api/universal-id-lookup',
    'apis/query-api/data-graphs',
    'apis/query-api/status-codes',
    'apis/query-api/sql-reference'
  ];

  await fs.writeFile(DOCS_JSON_PATH, `${JSON.stringify(docs, null, 2)}\n`, 'utf8');
}

async function generateConnectApiPages() {
  const text = await fs.readFile(SPEC_PATH, 'utf8');
  const spec = YAML.parse(text);

  if (!spec?.paths || !Array.isArray(spec.tags)) {
    throw new Error(`OpenAPI spec at ${SPEC_PATH} is missing paths or tags`);
  }

  const version = normalizeText(spec.info?.version || 'unknown');
  const operations = getOperations(spec);
  const operationsByTag = new Map();

  for (const operation of operations) {
    if (!operationsByTag.has(operation.tag)) {
      operationsByTag.set(operation.tag, []);
    }
    operationsByTag.get(operation.tag).push(operation);
  }

  const generatedPages = [];

  await fs.mkdir(CONNECT_API_DIR, { recursive: true });
  await fs.writeFile(
    path.join(CONNECT_API_DIR, 'index.mdx'),
    buildIndexPage({ spec, tags: spec.tags, operationsByTag }),
    'utf8'
  );

  for (const tag of spec.tags) {
    const slug = slugifyTag(tag.name);
    const operationsForTag = operationsByTag.get(tag.name) || [];
    const fileName = `${slug}.mdx`;

    await fs.writeFile(
      path.join(CONNECT_API_DIR, fileName),
      buildTagPage({ tag, operations: operationsForTag, version }),
      'utf8'
    );
    generatedPages.push(`apis/connect-api/${slug}`);
  }

  for (const legacyPage of LEGACY_PAGES) {
    await fs.writeFile(
      path.join(CONNECT_API_DIR, legacyPage.file),
      buildLegacyPage(legacyPage, version),
      'utf8'
    );
  }

  await updateDocsJson(generatedPages);

  return {
    version,
    tagCount: spec.tags.length,
    pathCount: Object.keys(spec.paths).length,
    operationCount: operations.length,
    generatedPageCount: generatedPages.length
  };
}

if (require.main === module) {
  generateConnectApiPages()
    .then((summary) => {
      console.log(`Generated ${summary.generatedPageCount} Connect API pages from spec ${summary.version}.`);
      console.log(`Tags: ${summary.tagCount}; paths: ${summary.pathCount}; operations: ${summary.operationCount}.`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { generateConnectApiPages };
