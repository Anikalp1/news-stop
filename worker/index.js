/**
 * Cloudflare Worker — Approve/Reject proxy for AI Medium Writer
 *
 * Deploy free at: https://workers.cloudflare.com
 * Set these environment variables in the Worker settings:
 *   WEBHOOK_SECRET  — a random secret string (same as in GitHub Secrets)
 *   GITHUB_PAT      — GitHub Personal Access Token with repo + actions:write scope
 *   GITHUB_REPO     — e.g. "yourusername/news-stop"
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const action = url.pathname.replace('/', '');
    const file = url.searchParams.get('file');
    const secret = url.searchParams.get('secret');

    // Validate secret
    if (!secret || secret !== env.WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    if (!file) {
      return new Response('Missing file parameter', { status: 400 });
    }

    if (action === 'approve') {
      // Trigger the publish workflow via GitHub API
      const res = await fetch(
        `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/publish.yml/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.GITHUB_PAT}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify({
            ref: 'master',
            inputs: { draft_filename: file },
          }),
        }
      );

      if (res.status === 204) {
        return new Response(approvedHtml(file), {
          headers: { 'Content-Type': 'text/html' },
        });
      } else {
        const body = await res.text();
        return new Response(`GitHub API error: ${res.status} — ${body}`, { status: 500 });
      }
    }

    if (action === 'reject') {
      // Trigger the reject workflow
      await fetch(
        `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/reject.yml/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.GITHUB_PAT}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify({
            ref: 'master',
            inputs: { draft_filename: file },
          }),
        }
      );

      return new Response(rejectedHtml(file), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    return new Response('Not found', { status: 404 });
  },
};

function approvedHtml(file) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Article Approved</title>
  <style>
    body { font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f0fdf4; }
    .card { text-align: center; padding: 40px; background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 360px; }
    .icon { font-size: 64px; }
    h1 { color: #16a34a; margin: 16px 0 8px; }
    p { color: #555; }
    small { color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Article Approved!</h1>
    <p>Publishing to Medium now. This usually takes 1–2 minutes.</p>
    <small>${file}</small>
  </div>
</body>
</html>`;
}

function rejectedHtml(file) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Article Rejected</title>
  <style>
    body { font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fef2f2; }
    .card { text-align: center; padding: 40px; background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 360px; }
    .icon { font-size: 64px; }
    h1 { color: #dc2626; margin: 16px 0 8px; }
    p { color: #555; }
    small { color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">❌</div>
    <h1>Article Rejected</h1>
    <p>Draft has been discarded. A new one will be generated tomorrow.</p>
    <small>${file}</small>
  </div>
</body>
</html>`;
}
