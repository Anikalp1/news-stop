import Groq from 'groq-sdk';
import OpenAI from 'openai';

const GROQ_KEY = process.env.GROQ_API_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
// OpenRouter: default openrouter/free; override with OPENROUTER_MODEL
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';

const groq = GROQ_KEY ? new Groq({ apiKey: GROQ_KEY }) : null;
const openrouter = OPENROUTER_KEY
  ? new OpenAI({ apiKey: OPENROUTER_KEY, baseURL: 'https://openrouter.ai/api/v1' })
  : null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithGroq(prompt, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });
      const text = completion.choices[0]?.message?.content?.trim();
      if (!text) throw new Error('Groq returned empty response');
      return text;
    } catch (err) {
      const is429 = err.status === 429 || (err.message && err.message.includes('429'));
      if (is429 && attempt <= maxRetries) {
        console.log(`Groq rate limited (429). Waiting 30s before retry ${attempt}/${maxRetries}...`);
        await sleep(30000);
        continue;
      }
      throw err;
    }
  }
}

async function generateWithOpenRouter(prompt, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const completion = await openrouter.chat.completions.create({
        model: OPENROUTER_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });
      const text = completion.choices[0]?.message?.content?.trim();
      if (!text) throw new Error('OpenRouter returned empty response');
      return text;
    } catch (err) {
      const is429 = err.status === 429 || (err.message && err.message.includes('429'));
      if (is429 && attempt <= maxRetries) {
        console.log(`OpenRouter rate limited (429). Waiting 30s before retry ${attempt}/${maxRetries}...`);
        await sleep(30000);
        continue;
      }
      throw err;
    }
  }
}

/** Try OpenRouter first; on failure, fall back to Groq if key is set. */
async function generateText(prompt) {
  if (OPENROUTER_KEY) {
    try {
      return await generateWithOpenRouter(prompt);
    } catch (err) {
      if (GROQ_KEY) return await generateWithGroq(prompt);
      throw err;
    }
  }
  if (GROQ_KEY) return await generateWithGroq(prompt);
  throw new Error('Set OPENROUTER_API_KEY and/or GROQ_API_KEY in .env or GitHub Secrets.');
}

function getProviderName() {
  if (OPENROUTER_KEY && GROQ_KEY) return `OpenRouter (${OPENROUTER_MODEL}) → Groq (${GROQ_MODEL}) fallback`;
  if (OPENROUTER_KEY) return `OpenRouter (${OPENROUTER_MODEL})`;
  if (GROQ_KEY) return `Groq (${GROQ_MODEL})`;
  return null;
}

function formatNewsForPrompt(newsItems) {
  return newsItems
    .map((item, i) => `${i + 1}. ${item.title}\n   Source: ${item.source}\n   ${item.summary}`)
    .join('\n\n');
}

async function selectDigestTopic(newsItems) {
  const prompt = `You are curating a short daily AI news digest for developers. Pick the 4–6 most important or relevant headlines from the list below — things a dev would want to know today. Skip duplicates or near-duplicates; prefer variety (products, research, policy, companies).

Latest AI news (past 48 hours):

${formatNewsForPrompt(newsItems)}

Reply with only the line numbers of your chosen items, comma-separated (e.g. 1, 3, 5, 7, 9). No other text.`;

  const text = await generateText(prompt);
  const numbers = (text.match(/\d+/g) || []).map(Number).filter((n) => n >= 1 && n <= newsItems.length);
  const indices = [...new Set(numbers)].slice(0, 6).map((n) => n - 1);
  const selected = indices.length > 0 ? indices.map((i) => newsItems[i]) : newsItems.slice(0, 5);
  const dateStr = new Date().toISOString().split('T')[0];

  return {
    title: `Daily AI News — ${dateStr}`,
    summary: `Brief roundup of the day's top AI stories. Skim in under a minute.`,
    slug: `daily-ai-news-${dateStr}`,
    points: [],
    selectedNews: selected,
  };
}

