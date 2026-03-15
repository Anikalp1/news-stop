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

/** Try Groq first; on failure, fall back to OpenRouter if key is set. */
async function generateText(prompt) {
  if (GROQ_KEY) {
    try {
      return await generateWithGroq(prompt);
    } catch (err) {
      if (OPENROUTER_KEY) {
        console.log('Groq failed, falling back to OpenRouter...');
        return await generateWithOpenRouter(prompt);
      }
      throw err;
    }
  }
  if (OPENROUTER_KEY) return await generateWithOpenRouter(prompt);
  throw new Error('Set GROQ_API_KEY and/or OPENROUTER_API_KEY in .env or GitHub Secrets.');
}

function getProviderName() {
  if (GROQ_KEY && OPENROUTER_KEY) return `Groq (${GROQ_MODEL}) → OpenRouter (${OPENROUTER_MODEL}) fallback`;
  if (GROQ_KEY) return `Groq (${GROQ_MODEL})`;
  if (OPENROUTER_KEY) return `OpenRouter (${OPENROUTER_MODEL})`;
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

Start with exactly one line: # Daily AI News — ${dateStr}
Then immediately the intro paragraph (no duplicate title, no hashtags, no tags).

# Daily AI News — ${dateStr}

[2–3 sentence intro: what’s happening in AI. Short, sharp, contextual. Do NOT repeat the date or say "today" — the date is already in the heading. Do NOT repeat the title as text. Do NOT add hashtags or tags (no # technology, # programming, # ai, etc.). Go straight into the intro. Then ## for first story.]

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
- No filler. No repeating the headline or the date in the body (date is only in the H1). No emojis.
- Write for developers: tooling, APIs, startups, shipping, building. When in doubt, focus on "what can I do with this?"

FORMATTING:
- Clean Markdown. Exactly one # heading at the top (the title). Then ## for each story headline. **What happened:** and **Why it matters:** and **Context:** as bold labels.
- One blank line between sections. No hashtags, no tags, no keywords. No extra commentary — only the article.

Do NOT add: hashtags (# technology, # ai, etc.), duplicate title text, or a Sources line (we add it automatically).

Output only the Markdown article. Nothing else.`;

  return await generateText(prompt);
}

export async function generateArticle(newsItems) {
  const provider = getProviderName();
  if (!provider) throw new Error('No API key set. Use GROQ_API_KEY and/or OPENROUTER_API_KEY.');
  console.log(`Selecting top stories for digest with ${provider}...`);
  const topic = await selectDigestTopic(newsItems);
  console.log(`Digest: "${topic.title}" (${topic.selectedNews?.length ?? 0} stories)`);

  console.log('Writing short digest...');
  let content = await writeDigest(topic);

  // Remove common model mistakes: hashtag-only lines and duplicate title as plain text
  const titleLine = `Daily AI News — ${new Date().toISOString().split('T')[0]}`;
  content = content
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (t.startsWith('*Sources:') || t.startsWith('Sources:')) return false;
      if (t === titleLine && !t.startsWith('#')) return false;
      if (/^#\s*[a-z]+(\s*#\s*[a-z]+)*\s*$/i.test(t)) return false;
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();

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
