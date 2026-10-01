# Deployment status

Supabase project: `ubjqmdvjttkufcfeyfyw` (Ben's Project).

- Database migration `202609290001_workroom` applied using the HTTPS Management API because the direct Postgres connection timed out. Migration history recorded in `supabase_migrations.schema_migrations`.
- `manage-employee` Edge Function deployed.
- Live anonymous access checks: assignments return permission denied; employee-management function returns sign-in required.
- Frontend configured with the provided public project URL and publishable key in ignored `.env.local`.
- Production frontend: https://bens-workroom.vercel.app
- Vercel project: `samrawitkahsay71-6857s-projects/bens-workroom`. Public Supabase variables saved in Production environment.
- GitHub auto-deploy connection not enabled: Vercel requires the account owner to add a GitHub Login Connection. CLI redeploy remains available with `npx vercel --prod`.
- First manager account pending the user's manager email.

Never upload `.env.local` or account credentials. Only the two public `VITE_` values belong in Vercel build configuration.

## Section 2 upgrade (prepared locally)

The employee portal and assignment AI analysis require the new `202609300001_feedback_authors.sql` migration, the `analyze-assignment` Edge Function, and a frontend redeploy. They have not been deployed by this task. Follow [SECTION2.md](SECTION2.md). Gemini can be connected afterward with the server-only `GEMINI_API_KEY` secret.