async function writeDigest(topic) {
  const news = topic.selectedNews || [];
  const dateStr = new Date().toISOString().split('T')[0];

  const prompt = `You are writing the daily edition of a high-quality AI developer newsletter. Tone: concise, insightful, pleasant to read — like TLDR, The Rundown AI, or Ben's Bites. Do not sound like a generic AI or a press release.

Use ONLY the information in the provided story summaries below. Do not invent facts, quotes, or details.

---

STORIES TO COVER (source and summary only — use this information and nothing else):

${news.map((n, i) => `${i + 1}. ${n.title}\n   Source: ${n.source}\n   Summary: ${n.summary}`).join('\n\n')}

---

REQUIRED ARTICLE STRUCTURE:

First line must be a single catchy H1 headline that combines the day’s themes into one punchy line. Do NOT include the date in the headline. Examples: "Cursor’s $50B Buzz and xAI’s Pivot" or "Mega Rounds, Agentic Finance, and a Scrapped Coding Tool". Make it specific to the stories below, not generic.

# [Your catchy one-line headline — no date]

[2–3 sentence intro: what’s happening in AI. Short, sharp, contextual. Do NOT repeat the headline. Do NOT add the date or "today". No hashtags or tags (no # technology, # programming, # ai). Go straight into the intro, then ## for first story.]

Then for each story, use this exact structure:

## [Exact headline from above]

**What happened:**  
[1–2 sentences from the provided summary. Do not repeat the headline in the first sentence.]

**Why it matters:**  
[1–2 sentences: why developers, builders, or startups should care. Developer perspective.]

**Context:**  
[One quick sentence only if needed for clarity. Omit this line entirely if not needed.]

[Blank line before next ## heading]

Repeat for every story. After the last story, stop. Do not add a conclusion paragraph or "Sources" section (it will be added automatically).

---

STYLE RULES (strict):
- Total length: 300–450 words. Every sentence must add information.
- Clear, sharp, modern tech writing. Short sentences. Easy to skim in under 60 seconds.
- Banned words and phrases: leverage, delve, revolutionary, groundbreaking, game-changing, utilize, "it’s worth noting," "in conclusion," "the landscape is evolving."
- No filler. No repeating the headline or adding the date in the body. No emojis.
- Write for developers: tooling, APIs, startups, shipping, building. When in doubt, focus on "what can I do with this?"

FORMATTING:
- Clean Markdown. Exactly one # heading at the top (your catchy headline, no date). Then ## for each story headline. **What happened:** and **Why it matters:** and **Context:** as bold labels.
- One blank line between sections. No hashtags, no tags, no keywords. No extra commentary — only the article.

Do NOT add: the date anywhere, hashtags (# technology, # ai, etc.), duplicate headline text, or a Sources line (we add it automatically).

Output only the Markdown article. Nothing else.`;

  return await generateText(prompt);
}

export async function generateArticle(newsItems) {
  const provider = getProviderName();
  console.log(`Selecting top stories for digest with ${provider}...`);
  const topic = await selectDigestTopic(newsItems);
  console.log(`Digest: "${topic.title}" (${topic.selectedNews?.length ?? 0} stories)`);

  console.log('Writing short digest...');
  let content = await writeDigest(topic);

  // Remove common model mistakes: duplicate headline (H1 or plain-text repeat), hashtag lines, Sources, date
  const dateStr = new Date().toISOString().split('T')[0];
  let seenH1 = false;
  let h1TitleText = '';
  content = content
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (t.startsWith('*Sources:') || t.startsWith('Sources:')) return false;
      if (t.startsWith('# ')) {
        if (seenH1) return false;
        seenH1 = true;
        h1TitleText = t.slice(2).trim();
        return true;
      }
      if (h1TitleText && t === h1TitleText) return false;
      if (/^#\s*[a-z]+(\s*#\s*[a-z]+)*\s*$/i.test(t)) return false;
      if (t === dateStr) return false;
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();

  // Use the generated H1 as the draft title (catchy headline)
  const firstLine = content.split('\n')[0] || '';
  const h1Match = firstLine.match(/^#\s+(.+)$/);
  if (h1Match) topic.title = h1Match[1].trim();

  const news = topic.selectedNews || [];
  if (news.length > 0) {
    const seen = new Set();
    const uniqueSources = news.filter((n) => {
      if (seen.has(n.source)) return false;
      seen.add(n.source);
      return true;
    });
    const sourcesLine = uniqueSources.map((n) => `[${n.source}](${n.link})`).join(', ');
    content = `${content}\n\n---\n*Sources: ${sourcesLine}*`;
  }
  console.log(`Digest generated (${content.length} chars)`);

  return { topic, content };
}
