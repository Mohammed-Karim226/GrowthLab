# GrowthLab
YouTube Creator Outreach CRM for media buyers and outreach managers.

## Client Analytics Portal

An internal tool alongside the marketing site: GrowthLab staff turn social-media
insight screenshots into published reports, and each client signs in to see only
their own.

Admins can set followers (or YouTube subscribers) when adding or editing a social
account. The saved total appears beneath its name in the portal's **Active
accounts** list, which refreshes every 30 seconds and when the portal regains
focus. Blank counts show a dash; zero remains zero. Apply
`supabase/migrations/0014_account_audience.sql` before saving account counts.

## Getting started

```bash
npm install
cp .env.example .env.local     # fill in Supabase + Gemini values
npm run dev
```

The marketing pages work with no configuration. The portal needs the database
applied and a first admin created — see **[docs/PORTAL.md](docs/PORTAL.md)** for
setup, architecture, and the pre-launch verification checklist.

Each landing-page testimonial currently shows illustrative audience totals from
account launch (zero) through Day 30, with different figures per creator in
`src/lib/landing.tsx`. Most creators' Day 30 totals stay within Instagram 7k–11k,
Facebook 10k–40k, TikTok 5k–7k, and approximately 5k YouTube subscribers
(4.8k–5.2k). Mind uses the separately supplied totals: Instagram 30k, Facebook
45k, TikTok 11k, and YouTube 5k.
These are display examples, not verified extractions from client reports. The
optional `platformGrowth` field takes precedence over report analytics.

Without that override, the cards show saved, reviewed metrics from uploaded
insights in each creator's latest published report. Repeated snapshots count
once per account, missing metrics display as unavailable, and report totals
refresh every minute. The curated creator name mapping is in
`src/lib/testimonials/server.ts`. The marketing page works without database
configuration.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:landing` | Test testimonial follower totals and report data scoping |
| `npm run db:migrations:check` | Read-only check of all migration schema effects, current function bodies and key permissions |
| `npm run bootstrap:admin` | Create the first admin account |
| `npm run verify:isolation` | Tenant-isolation test suite (run before launch) |
