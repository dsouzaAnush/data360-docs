const axios = require('axios');
const cheerio = require('cheerio');
const TurndownService = require('turndown');
const fs = require('fs').promises;
const path = require('path');

// Configure Turndown for better markdown conversion
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

// Custom rules for better conversion
turndownService.addRule('codeBlocks', {
  filter: ['pre'],
  replacement: function (content, node) {
    const codeNode = node.querySelector('code');
    const language = codeNode?.className?.match(/language-(\w+)/)?.[1] || '';
    const code = codeNode?.textContent || content;
    return `\n\`\`\`${language}\n${code.trim()}\n\`\`\`\n`;
  }
});

// Remove script/style tags
turndownService.addRule('removeScripts', {
  filter: ['script', 'style', 'noscript'],
  replacement: () => ''
});

// Preserve tables better
turndownService.addRule('tables', {
  filter: 'table',
  replacement: function (content, node) {
    const $ = cheerio.load(node.outerHTML);
    const rows = [];

    $('tr').each((i, row) => {
      const cells = [];
      $(row).find('th, td').each((j, cell) => {
        cells.push($(cell).text().trim().replace(/\|/g, '\\|'));
      });
      rows.push(`| ${cells.join(' | ')} |`);

      // Add header separator after first row
      if (i === 0) {
        rows.push(`| ${cells.map(() => '---').join(' | ')} |`);
      }
    });

    return rows.length > 0 ? '\n' + rows.join('\n') + '\n' : '';
  }
});

const urlsConfig = require('./urls.json');
const baseUrl = urlsConfig.baseUrl;

async function fetchPage(url) {
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
  console.log(`  Fetching: ${fullUrl}`);

  try {
    const response = await axios.get(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 30000,
    });
    return response.data;
  } catch (error) {
    console.error(`  Error fetching ${fullUrl}: ${error.message}`);
    return null;
  }
}

function extractContent(html) {
  const $ = cheerio.load(html);

  // Remove unwanted elements
  $('script, style, noscript, nav, header, footer, .sidebar, .nav, .navigation, .feedback, .breadcrumb').remove();
  $('[class*="nav"], [class*="sidebar"], [class*="footer"], [class*="header"]').remove();

  // Try to find the main content area - Salesforce docs specific selectors
  let mainContent = $('article').html() ||
                    $('.doc-content').html() ||
                    $('.content-body').html() ||
                    $('[role="main"]').html() ||
                    $('.main-content').html() ||
                    $('#main-content').html() ||
                    $('main').html();

  // If no specific content area found, try to extract from body
  if (!mainContent) {
    // Remove common non-content elements
    $('header, nav, footer, aside, .sidebar').remove();
    mainContent = $('body').html();
  }

  if (!mainContent) {
    return null;
  }

  // Extract title
  const title = $('h1').first().text().trim() ||
                $('title').text().split('|')[0].trim() ||
                'Untitled';

  // Extract description from meta or first paragraph
  const description = $('meta[name="description"]').attr('content') ||
                      $('meta[property="og:description"]').attr('content') ||
                      $('p').first().text().trim().substring(0, 160);

  return {
    title,
    description,
    html: mainContent
  };
}

function convertToMarkdown(content) {
  if (!content || !content.html) {
    return null;
  }

  const markdown = turndownService.turndown(content.html);

  // Clean up the markdown
  const cleaned = markdown
    .replace(/\n{3,}/g, '\n\n')  // Reduce multiple newlines
    .replace(/\[([^\]]+)\]\(\s*\)/g, '$1')  // Remove empty links
    .replace(/^\s+$/gm, '')  // Remove whitespace-only lines
    .trim();

  return cleaned;
}

function createMdxContent(title, description, markdown) {
  const frontmatter = `---
title: "${title.replace(/"/g, '\\"')}"
description: "${description.replace(/"/g, '\\"').substring(0, 200)}"
---

`;

  return frontmatter + markdown;
}

async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}

async function processPage(pageConfig, outputDir, rootDir) {
  const html = await fetchPage(pageConfig.url);

  if (!html) {
    console.log(`  Skipped (no content): ${pageConfig.url}`);
    return false;
  }

  const content = extractContent(html);

  if (!content) {
    console.log(`  Skipped (extraction failed): ${pageConfig.url}`);
    return false;
  }

  const markdown = convertToMarkdown(content);

  if (!markdown || markdown.length < 100) {
    console.log(`  Skipped (content too short): ${pageConfig.url}`);
    return false;
  }

  // Use provided title or extracted title
  const title = pageConfig.title || content.title;
  const description = content.description || `Documentation for ${title}`;

  const mdxContent = createMdxContent(title, description, markdown);

  const outputPath = path.join(rootDir, outputDir, pageConfig.outputFile);
  await ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, mdxContent, 'utf-8');

  console.log(`  Created: ${outputPath}`);
  return true;
}

async function crawlDocumentation() {
  const rootDir = path.resolve(__dirname, '..');
  let successCount = 0;
  let failCount = 0;

  console.log('Starting documentation crawl...\n');

  for (const [areaName, areaConfig] of Object.entries(urlsConfig.documentationAreas)) {
    console.log(`\n📂 Processing: ${areaName}`);

    for (const page of areaConfig.pages) {
      const success = await processPage(page, areaConfig.outputDir, rootDir);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }

      // Add delay between requests to be respectful
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n\n✅ Crawl complete!`);
  console.log(`   Success: ${successCount} pages`);
  console.log(`   Failed: ${failCount} pages`);
}

// Run the crawler
crawlDocumentation().catch(console.error);
