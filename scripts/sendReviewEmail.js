import nodemailer from 'nodemailer';
import { getLatestDraft } from './saveDraft.js';

function buildApproveUrl(filename) {
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_PAT;

  // GitHub Actions workflow_dispatch URL — clicking this triggers the publish workflow
  // We encode the filename as a query param in the approve URL
  const baseUrl = `https://api.github.com/repos/${repo}/actions/workflows/publish.yml/dispatches`;
  return `https://approve.news-stop.workers.dev/approve?file=${encodeURIComponent(filename)}&token=${token}`;
}

function buildEmailHtml(draft, approveUrl, rejectUrl) {
  const preview = draft.content
    .replace(/^---[\s\S]+?---\n/m, '')
    .replace(/#{1,6}\s/g, '')
    .trim()
    .slice(0, 500);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; }
    .header { background: #1a1a2e; color: white; padding: 24px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 18px; }
    .header p { margin: 8px 0 0; opacity: 0.7; font-size: 14px; }
    .body { background: #f9f9f9; padding: 24px; border: 1px solid #e0e0e0; }
    .title { font-size: 22px; font-weight: bold; color: #1a1a2e; margin-bottom: 12px; }
    .summary { color: #555; line-height: 1.6; margin-bottom: 16px; }
    .preview { background: white; border-left: 3px solid #1a1a2e; padding: 16px; font-size: 14px; color: #666; line-height: 1.6; }
    .actions { padding: 24px; text-align: center; background: white; border: 1px solid #e0e0e0; border-top: none; }
    .btn { display: inline-block; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px; margin: 0 8px; }
    .approve { background: #16a34a; color: white; }
    .reject { background: #dc2626; color: white; }
    .tip { background: #eff6ff; border: 1px solid #bfdbfe; border-top: none; padding: 14px 24px; font-size: 13px; color: #1e40af; border-radius: 0 0 8px 8px; text-align: center; }
    .footer { margin-top: 20px; font-size: 12px; color: #999; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1>AI Article Writer</h1>
    <p>Daily draft ready for review — publishes to Dev.to</p>
  </div>
  <div class="body">
    <div class="title">${draft.title}</div>
    <div class="summary">${draft.summary}</div>
    <div class="preview">${preview}...</div>
  </div>
  <div class="actions">
    <a href="${approveUrl}" class="btn approve">Approve &amp; Publish</a>
    <a href="${rejectUrl}" class="btn reject">Reject</a>
  </div>
  <div class="tip">
    After publishing, you can also cross-post to Medium via <strong>medium.com/p/import</strong>
  </div>
  <div class="footer">
    File: ${draft.filename} &bull; Publishes to Dev.to automatically on approval
  </div>
</body>
</html>
`;
}

export async function sendReviewEmail(draft) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_FROM,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });

  const approveUrl = `https://api.github.com/repos/${process.env.GITHUB_REPO}/actions/workflows/publish.yml/dispatches`;
  const rejectUrl = `https://api.github.com/repos/${process.env.GITHUB_REPO}/actions/workflows/reject.yml/dispatches`;

  // For mobile: direct GitHub API call links won't work from email
  // Instead we use a simple Cloudflare Worker proxy (free) OR encode the action in a mailto
  // Simplest working approach: GitHub token in URL via a redirect worker
  const approveLink = `https://api.github.com/repos/${process.env.GITHUB_REPO}/actions/workflows/publish.yml/dispatches`;

  // Avoid double slash when APPROVE_BASE_URL has a trailing slash
  const baseUrl = (process.env.APPROVE_BASE_URL || '').replace(/\/+$/, '');

  const html = buildEmailHtml(
    draft,
    `${baseUrl}/approve?file=${encodeURIComponent(draft.filename)}&secret=${process.env.WEBHOOK_SECRET}`,
    `${baseUrl}/reject?file=${encodeURIComponent(draft.filename)}&secret=${process.env.WEBHOOK_SECRET}`
  );

  await transporter.sendMail({
    from: `"AI Medium Writer" <${process.env.EMAIL_FROM}>`,
    to: process.env.EMAIL_TO,
    subject: `[Review] ${draft.title}`,
    html,
  });

  console.log(`Review email sent to ${process.env.EMAIL_TO}`);
}

// Test mode
if (process.argv.includes('--test')) {
  const draft = getLatestDraft();
  if (!draft) {
    console.log('No drafts found. Run generate.js first.');
  } else {
    await sendReviewEmail(draft);
  }
}
