# Gatura-girls-E-learning

## Hosting Environment Variables

Set these variables in your hosting provider before deploying:

- `NEXT_PUBLIC_SUPABASE_URL` (recommended, but the app falls back to the current project URL if omitted)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` (recommended, but the app falls back to the current project publishable key if omitted)
- `SUPABASE_SERVICE_ROLE_KEY`

If `SUPABASE_SERVICE_ROLE_KEY` is missing in production, admin and server-side privileged routes will still fail even though the public app can load.