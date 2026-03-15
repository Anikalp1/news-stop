import Parser from 'rss-parser';

const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)' },
});

const RSS_FEEDS = [
  {
    name: 'Google News AI',
    url: 'https://news.google.com/rss/search?q=artificial+intelligence+developer&hl=en-US&gl=US&ceid=US:en',
  },
  {
    name: 'Hacker News AI',
    url: 'https://hnrss.org/newest?q=AI+LLM+machine+learning&count=15',
  },
  {
    name: 'Reddit MachineLearning',
    url: 'https://www.reddit.com/r/MachineLearning/.rss',
  },
];

function isRecent(dateStr) {
  if (!dateStr) return true;
  const published = new Date(dateStr);
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours
  return published > cutoff;
}

function cleanText(text) {
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
    .slice(0, 300);
}

async function fetchFeed(feed) {
  try {
    const result = await parser.parseURL(feed.url);
    const items = result.items
      .filter((item) => isRecent(item.pubDate || item.isoDate))
      .slice(0, 5)
      .map((item) => ({
        title: cleanText(item.title),
        summary: cleanText(item.contentSnippet || item.content || item.summary || ''),
        link: item.link || item.guid || '',
        source: feed.name,
        published: item.pubDate || item.isoDate || '',
      }))
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
  return unique.slice(0, 10);
}
