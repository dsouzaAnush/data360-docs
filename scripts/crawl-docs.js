const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const TurndownService = require('turndown');

const urlsConfig = require('./urls.json');

const ROOT_DIR = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT_DIR, 'reports', 'content-sync-report.json');
const BASE_URL = urlsConfig.baseUrl.replace(/\/$/, '');
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-'
});

turndownService.addRule('codeBlocks', {
  filter: ['pre', 'dx-code-block'],
  replacement(content, node) {
    const codeNode = node.querySelector?.('code');
    const language = codeNode?.className?.match(/language-([a-z0-9_-]+)/i)?.[1] || '';
    const code = (codeNode?.textContent || node.textContent || content).trim();
    return code ? `\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n` : '';
  }
});

turndownService.addRule('callouts', {
  filter: ['doc-content-callout'],
  replacement(content, node) {
    const header = node.getAttribute?.('header') || 'Note';
    const body = content.trim();
    if (!body) return '';
    const quoted = body.split('\n').map((line) => `> ${line}`).join('\n');
    return `\n\n> **${header}:**\n${quoted}\n\n`;
  }
});

turndownService.addRule('tables', {
  filter: 'table',
  replacement(content, node) {
    const $ = cheerio.load(node.outerHTML);
    const rows = [];

    $('tr').each((i, row) => {
      const cells = [];
      $(row).find('th, td').each((_, cell) => {
        cells.push($(cell).text().trim().replace(/\|/g, '\\|').replace(/\s+/g, ' '));
      });
      if (!cells.length) return;
      rows.push(`| ${cells.join(' | ')} |`);
      if (i === 0) rows.push(`| ${cells.map(() => '---').join(' | ')} |`);
    });

    return rows.length ? `\n\n${rows.join('\n')}\n\n` : '';
  }
});

