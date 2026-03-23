# Gatura-girls-E-learning

## Hosting Environment Variables

Set these variables in your hosting provider before deploying:

- `NEXT_PUBLIC_SUPABASE_URL` (recommended, but the app falls back to the current project URL if omitted)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

If the publishable key is missing in production, the middleware will fail before any page renders.