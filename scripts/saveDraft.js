import fs from 'fs';
import path from 'path';

export function saveDraft(topic, content) {
  const date = new Date().toISOString().split('T')[0];
  const filename = `${date}-${topic.slug}.md`;
  const filepath = path.join('drafts', filename);

  const frontmatter = `---
title: "${topic.title.replace(/"/g, '\\"')}"
date: "${date}"
slug: "${topic.slug}"
summary: "${topic.summary.replace(/"/g, '\\"')}"
status: "draft"
---

`;

  fs.writeFileSync(filepath, frontmatter + content, 'utf8');
  console.log(`Draft saved: ${filepath}`);
  return { filename, filepath };
}

export function markAsPublished(draftPath) {
  const filename = path.basename(draftPath);
  const publishedPath = path.join('published', filename);

  const content = fs.readFileSync(draftPath, 'utf8');
  const updated = content.replace('status: "draft"', 'status: "published"');

  fs.mkdirSync('published', { recursive: true });
  fs.writeFileSync(publishedPath, updated, 'utf8');
  fs.unlinkSync(draftPath);

  console.log(`Moved to published: ${publishedPath}`);
  return publishedPath;
}

export function getLatestDraft() {
  if (!fs.existsSync('drafts')) {
    return null;
  }
  const drafts = fs
    .readdirSync('drafts')
    .filter((f) => f.endsWith('.md'))
    .sort()
    .reverse();

  if (drafts.length === 0) return null;

  const filepath = path.join('drafts', drafts[0]);
  const content = fs.readFileSync(filepath, 'utf8');

  const titleMatch = content.match(/^title:\s*"(.+)"/m);
  const slugMatch = content.match(/^slug:\s*"(.+)"/m);
  const summaryMatch = content.match(/^summary:\s*"(.+)"/m);

  return {
    filepath,
    filename: drafts[0],
    title: titleMatch ? titleMatch[1] : 'Untitled',
    slug: slugMatch ? slugMatch[1] : '',
    summary: summaryMatch ? summaryMatch[1] : '',
    content,
  };
}

export function getDraftByFilename(filename) {
  if (!filename || !fs.existsSync('drafts')) {
    return null;
  }
  const filepath = path.join('drafts', filename);
  if (!fs.existsSync(filepath)) {
    return null;
  }
  const content = fs.readFileSync(filepath, 'utf8');
  const titleMatch = content.match(/^title:\s*"(.+)"/m);
  const slugMatch = content.match(/^slug:\s*"(.+)"/m);
  const summaryMatch = content.match(/^summary:\s*"(.+)"/m);
  return {
    filepath,
    filename,
    title: titleMatch ? titleMatch[1] : 'Untitled',
    slug: slugMatch ? slugMatch[1] : '',
    summary: summaryMatch ? summaryMatch[1] : '',
    content,
  };
}
