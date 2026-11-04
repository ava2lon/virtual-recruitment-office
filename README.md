# WorkBridge

WorkBridge is a recruitment platform connecting candidates and employers.

> One platform. Zero friction. One connection.

## Stack
- Next.js App Router
- React
- Supabase Auth and database
- Vercel deployment
- n8n automation integration

## Features
- Candidate application tracker with private follow-up notes.
- Employer vacancy publishing with automated social-copy workflow.
- Hiring pipeline board grouped by stage.
- Candidate analytics dashboard.
- Dark/light theme with design tokens.
- Health, OG image, and inbound automation endpoints.

## Local development
1. Install Node.js 20 or later.
2. Copy `.env.example` to `.env.local` and add your Supabase project URL and publishable/anon key.
3. Run `npm install`.
4. Run `npm run dev`.

## Environment
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
- `NEXT_PUBLIC_WORKBRIDGE_PREVIEW_READONLY`
- `WORKBRIDGE_N8N_VACANCY_WEBHOOK_URL`
- `WORKBRIDGE_N8N_INBOUND_SECRET`
- `NEXT_PUBLIC_SITE_URL`

## Scripts
- `npm run dev` — development server
- `npm run build` — production build
- `npm run lint` — lint
- `npm run test:security` — database security regression checks
- `npm run test:authorization` — isolated authorization integration tests

## API
See `docs/API.md`.

## Security
See `SECURITY.md`. Never commit secrets; use environment variables.
