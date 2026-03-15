import 'dotenv/config';
import { getLatestDraft, markAsPublished } from './saveDraft.js';
import { publishToDevTo } from './publishToDevTo.js';

async function main() {
  const filename = process.env.DRAFT_FILENAME;

  console.log('=== AI Article Writer — Publishing ===\n');

  const draft = getLatestDraft();
  if (!draft) {
    console.error('No drafts found to publish.');
    process.exit(1);
  }

  if (filename && draft.filename !== filename) {
    console.error(`Expected draft "${filename}" but found "${draft.filename}"`);
    process.exit(1);
  }

  console.log(`Publishing: "${draft.title}"`);

  const article = await publishToDevTo(draft.filepath);
  markAsPublished(draft.filepath);

  console.log('\n=== Published Successfully ===');
  console.log(`Dev.to URL:          ${article.url}`);
  console.log(`Medium Import URL:   ${article.mediumImportUrl}`);
  console.log('\nTo also publish on Medium, open the import URL above.');

  // Write publish result for GitHub Actions summary
  if (process.env.GITHUB_STEP_SUMMARY) {
    const summary = `## Article Published\n\n**${article.title}**\n\n- [View on Dev.to](${article.url})\n- [Import to Medium](${article.mediumImportUrl})\n`;
    import('fs').then(({ writeFileSync, appendFileSync }) => {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
    });
  }
}

main().catch((err) => {
  console.error('Publish failed:', err.message);
  process.exit(1);
});