turndownService.addRule('groupText', {
  filter: ['dx-group-text'],
  replacement(content, node) {
    const header = node.getAttribute?.('header') || '';
    const body = node.getAttribute?.('body') || content.trim();
    const links = ['primary-link', 'secondary-link']
      .map((attr) => node.getAttribute?.(attr))
      .filter(Boolean)
      .map((value) => {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const parts = [];
    if (header) parts.push(`# ${header}`);
    if (body) parts.push(body);
    for (const link of links) {
      if (link.label && link.href) parts.push(`[${link.label}](${absoluteUrl(link.href)})`);
    }

    return parts.length ? `\n\n${parts.join('\n\n')}\n\n` : '';
  }
});

turndownService.addRule('featuresList', {
  filter: ['dx-features-list'],
  replacement(content, node) {
    const options = node.getAttribute?.('options');
    if (!options) return '';

    try {
      const parsed = JSON.parse(options);
      return `\n\n${parsed.map((item) => `- **${item.title}** - ${item.description}`).join('\n')}\n\n`;
    } catch {
      return content ? `\n\n${content}\n\n` : '';
    }
  }
});

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeBareMdxBraces(markdown) {
  const escapeText = (value) => value.replace(/(^|[^\\])([{}])/g, '$1\\$2');

  return markdown
    .split(/(```[\s\S]*?```)/g)
    .map((fencedPart, fencedIndex) => {
      if (fencedIndex % 2 === 1) return fencedPart;
      return fencedPart
        .split(/(`+[^`\n]*?`+)/g)
        .map((inlinePart, inlineIndex) => inlineIndex % 2 === 1 ? inlinePart : escapeText(inlinePart))
        .join('');
    })
    .join('');
}

function restoreSalesforceCustomFieldNames(markdown) {
  return markdown.replace(/\*\*c(?=})/g, '\\_\\_c');
}

function frontmatterString(value) {
  return normalizeWhitespace(value).replace(/\n+/g, ' ').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function absoluteUrl(url) {
  return url.startsWith('http') ? url : `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

async function fetchPage(url) {
  const sourceUrl = absoluteUrl(url);
  const response = await axios.get(sourceUrl, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': USER_AGENT
    },
    timeout: 30000,
    validateStatus: (status) => status >= 200 && status < 400
  });

  return {
    sourceUrl,
    html: response.data,
    etag: response.headers.etag || '',
    lastModified: response.headers['last-modified'] || ''
  };
}

function rewriteRelativeUrls($, root) {
  root.find('[href]').each((_, element) => {
    const href = $(element).attr('href');
    if (href && href.startsWith('/')) $(element).attr('href', absoluteUrl(href));
  });

  root.find('[src]').each((_, element) => {
    const src = $(element).attr('src');
    if (src && src.startsWith('/')) $(element).attr('src', absoluteUrl(src));
  });
}

function expandSalesforceComponents($, root) {
  root.find('dx-group-text').each((_, element) => {
    const node = $(element);
    const header = node.attr('header') || '';
    const body = node.attr('body') || '';
    const tagName = node.attr('title-aria-level') === '1' ? 'h1' : 'h2';
    const parts = [];

    if (header) parts.push(`<${tagName}>${header}</${tagName}>`);
    if (body) parts.push(`<p>${body}</p>`);

    for (const attr of ['primary-link', 'secondary-link']) {
      const value = node.attr(attr);
      if (!value) continue;
      try {
        const link = JSON.parse(value);
        if (link.label && link.href) {
          parts.push(`<p><a href="${absoluteUrl(link.href)}">${link.label}</a></p>`);
        }
      } catch {
        // Ignore malformed optional link data from page components.
      }
    }

    node.replaceWith(parts.join('\n'));
  });

  root.find('dx-features-list').each((_, element) => {
    const node = $(element);
    const options = node.attr('options');

    if (!options) return;

    try {
      const items = JSON.parse(options)
        .map((item) => `<li><strong>${item.title}</strong> - ${item.description}</li>`)
        .join('\n');
      node.replaceWith(`<ul>${items}</ul>`);
    } catch {
      // Leave the original node in place if Salesforce changes the shape.
    }
  });
}

function extractContent(html) {
  const $ = cheerio.load(html);
  const title = normalizeWhitespace(
    $('main h1').first().text() ||
      $('h1').first().text() ||
      $('title').text().split('|')[0]
  );

  const description = normalizeWhitespace(
    $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      ''
  );

  const selectors = [
    '.content-type-markdown',
    '.content-type-guide',
    '.content-type-reference',
    '.content-type',
    'article',
    'main'
  ];

  let contentRoot = null;
  for (const selector of selectors) {
    const candidate = $(selector).first();
    if (candidate.length && (candidate.text().trim().length > 80 || candidate.html().includes('dx-group-text'))) {
      contentRoot = candidate;
      break;
    }
  }

  if (!contentRoot) {
    throw new Error('Could not find article content in Salesforce page.');
  }

  contentRoot.find([
    'script',
    'style',
    'noscript',
    'doc-sprig-survey',
    '.appended-footer-container',
    '.footer-container',
    '.global-nav-container',
    '.sticky-doc-header'
  ].join(',')).remove();

  rewriteRelativeUrls($, contentRoot);
  expandSalesforceComponents($, contentRoot);

  return {
    title: title || 'Untitled',
    description,
    html: contentRoot.html() || ''
  };
}

function convertToMarkdown(content) {
  const markdown = turndownService.turndown(content.html)
    .replace(/\[([^\]]+)\]\(\s*\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n');

  return normalizeWhitespace(escapeBareMdxBraces(restoreSalesforceCustomFieldNames(markdown)));
}

function createMdx({ page, sourceUrl, etag, lastModified, markdown, extracted }) {
  const sourceHash = sha256(markdown);
  const description = extracted.description || `Official Salesforce documentation for ${page.title || extracted.title}.`;
  const frontmatter = [
    '---',
    `title: "${frontmatterString(page.title || extracted.title)}"`,
    `description: "${frontmatterString(description).slice(0, 220)}"`,
    `source_url: "${frontmatterString(sourceUrl)}"`,
    `source_hash: "${sourceHash}"`,
    etag ? `source_etag: "${frontmatterString(etag)}"` : null,
    lastModified ? `source_last_modified: "${frontmatterString(lastModified)}"` : null,
    'sync_status: "official-salesforce-doc"',
    '---'
  ].filter(Boolean).join('\n');

  return `${frontmatter}\n\n${markdown}\n`;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function flattenPages(areaFilter) {
  const pages = [];

  for (const [areaName, areaConfig] of Object.entries(urlsConfig.documentationAreas || {})) {
    if (areaFilter && areaName !== areaFilter) continue;
    for (const page of areaConfig.pages || []) {
      pages.push({
        areaName,
        outputDir: areaConfig.outputDir,
        ...page
      });
    }
  }

  return pages;
}

async function syncPage(page, { check }) {
  const outputPath = path.join(ROOT_DIR, page.outputDir, page.outputFile);
  const fetched = await fetchPage(page.url);
  const extracted = extractContent(fetched.html);
  const markdown = convertToMarkdown(extracted);

  if (markdown.length < 100) {
    throw new Error('Extracted content is unexpectedly short.');
  }

  const mdx = createMdx({
    page,
    sourceUrl: fetched.sourceUrl,
    etag: fetched.etag,
    lastModified: fetched.lastModified,
    markdown,
    extracted
  });

  if (check) {
    const existing = await fs.readFile(outputPath, 'utf8');
    if (existing !== mdx) {
      throw new Error(`Out of sync: ${path.relative(ROOT_DIR, outputPath)}`);
    }
  } else {
    await ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, mdx, 'utf8');
  }

  return {
    area: page.areaName,
    output: path.relative(ROOT_DIR, outputPath),
    sourceUrl: fetched.sourceUrl,
    title: page.title || extracted.title,
    sourceHash: sha256(markdown),
    bytes: Buffer.byteLength(mdx)
  };
}

async function writeReport(results) {
  await ensureDir(path.dirname(REPORT_PATH));
  await fs.writeFile(REPORT_PATH, `${JSON.stringify({
    source: 'official-salesforce-docs',
    pageCount: results.length,
    pages: results
  }, null, 2)}\n`, 'utf8');
}

async function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const areaArg = args.find((arg) => arg.startsWith('--area='));
  const areaFilter = areaArg ? areaArg.slice('--area='.length) : null;
  const pages = flattenPages(areaFilter);
  const results = [];
  const failures = [];

  for (const page of pages) {
    const label = `${page.areaName}/${page.outputFile}`;
    try {
      const result = await syncPage(page, { check });
      results.push(result);
      console.log(`${check ? 'checked' : 'synced'} ${label}`);
    } catch (error) {
      failures.push({ page, error: error.message });
      console.error(`failed ${label}: ${error.message}`);
    }
  }

  if (!check && results.length) {
    await writeReport(results);
  }

  console.log(`${check ? 'Checked' : 'Synced'} ${results.length}/${pages.length} official content pages.`);

  if (failures.length) {
    console.error(`${failures.length} content pages failed.`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
