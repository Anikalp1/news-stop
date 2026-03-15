import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function formatNewsForPrompt(newsItems) {
  return newsItems
    .map((item, i) => `${i + 1}. ${item.title}\n   Source: ${item.source}\n   ${item.summary}`)
    .join('\n\n');
}

async function selectTopic(newsItems) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `You are an AI technology writer for software engineers and developers.

Below are the latest AI news headlines from the past 48 hours:

${formatNewsForPrompt(newsItems)}

Select the single most interesting and technically relevant topic for software engineers.

Respond in this exact format (no extra text):
TITLE: [compelling Medium article title]
SUMMARY: [2-3 sentence summary of what the article will cover]
POINTS:
- [key point 1]
- [key point 2]
- [key point 3]
- [key point 4]
SLUG: [url-friendly-slug-with-hyphens]`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  const titleMatch = text.match(/TITLE:\s*(.+)/);
  const summaryMatch = text.match(/SUMMARY:\s*(.+?)(?=\nPOINTS:|\nSLUG:)/s);
  const slugMatch = text.match(/SLUG:\s*(.+)/);
  const pointsMatch = text.match(/POINTS:\n([\s\S]+?)(?=\nSLUG:)/);

  const points = pointsMatch
    ? pointsMatch[1]
        .split('\n')
        .filter((l) => l.trim().startsWith('-'))
        .map((l) => l.replace(/^-\s*/, '').trim())
    : [];

  return {
    title: titleMatch ? titleMatch[1].trim() : 'AI News Roundup',
    summary: summaryMatch ? summaryMatch[1].trim() : '',
    points,
    slug: slugMatch
      ? slugMatch[1].trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
      : 'ai-article',
  };
}

async function writeArticle(topic, newsItems) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `Write a high-quality Medium article for software engineers and developers.

Title: ${topic.title}

Summary: ${topic.summary}

Key points to cover:
${topic.points.map((p) => `- ${p}`).join('\n')}

Related news context:
${formatNewsForPrompt(newsItems.slice(0, 5))}

Requirements:
- 1000–1500 words
- Valid Markdown formatting
- Sections with ## headings
- Developer perspective throughout
- Explain the technical implications clearly
- Include practical insights developers can act on
- Avoid generic AI hype — be specific and insightful
- No filler phrases like "In conclusion" or "It's worth noting"

Structure:
# [Title]

[Introduction — hook the reader with why this matters right now]

## What Happened

[Factual summary of the news/development]

## Why It Matters for Developers

[Technical implications, what changes, what to watch]

## What You Should Do

[Practical steps, tools to try, things to learn]

## The Bigger Picture

[Broader industry context and future direction]

## Final Thoughts

[Short, punchy conclusion]

---
*Sources: ${newsItems
    .slice(0, 3)
    .map((n) => `[${n.source}](${n.link})`)
    .join(', ')}*

Write the full article now in Markdown:`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

export async function generateArticle(newsItems) {
  console.log('Selecting best topic with Gemini...');
  const topic = await selectTopic(newsItems);
  console.log(`Selected topic: "${topic.title}"`);

  console.log('Generating article...');
  const content = await writeArticle(topic, newsItems);
  console.log(`Article generated (${content.length} chars)`);

  return { topic, content };
}
