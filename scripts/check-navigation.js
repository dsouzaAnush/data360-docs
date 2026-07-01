const fs = require('fs/promises');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DOCS_JSON_PATH = path.join(ROOT_DIR, 'docs.json');

function collectPages(docs) {
  const pages = [];

  for (const tab of docs.navigation?.tabs || []) {
    for (const group of tab.groups || []) {
      for (const page of group.pages || []) {
        pages.push(page);
      }
    }
  }

  return pages;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const docs = JSON.parse(await fs.readFile(DOCS_JSON_PATH, 'utf8'));
  const pages = collectPages(docs);
  const missing = [];

  for (const page of pages) {
    const filePath = path.join(ROOT_DIR, `${page}.mdx`);
    if (!await exists(filePath)) {
      missing.push(page);
    }
  }

  if (missing.length) {
    console.error('docs.json references pages that do not exist:');
    for (const page of missing) {
      console.error(`- ${page}`);
    }
    process.exit(1);
  }

  console.log(`Validated ${pages.length} docs.json navigation pages.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
