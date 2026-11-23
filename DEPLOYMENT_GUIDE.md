# RoMetric — Owner Deployment & Maintenance Guide ($0 Budget)

This guide is written for non-programmers. You do **not** need to write code, buy a domain, or enter a credit card to launch RoMetric publicly.

---

## Part 1: How RoMetric Works (Plain English)

1. **The Website (Next.js)**: Displays live player counts, rankings, historical charts, comparisons, developer profiles, and your private `/admin` dashboard.
2. **The Data Collector**: Quietly asks Roblox's official public web endpoints (`games.roblox.com` and `thumbnails.roblox.com`) for current player counts, visits, favorites, and likes in small polite batches of 50 games at a time.
3. **The Historical Database**: Saves every observation with a UTC timestamp so RoMetric owns its own history. To stay inside the free 500 MB storage cap, raw snapshots older than 48 hours are summarized into hourly and permanent daily charts before being cleaned up.

---

## Part 2: Using Your Live App Right Now (Zero Setup Required)

1. Open your RoMetric app and visit **`/admin`** (or click **Owner Admin Console** in the footer).
2. Click **Sign in with Google** using your owner email.
3. Click **Initialize DB & Collect Now**. Within a few seconds, RoMetric fetches real live stats from Roblox for the initial catalog and stores the first permanent snapshots.
4. Click **Enable 5m Auto-Collect** (or click **Run Manual Collection Now** again a few minutes later) to build multi-point historical charts and unlock real measured growth percentages & Trending velocity!

---

## Part 3: Free Public Production Launch (GitHub + Supabase + Cloudflare — $0)

When you are ready to run RoMetric 24/7 on your own free external accounts:

### Step 1 — Create a Free GitHub Account
1. Go to `github.com` and click **Sign up** (Free plan — no credit card).
2. Create a new **Private** repository named `rometric`.
3. Export/push this project folder into your `rometric` repository.

### Step 2 — Create a Free Supabase PostgreSQL Database
1. Go to `supabase.com`, click **Start your project**, and sign in with GitHub.
2. Click **New Project**, name it `RoMetric`, choose the Free plan ($0/month), and pick the region closest to your audience.
3. Once ready, open **SQL Editor** in the left menu, click **New Query**, paste the entire contents of `deploy/supabase-schema.sql`, and click **Run**.
4. Go to **Project Settings → API** and keep two values handy:
   - **Project URL** (`SUPABASE_URL`)
   - **service_role secret key** (`SUPABASE_SERVICE_ROLE_KEY` — keep this completely private!)

### Step 3 — Deploy to Cloudflare Workers (Free Plan)
1. Go to `dash.cloudflare.com` and create a free account (no credit card required for Workers Free).
2. Go to **Workers & Pages → Create → Import a repository** and connect your GitHub `rometric` repo.
3. Add your environment variables inside Cloudflare Dashboard → **Settings → Variables & Secrets** (never paste secrets into code).
4. Deploy the background collector (`deploy/wrangler.toml` + `deploy/cloudflare-collector-worker.ts`) and add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as encrypted Worker Secrets.
5. Cloudflare will give you a free HTTPS URL (`rometric.<your-name>.workers.dev`) and run your 3 scheduled Cron Triggers automatically every 5 minutes, 15 minutes, and daily at 03:00 UTC!

---

## Part 4: Monitoring Free-Tier Limits & Maintenance

### Weekly 2-Minute Health Check
1. Open **`/admin`** and check:
   - **Collection Success Rate**: Should stay above 95%. Occasional HTTP 429s are automatically retried.
   - **Free-Tier Storage Bar**: Keep below 75% (375 MB of 500 MB). Click **Prune expired raw** if needed, or verify the daily `03:00 UTC` rollup ran in Supabase.
2. Check **Supabase Dashboard → Reports**: Watch **Database Size (< 500 MB)** and **Egress Bandwidth (< 5 GB uncached/month)**.

### Backing Up Your Database for Free
- In Supabase Dashboard → **SQL Editor** (or Table Editor), you can export `games` and `game_daily_stats` to CSV monthly as an offline backup, since Supabase Free does not include automatic daily snapshots.

### When & How to Reinvest Website Revenue
Upgrade **only** when your site earns enough revenue to pay for the next step:
1. **First $5/month earned** → **Cloudflare Workers Paid ($5/mo)**: Removes the 3 MiB bundle ceiling and expands to 10M requests/month + higher CPU/subrequest limits.
2. **First $10/year earned** → **Custom Domain** (`rometric.com`) via Cloudflare Registrar (at-cost pricing, free SSL).
3. **First $25/month earned** → **Supabase Pro ($25/mo)**: Expands database from 500 MB to 8 GB, adds 250 GB egress, automatic daily backups, and allows keeping 30+ days of raw 5-minute snapshots for 5,000+ games!
