import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

const USE_OPENAI = !!OPENAI_KEY;
const OPENAI_MODEL = 'gpt-4o-mini';
const GEMINI_MODEL = 'gemini-2.0-flash-lite';

const openai = OPENAI_KEY ? new OpenAI({ apiKey: OPENAI_KEY }) : null;
const genAI = GEMINI_KEY ? new GoogleGenerativeAI(GEMINI_KEY) : null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithOpenAI(prompt) {
  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  });
  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) throw new Error('OpenAI returned empty response');
  return text;
}

async function generateWithGemini(prompt, maxRetries = 2) {
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (err) {
      const is429 = err.message && err.message.includes('429');
      if (is429 && attempt <= maxRetries) {
        console.log(`Rate limited (429). Waiting 25s before retry ${attempt}/${maxRetries}...`);
        await sleep(25000);
        continue;
      }
      throw err;
    }
  }
}

async function generateText(prompt) {
  if (USE_OPENAI) return generateWithOpenAI(prompt);
  if (genAI) return generateWithGemini(prompt);
  throw new Error(
    'Set OPENAI_API_KEY (recommended) or GEMINI_API_KEY in .env or GitHub Secrets.'
  );
}

function formatNewsForPrompt(newsItems) {
  return newsItems
    .map((item, i) => `${i + 1}. ${item.title}\n   Source: ${item.source}\n   ${item.summary}`)
    .join('\n\n');
}

async function selectTopic(newsItems) {
  const prompt = `You are a tech writer who tells stories, not a corporate blog. Pick one story from the headlines below that would make a great read for developers — something with a real narrative, stakes, or a bit of absurdity.

Latest AI news (past 48 hours):

${formatNewsForPrompt(newsItems)}

Choose the single most interesting, technically relevant topic. The title should sound like a story or a hook a human would click, not a generic "X Explained" or "The Future of Y."

Respond in this exact format (no extra text, no emojis):
TITLE: [story-like or punchy title, no emojis]
SUMMARY: [2-3 sentences: what happened and why a dev would care]
POINTS:
- [key point 1]
- [key point 2]
- [key point 3]
- [key point 4]
SLUG: [url-friendly-slug-with-hyphens]`;

  const text = await generateText(prompt);

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
  const prompt = `Write an article that reads like a human tech writer wrote it — a story with a voice, not a textbook or a press release.

Title: ${topic.title}

Summary: ${topic.summary}

Key points to cover:
${topic.points.map((p) => `- ${p}`).join('\n')}

Related news context:
${formatNewsForPrompt(newsItems.slice(0, 5))}

VOICE AND STYLE (non-negotiable):
- Write like you're telling someone the story over coffee. Narrative flow, not bullet points in disguise.
- No emojis anywhere in the article. None.
- Add dry wit or light jokes where they fit the news — an observation, a gentle jab at hype, a relatable dev moment. Don't force it; the news stays central. Humor should feel natural, not tacked on.
- Sound like a knowledgeable friend, not a brand or an AI. Use "you" and concrete examples. Short sentences are fine. Vary rhythm.
- Do NOT use: "In conclusion," "It's worth noting," "Furthermore," "In today's rapidly evolving landscape," "delve," "leverage," "utilize," "game-changer," "revolutionize," "Let's dive in," or any phrase that screams generic AI blog. No recapping the intro at the end.
- Do NOT structure every section as a list of three bullet-like paragraphs. Prose should flow; use headings to break the story, not to announce report sections.
- 1000–1500 words. Valid Markdown. ## for section headings. Developer angle and technical implications throughout, but explained through the story.

Structure (use these as narrative beats, not report headers):
# [Title]

[Open with a hook: a scene, a question, or a punchy take. Why should a dev care right now?]

## What Actually Happened

[Tell the story of the news — what happened, who did it, why it showed up on the radar. Facts first, then why it's a bit ridiculous or exciting.]

## Why This Actually Matters

[Technical implications and what changes for developers. Be specific. No vague "the industry will evolve."]

## What You Can Do About It

[Practical stuff: what to try, what to read, what to ignore. Straight talk.]

## Where This Is Going

[Bigger context or where this leads — one or two tight paragraphs. No grand "the future is bright" finale.]

[Last paragraph: land the plane. One sharp observation or takeaway, not a summary of the article.]

---
*Sources: ${newsItems
    .slice(0, 3)
    .map((n) => `[${n.source}](${n.link})`)
    .join(', ')}*

Write the full article in Markdown. No emojis. Story first, facts woven in.`;

  return await generateText(prompt);
}

export async function generateArticle(newsItems) {
  const provider = USE_OPENAI ? `OpenAI (${OPENAI_MODEL})` : `Gemini (${GEMINI_MODEL})`;
  console.log(`Selecting best topic with ${provider}...`);
  const topic = await selectTopic(newsItems);
  console.log(`Selected topic: "${topic.title}"`);

  if (!USE_OPENAI) await sleep(3000);

  console.log('Generating article...');
  const content = await writeArticle(topic, newsItems);
  console.log(`Article generated (${content.length} chars)`);

  return { topic, content };
}
