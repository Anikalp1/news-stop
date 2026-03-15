import Parser from 'rss-parser';

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'application/rss+xml, application/xml, text/xml',
  },
});

const RSS_FEEDS = [
  {
    name: 'Google News AI',
    url: 'https://news.google.com/rss/search?q=artificial+intelligence+OR+machine+learning+OR+LLM&hl=en-IN&gl=IN&ceid=IN:en',
    maxItems: 8,
  },
  {
    name: 'Hacker News AI',
    url: 'https://hnrss.org/newest?q=AI',
    maxItems: 10,
  },
  {
    name: 'Arxiv AI',
    url: 'https://export.arxiv.org/rss/cs.AI',
    maxItems: 5,
    isArxiv: true,
  },
  {
    name: 'Arxiv Machine Learning',
    url: 'https://export.arxiv.org/rss/cs.LG',
    maxItems: 5,
    isArxiv: true,
  },
];

function isRecent(dateStr) {
  if (!dateStr) return true;
  const published = new Date(dateStr);
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours
  return published > cutoff;
}

function cleanText(text, maxLen = 300) {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function normalizeArxivTitle(title) {
  if (!title) return title;
  return title.replace(/\s*\(arXiv:\d{4}\.\d{4,5}\)\s*$/i, '').trim();
}

async function fetchFeed(feed) {
  try {
    const result = await parser.parseURL(feed.url);
    const maxItems = feed.maxItems ?? 5;

    const items = result.items
      .filter((item) => isRecent(item.pubDate || item.isoDate))
      .slice(0, maxItems)
      .map((item) => {
        const rawTitle = cleanText(item.title, 200);
        const title = feed.isArxiv ? normalizeArxivTitle(rawTitle) : rawTitle;
        const rawSummary =
          item.contentSnippet || item.content || item.summary || item.description || '';
        const summary = feed.isArxiv ? cleanText(rawSummary, 400) : cleanText(rawSummary);
        const link = item.link || item.guid || item.url || '';

        return {
          title,
          summary: summary || (feed.isArxiv ? 'New preprint in AI/ML.' : ''),
          link,
          source: feed.name,
          published: item.pubDate || item.isoDate || '',
        };
      })
      .filter((item) => item.title.length > 10);

    console.log(`  [${feed.name}] fetched ${items.length} items`);
    return items;
  } catch (err) {
    console.warn(`  [${feed.name}] failed: ${err.message}`);
    return [];
  }
}

export async function fetchLatestAINews() {
  console.log('Fetching AI news from RSS feeds...');
  const results = await Promise.allSettled(RSS_FEEDS.map(fetchFeed));

  const allItems = results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value);

  const unique = [];
  const seenTitles = new Set();
  for (const item of allItems) {
    const key = item.title.toLowerCase().slice(0, 50);
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      unique.push(item);
    }
  }

  console.log(`Total unique news items: ${unique.length}`);
  return unique.slice(0, 25);
}
