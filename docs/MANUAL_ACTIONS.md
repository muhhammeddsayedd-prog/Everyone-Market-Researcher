# Manual actions for the owner

Things only the owner (Mohamed) can do: accounts, payments, secrets, approvals. Codex never creates paid accounts, never enters payment details, and never sees raw secrets beyond what the owner pastes into credential stores.

How this works:
1. Each action has an ID (`MA-xx`) and the milestone that needs it.
2. When Codex reaches it, Codex copies it into that milestone's `PROGRESS.md` → "Manual actions needed" and sets the status to Blocked if nothing else can proceed.
3. The owner does it, ticks it in the milestone `PROGRESS.md`, and adds any non-secret value (project ref, URL) there.
4. Secrets go only into Vercel, n8n or a local `.env`, never into the repo or chat.

| ID | Milestone | Action | Steps | Done when |
|---|---|---|---|---|
| MA-01 | M00 | Give Codex repo access | Make sure Codex can push branches and open PRs to `muhhammeddsayedd-prog/Everyone-Market-Researcher`. Enable branch protection on `main` (PR required, CI must pass). | Codex pushes `m00-bootstrap` |
| MA-02 | M00 | Create the Vercel project | Vercel → Add New → Project → import the GitHub repo → root `apps/web` → framework Next.js. No env vars yet. | Preview deploy URL exists |
| MA-03 | M01 | Create Supabase projects | Supabase → New project `emr-dev` and `emr-prod` (Pro, same region, strong DB passwords saved in your password manager). Send Codex the two **project refs** (not passwords). | Refs in M01 PROGRESS |
| MA-04 | M01 | Scoped access token for Codex | Supabase → Account → Access Tokens → create a **scoped** token for `emr-dev` (database + migrations + functions read/write) and a separate one for `emr-prod`, to be used only when you approve prod changes. Put them in Codex's environment as `SUPABASE_ACCESS_TOKEN`. | `supabase projects list` works for Codex |
| MA-05 | M01 | Set machine role passwords | After Codex's M01 migration runs: in each project's SQL editor run `alter role n8n_writer password '<gen>';` and `alter role api_agent password '<gen>';` (generate with `openssl rand -base64 32`). Keep them for MA-11 and MA-20. | Codex test connection succeeds |
| MA-06 | M01 | Google sign-in | Google Cloud → APIs & Services → OAuth consent (Internal if Workspace) → Credentials → OAuth client (Web) with redirect `https://<dev-ref>.supabase.co/auth/v1/callback` (and prod). Supabase → Authentication → Providers → Google → paste the client ID and secret. | Test login on dev works (M09) |
| MA-07 | M02 | Vimeo token | developer.vimeo.com → Create app → Generate an access token, scope **Public** only. Store as `VIMEO_TOKEN` locally for the resolve script and later in n8n (MA-11). | Resolve script resolves Vimeo IDs |
| MA-08 | M02 | YouTube API key | Google Cloud → enable **YouTube Data API v3** → Credentials → API key → restrict to YouTube Data API v3. Store as `YOUTUBE_API_KEY`. | Resolve script resolves channel IDs |
| MA-09 | M02 | Review unresolved accounts | Codex lists accounts it couldn't resolve or that look wrong. Confirm, fix the URL, or mark invalid. | List cleared |
| MA-10 | M03 | Apify plan + token | Confirm your Apify plan tier (Starter/Scale/Business: it sets prices). Create an API token. For `louisdeconinck/instagram-story-details-scraper`, note that it needs a paid plan. | Token in n8n |
| MA-11 | M03 | n8n credentials | In n8n → Credentials, create those listed in `docs/ENVIRONMENT.md` §2 (Postgres dev/prod with `n8n_writer`, Apify, OpenAI, SerpAPI, Firecrawl, Vimeo, YouTube, Email placeholder, internal header). Make sure Codex's n8n MCP connection is enabled. | Codex lists credentials by name |
| MA-12 | M03 | OpenAI key + limits | platform.openai.com → Project `market-radar` → API key; set a monthly budget limit and alert. | Key in n8n + Vercel |
| MA-13 | M03 | Daily budget | Tell Codex the daily budget (USD) for the budget alert (`ops.settings.daily_budget_usd`; default 150 during backfill, ~25 steady state). | Value set |
| MA-14 | M04 | Approve backfill estimate (Vimeo + IG) | Codex posts the estimated items and cost for the pilot backfill. Reply "approved" in PROGRESS. | Approved |
| MA-15 | M05 | Firecrawl key + approve backfill estimate (web, YouTube, LinkedIn) | Create a Firecrawl key; add it to n8n. Approve the estimate. | Approved |
| MA-16 | M06 | Approve the stories actor | Review the bake-off table (coverage, cost, no login) and pick the primary actor. | Choice recorded |
| MA-17 | M07 | Eval labels + model choice | Review the 200-item eval sheet Codex pre-labels (fix wrong brands/houses). Approve the extraction model. | Eval locked; model in DECISIONS |
| MA-18 | M08 | Approve pilot start | Confirm that daily schedules for the 50 + baseline go live in prod. Pilot day 1 = that date. | Date recorded |
| MA-19 | M09 | Auth URLs + first users | Supabase → Auth → URL configuration: Site URL + redirect URLs (localhost, Vercel preview pattern, prod domain). Invite yourself and 2–3 testers in the app (or Codex seeds `member_invites`). | You can sign in |
| MA-20 | M06 / M09 / M11 / M14 | Vercel env vars | Add the variables from `docs/ENVIRONMENT.md` §2 (Vercel) for Preview (dev) and Production (prod). | Build passes with env |
| MA-21 | M11 | Admin acceptance | Walk through review + admin flows with Codex's checklist; note issues. | Checklist signed |
| MA-22 | M12 | Pilot go/no-go | Read the pilot report (accuracy, cost, forecast, actor results). Approve the threshold and scale-up plan, or ask for fixes. | Decision in DECISIONS.md |
| MA-23 | M13 | Email provider | Choose Resend (create account, verify the sending domain DNS: SPF/DKIM) or SMTP. Add the credential in n8n. Confirm the recipient list (default mohamed.abdelrahman@everyone.film). | Test email received |
| MA-24 | M13 | SerpAPI plan | Create a SerpAPI account, pick a plan for ~600 searches/month at full scale, and add the key to n8n. | Key works |
| MA-25 | M14 | First API keys + MCP | In Admin → API keys create a key for Claude/Codex; add the MCP server URL + header to your Claude/Codex config. | Agent lists tools |
| MA-26 | M15 | Approve scale-up waves | Approve wave sizes and timing (e.g., +80 next-wave per day) and the backfill cost. | Waves approved |
| MA-27 | M15 | Production domain (optional) | Add a domain (e.g. `radar.everyone.film`) in Vercel; update Supabase + Google redirect URLs. | Domain live |
| MA-28 | M15 | Security sign-off + onboarding | Review the security checklist results; invite the team with roles. | Launch |
