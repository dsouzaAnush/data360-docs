const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const YAML = require('yaml');
const { generateConnectApiPages } = require('./generate-connect-api-pages');

const ROOT_DIR = path.resolve(__dirname, '..');
const SPEC_PATH = path.join(ROOT_DIR, 'openapi', 'data360-api.yaml');
const MINTLIFY_SPEC_PATH = path.join(ROOT_DIR, 'openapi', 'data360-api.mintlify.yaml');
const SPEC_URL = 'https://developer.salesforce.com/static/datacloud/connectapi/spec/cdp-connect-api-Swagger.yaml';
const REFERER_URL = 'https://developer.salesforce.com/docs/data/connectapi/references/spec';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function normalizeSpecText(text) {
  return text.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n?$/, '\n');
}

function operationCount(paths) {
  return Object.values(paths || {}).reduce((total, pathItem) => {
    return total + Object.keys(pathItem || {}).filter((method) => HTTP_METHODS.has(method)).length;
  }, 0);
}

function parseAndValidateSpec(text) {
  if (!text.startsWith('openapi:')) {
    throw new Error('Downloaded response does not look like an OpenAPI YAML document.');
  }

  const spec = YAML.parse(text);
  const title = spec?.info?.title;
  const version = spec?.info?.version;
  const paths = spec?.paths;
  const tags = spec?.tags;

  if (title !== 'Salesforce Data 360 Connect REST API') {
    throw new Error(`Unexpected spec title: ${title}`);
  }

  if (!version) {
    throw new Error('Spec is missing info.version.');
  }

  if (!paths || Object.keys(paths).length === 0) {
    throw new Error('Spec is missing paths.');
  }

  if (!Array.isArray(tags) || tags.length === 0) {
    throw new Error('Spec is missing tags.');
  }

  return {
    spec,
    title,
    version: String(version),
    pathCount: Object.keys(paths).length,
    tagCount: tags.length,
    operationCount: operationCount(paths)
  };
}

async function downloadOfficialSpec() {
  const response = await fetch(SPEC_URL, {
    headers: {
      Accept: 'text/yaml, application/yaml, */*',
      Referer: REFERER_URL,
      'User-Agent': USER_AGENT
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download official spec: ${response.status} ${response.statusText}`);
  }

  const rawText = await response.text();
  const text = normalizeSpecText(rawText);
  const metadata = {
    etag: response.headers.get('etag') || '',
    lastModified: response.headers.get('last-modified') || '',
    contentType: response.headers.get('content-type') || '',
    rawSha256: sha256(rawText),
    normalized: rawText !== text
  };

  return { text, metadata };
}

function printSummary(label, summary, hash) {
  console.log(`${label}: ${summary.title} ${summary.version}`);
  console.log(`  tags=${summary.tagCount} paths=${summary.pathCount} operations=${summary.operationCount}`);
  console.log(`  sha256=${hash}`);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensurePathParametersRequired(spec) {
  let fixCount = 0;

  for (const pathItem of Object.values(spec.paths || {})) {
    const parameterLists = [];
    if (Array.isArray(pathItem.parameters)) parameterLists.push(pathItem.parameters);

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (Array.isArray(operation?.parameters)) parameterLists.push(operation.parameters);
    }

    for (const parameters of parameterLists) {
      for (const parameter of parameters) {
        if (parameter && !parameter.$ref && parameter.in === 'path' && parameter.required !== true) {
          parameter.required = true;
          fixCount += 1;
        }
      }
    }
  }

  return fixCount;
}

function mintlifySpecTextFromOfficial(spec) {
  const mintlifySpec = cloneJson(spec);
  const pathParameterFixCount = ensurePathParametersRequired(mintlifySpec);
  const text = normalizeSpecText(YAML.stringify(mintlifySpec, { lineWidth: 0 }));
  return { text, pathParameterFixCount };
}

async function writeMintlifySpec(officialSpec) {
  const { text, pathParameterFixCount } = mintlifySpecTextFromOfficial(officialSpec);
  await fs.writeFile(MINTLIFY_SPEC_PATH, text, 'utf8');
  console.log(`Wrote ${path.relative(ROOT_DIR, MINTLIFY_SPEC_PATH)}.`);
  if (pathParameterFixCount) {
    console.log(`Mintlify compatibility: marked ${pathParameterFixCount} official path parameter(s) as required.`);
  }
}

async function checkMintlifySpec(officialSpec) {
  const { text, pathParameterFixCount } = mintlifySpecTextFromOfficial(officialSpec);
  const localText = await fs.readFile(MINTLIFY_SPEC_PATH, 'utf8');

  if (localText !== text) {
    throw new Error(`Local ${path.relative(ROOT_DIR, MINTLIFY_SPEC_PATH)} is out of sync with the official Salesforce spec. Run npm run sync:apis.`);
  }

  console.log(`${path.relative(ROOT_DIR, MINTLIFY_SPEC_PATH)} matches the generated Mintlify-compatible spec.`);
  if (pathParameterFixCount) {
    console.log(`Mintlify compatibility: ${pathParameterFixCount} official path parameter(s) require deploy-time normalization.`);
  }
}

async function checkForDrift(officialText, officialSummary) {
  const localText = await fs.readFile(SPEC_PATH, 'utf8');
  const localSummary = parseAndValidateSpec(localText);
  const officialHash = sha256(officialText);
  const localHash = sha256(localText);

  printSummary('local', localSummary, localHash);
  printSummary('official', officialSummary, officialHash);

  if (localText !== officialText) {
    throw new Error('Local openapi/data360-api.yaml is out of sync with the official Salesforce spec. Run npm run sync:apis.');
  }

  console.log('Local OpenAPI spec matches the official Salesforce spec.');
  await checkMintlifySpec(officialSummary.spec);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const shouldCheck = args.has('--check');
  const shouldGeneratePages = args.has('--generate-pages');
  const { text, metadata } = await downloadOfficialSpec();
  const summary = parseAndValidateSpec(text);

  printSummary('official', summary, sha256(text));
  console.log(`source=${SPEC_URL}`);
  if (metadata.etag) console.log(`etag=${metadata.etag}`);
  if (metadata.lastModified) console.log(`last-modified=${metadata.lastModified}`);
  if (metadata.normalized) console.log(`raw-sha256=${metadata.rawSha256}`);
  if (metadata.normalized) console.log('normalized=trimmed trailing whitespace');

  if (shouldCheck) {
    await checkForDrift(text, summary);
    return;
  }

  await fs.mkdir(path.dirname(SPEC_PATH), { recursive: true });
  await fs.writeFile(SPEC_PATH, text, 'utf8');
  console.log(`Wrote ${path.relative(ROOT_DIR, SPEC_PATH)}.`);
  await writeMintlifySpec(summary.spec);

  if (shouldGeneratePages) {
    const pageSummary = await generateConnectApiPages();
    console.log(`Generated ${pageSummary.generatedPageCount} Connect API pages.`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
