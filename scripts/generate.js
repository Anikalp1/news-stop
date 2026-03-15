import 'dotenv/config';
import { fetchLatestAINews } from './fetchNews.js';
import { generateArticle } from './generateArticle.js';
import { saveDraft } from './saveDraft.js';
import { sendReviewEmail } from './sendReviewEmail.js';

async function main() {
  console.log('=== AI Medium Writer — Daily Generation ===\n');

  const news = await fetchLatestAINews();
  if (news.length === 0) {
    console.error('No news items fetched. Exiting.');
    process.exit(1);
  }

  const { topic, content } = await generateArticle(news);
  const { filename, filepath } = saveDraft(topic, content);

  console.log('\n--- Draft Preview ---');
  console.log(`Title:   ${topic.title}`);
  console.log(`File:    ${filepath}`);
  console.log(`Summary: ${topic.summary}`);

  await sendReviewEmail({ title: topic.title, summary: topic.summary, filename, content });

  console.log('\nDone. Review email sent. Waiting for approval.');
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
