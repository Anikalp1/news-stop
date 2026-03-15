import axios from 'axios';
import fs from 'fs';

const DEVTO_API = 'https://dev.to/api/articles';

function extractMarkdownContent(fileContent) {
  return fileContent.replace(/^---[\s\S]+?---\n/m, '').trim();
}

function extractFrontmatter(fileContent) {
  const titleMatch = fileContent.match(/^title:\s*"(.+)"/m);
  const summaryMatch = fileContent.match(/^summary:\s*"(.+)"/m);
  const slugMatch = fileContent.match(/^slug:\s*"(.+)"/m);
  return {
    title: titleMatch ? titleMatch[1] : 'Untitled',
    summary: summaryMatch ? summaryMatch[1] : '',
    slug: slugMatch ? slugMatch[1] : '',
  };
}

// Dev.to tags: max 4, lowercase, letters/numbers/hyphens only
function extractTags(content) {
  const lower = content.toLowerCase();
  const candidates = [
    { keyword: 'machine learning', tag: 'machinelearning' },
    { keyword: 'large language model', tag: 'llm' },
    { keyword: 'llm', tag: 'llm' },
    { keyword: 'openai', tag: 'openai' },
    { keyword: 'deep learning', tag: 'deeplearning' },
    { keyword: 'python', tag: 'python' },
    { keyword: 'javascript', tag: 'javascript' },
    { keyword: 'open source', tag: 'opensource' },
    { keyword: 'developer', tag: 'programming' },
    { keyword: 'neural network', tag: 'ai' },
  ];

  const tags = new Set(['ai', 'technology']);
  for (const { keyword, tag } of candidates) {
    if (lower.includes(keyword)) tags.add(tag);
    if (tags.size >= 4) break;
  }

  return [...tags].slice(0, 4);
}

export async function publishToDevTo(draftPath) {
  const apiKey = process.env.DEVTO_API_KEY;
  if (!apiKey) throw new Error('DEVTO_API_KEY not set');

  const fileContent = fs.readFileSync(draftPath, 'utf8');
  const { title, summary, slug } = extractFrontmatter(fileContent);
  const markdownContent = extractMarkdownContent(fileContent);
  const tags = extractTags(markdownContent);

  const payload = {
    article: {
      title,
      body_markdown: markdownContent,
      published: true,
      description: summary,
      tags,
    },
  };

  const res = await axios.post(DEVTO_API, payload, {
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
  });

  const article = res.data;
  const url = `https://dev.to${article.path}`;
  console.log(`Published to Dev.to: ${url}`);

  return {
    url,
    title: article.title,
    id: article.id,
    // Medium import link — user can paste this URL into medium.com/p/import
    mediumImportUrl: `https://medium.com/p/import?url=${encodeURIComponent(url)}`,
  };
}
