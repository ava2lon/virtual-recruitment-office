# WorkBridge

WorkBridge is a recruitment platform connecting candidates and employers.

> One platform. Zero friction. One connection.

## Stack
- Next.js App Router
- React
- Supabase Auth and database
- Vercel deployment

## Local development
1. Install Node.js 20 or later.
2. Copy `.env.example` to `.env.local` and add your Supabase project URL and publishable/anon key.
3. Run `npm install`.
4. Run `npm run dev`.

## Environment
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The application deliberately defers Supabase client creation until it is needed so builds can complete when environment variables are not present. Auth/database actions require valid Supabase settings.

## Recovery note
This repository was empty when recovery began. The application structure below was reconstructed using the routes and package metadata from the existing Vercel deployment. It is a maintainable source recovery baseline, not a byte-for-byte export of the original source files. Validate database table/column names against the active Supabase schema before promoting a new deployment.
