# AI Article Writer

Automated system that generates one high-quality AI-focused article daily, sends it to your phone for approval, and publishes it to **Dev.to** automatically when you tap Approve. Optionally cross-post to Medium manually in 10 seconds.

> **Note:** Medium no longer issues new API tokens (deprecated Jan 2025). Dev.to has a fully working free API and a 1M+ developer audience — a better fit for AI/dev content anyway.

**Total cost: $0/month** | **Daily effort: ~2 minutes**

---

## How It Works

```
GitHub Actions (8 PM IST daily)
  → Fetch AI news (RSS feeds)
  → Gemini generates 1200-word article
  → Save draft to repo
  → Send email with Approve/Reject buttons
         ↓
  You tap Approve on your phone
         ↓
  Cloudflare Worker triggers GitHub Actions
         ↓
  Article published to Dev.to
         ↓  (optional, 10 seconds)
  Paste Dev.to URL into medium.com/p/import
  → Article also live on Medium
```

---

## Setup (One-Time, ~30 minutes)

### Step 1 — Get API Keys

| Service | Where to get it | Cost |
|---|---|---|
| **Gemini API** | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) | Free (1500 req/day) |
| **Dev.to API Key** | dev.to/settings/extensions → DEV API Keys | Free |
| **Gmail App Password** | myaccount.google.com/apppasswords | Free |
| **GitHub PAT** | github.com/settings/tokens (scopes: `repo`, `workflow`) | Free |

---

### Step 2 — Deploy Cloudflare Worker

This is the "Approve" button backend. Free forever.

1. Go to [workers.cloudflare.com](https://workers.cloudflare.com) and create a free account
2. Create a new Worker
3. Paste the contents of `worker/index.js`
4. In Worker Settings → Variables, add:
   - `WEBHOOK_SECRET` — a random string (generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `GITHUB_PAT` — your GitHub Personal Access Token
   - `GITHUB_REPO` — `yourusername/news-stop`
5. Note your Worker URL: `https://your-worker.yourname.workers.dev`

---

### Step 3 — Set GitHub Secrets

In your repo → Settings → Secrets and variables → Actions, add:

| Secret Name | Value |
|---|---|
| `GEMINI_API_KEY` | Your Gemini API key |
| `DEVTO_API_KEY` | Your Dev.to API key |
| `EMAIL_FROM` | Your Gmail address |
| `EMAIL_APP_PASSWORD` | Your Gmail App Password |
| `EMAIL_TO` | Email where you want review notifications |
| `APPROVE_BASE_URL` | Your Cloudflare Worker URL |
| `WEBHOOK_SECRET` | Same random string from Step 2 |

---

### Step 4 — Push to GitHub

```bash
git init
git add .
git commit -m "initial: ai medium writer setup"
git remote add origin https://github.com/yourusername/news-stop.git
git push -u origin master
```

The daily workflow will run automatically at **8:00 PM IST**.

---

## Running Locally

```bash
# Install dependencies
npm install

# Copy and fill in environment variables
cp .env.example .env

# Generate an article manually
npm run generate

# Publish the latest draft manually
npm run publish

# Test the review email
npm run test-email
```

---

## Project Structure

```
news-stop/
├── scripts/
│   ├── generate.js          # Main pipeline: fetch → generate → email
│   ├── publish.js           # Publish approved draft to Dev.to
│   ├── fetchNews.js         # RSS feed fetcher
│   ├── generateArticle.js   # Gemini article generation
│   ├── saveDraft.js         # Draft file management
│   ├── sendReviewEmail.js   # Email with approve/reject links
│   └── publishToDevTo.js    # Dev.to API publisher
├── worker/
│   └── index.js             # Cloudflare Worker (approve/reject proxy)
├── .github/workflows/
│   ├── generate.yml         # Daily cron: generate + email
│   ├── publish.yml          # Triggered on approval: publish to Dev.to
│   └── reject.yml           # Triggered on rejection: delete draft
├── drafts/                  # Generated drafts (git-ignored locally)
├── published/               # Published articles archive
├── .env.example             # Environment variable template
└── README.md
```

---

## Workflow

### Daily (automatic)
1. GitHub Actions runs at 8 PM IST
2. Fetches latest AI news from Google News, Hacker News, Reddit
3. Gemini selects the best topic and writes a 1200-word article
4. Draft saved to `drafts/` and committed to repo
5. Email sent to your phone with article preview + Approve/Reject buttons

### On Approval
1. You tap **Approve** in the email on your phone
2. Cloudflare Worker receives the request
3. Worker calls GitHub API to trigger `publish.yml`
4. Article published to Medium
5. Draft moved to `published/` folder

### On Rejection
1. You tap **Reject**
2. Draft is deleted from repo
3. New article generated next day

---

## Cost Summary

| Component | Cost |
|---|---|
| Gemini API (1500 free req/day) | $0 |
| GitHub Actions (2000 min/month free) | $0 |
| Cloudflare Workers (100k req/day free) | $0 |
| Gmail SMTP | $0 |
| Dev.to API | $0 |
| **Total** | **$0/month** |

---

## Potential Earnings

Medium Partner Program pays based on read time. Consistent daily AI/dev content:
- Month 1–2: $5–20 (building audience)
- Month 3–6: $50–150 (growing)
- Month 6+: $100–500+ (established)

Plus: portfolio content, LinkedIn presence, personal brand.
