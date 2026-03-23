# Gatura-girls-E-learning

## Hosting Environment Variables

Set these variables in your hosting provider before deploying:

- `NEXT_PUBLIC_SUPABASE_URL` (recommended, but the app falls back to the current project URL if omitted)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` (recommended, but the app falls back to the current project publishable key if omitted)
- `SUPABASE_SERVICE_ROLE_KEY`

If `SUPABASE_SERVICE_ROLE_KEY` is missing in production, auth-admin routes such as account creation, bulk import, pin reset, and account deletion will still fail.

The following features now work without the service-role key as long as the signed-in user has the correct Supabase role and policies:

- student announcements
- student assignment loading
- grade chat
- admin storage health and storage cleanup

Run these SQL migrations in Supabase to match the app's current visibility rules:

- `migration-grade-chat.sql`
- `migration-all-streams.sql`
- `migration-student-content-visibility.sql`