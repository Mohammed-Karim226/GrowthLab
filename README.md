# GrowthLab
YouTube Creator Outreach CRM for media buyers and outreach managers.

## Client Analytics Portal

An internal tool alongside the marketing site: GrowthLab staff turn social-media
insight screenshots into published reports, and each client signs in to see only
their own.

## Getting started

```bash
npm install
cp .env.example .env.local     # fill in Supabase + Gemini values
npm run dev
```

The marketing pages work with no configuration. The portal needs the database
applied and a first admin created — see **[docs/PORTAL.md](docs/PORTAL.md)** for
setup, architecture, and the pre-launch verification checklist.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run bootstrap:admin` | Create the first admin account |
| `npm run verify:isolation` | Tenant-isolation test suite (run before launch) |
