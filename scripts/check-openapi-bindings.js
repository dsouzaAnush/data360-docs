const fs = require('fs/promises');
const path = require('path');
const YAML = require('yaml');

const ROOT_DIR = path.resolve(__dirname, '..');
const SPEC_PATH = path.join(ROOT_DIR, 'openapi', 'data360-api.yaml');
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);
const IGNORED_DIRS = new Set(['.git', 'node_modules']);

async function collectMdxFiles(dir, files = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory()) {
      await collectMdxFiles(fullPath, files);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.mdx')) {
      files.push(fullPath);
    }
  }

  return files;
}

function collectOperations(spec) {
  const operations = new Set();

  for (const [apiPath, pathItem] of Object.entries(spec.paths || {})) {
    for (const method of Object.keys(pathItem || {})) {
      if (HTTP_METHODS.has(method)) {
        operations.add(`${method.toUpperCase()} ${apiPath}`);
      }
    }
  }

  return operations;
}

function readFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  return match ? YAML.parse(match[1]) || {} : {};
}

async function main() {
  const spec = YAML.parse(await fs.readFile(SPEC_PATH, 'utf8'));
  const operations = collectOperations(spec);
  const files = await collectMdxFiles(ROOT_DIR);
  const missing = [];
  let bindingCount = 0;

  for (const file of files) {
    const frontmatter = readFrontmatter(await fs.readFile(file, 'utf8'));

    if (!frontmatter.openapi) {
      continue;
    }

    bindingCount += 1;

    if (!operations.has(frontmatter.openapi)) {
      missing.push(`${path.relative(ROOT_DIR, file)} -> ${frontmatter.openapi}`);
    }
  }

  if (missing.length > 0) {
    console.error('The following MDX openapi bindings are missing from openapi/data360-api.yaml:');
    for (const item of missing) {
      console.error(`- ${item}`);
    }
    process.exit(1);
  }

  console.log(`Validated ${bindingCount} MDX openapi bindings against openapi/data360-api.yaml.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
