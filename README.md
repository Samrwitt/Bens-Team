# Workroom — Supabase manager workspace

The active app is a static Vite frontend backed by Supabase Auth, PostgreSQL, and one Edge Function. No Python server or Docker service is needed in production.

Implemented: manager email/password login, employee account creation and password resets, teams, assignments, statuses, feedback and nested replies. Existing UI screenshots in `previews/` show the earlier design; sign-in now includes email.

## 1. Create the Supabase backend

Create a Supabase project. In its SQL Editor, run `supabase/migrations/202609290001_workroom.sql` once. It creates the tables, database functions, and row-level access policies.

Alternatively, with the Supabase CLI installed:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy manage-employee
```

If you used SQL Editor for the schema, skip `db push` and deploy only the function. The Edge Function needs Supabase's built-in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables. The function explicitly verifies the user's JWT through Auth and checks their database role before running an administrative action. `verify_jwt=false` in its config supports publishable keys; it does not bypass these in-function authorization checks.

Disable public user signup in Supabase Auth settings. Managers create employee accounts through the protected function.

## 2. Create the first manager

In Supabase Dashboard → Authentication → Users, add a confirmed user with your manager email and a strong password. Copy its user UUID. Then run this in SQL Editor, replacing all example values:

```sql
insert into public.employees(auth_user_id, name, email, role)
values ('YOUR_AUTH_USER_UUID', 'Your name', 'you@example.com', 'manager');
```

The browser cannot grant manager permissions. Employee passwords are held by Supabase Auth, not app tables. This is one shared company workspace: every manager can manage all company records. It is not a multi-company SaaS.

## 3. Run the frontend

Use Node 22 LTS or newer.

```sh
npm ci
cp .env.example .env.local
```

Set these in `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY
```

Use the project publishable key or legacy anon key. Never use a service-role or secret key in any `VITE_` variable: these values are included in browser assets.

```sh
npm run dev
```

Open the address Vite prints and sign in with the manager email and password. Missing configuration shows a setup screen; there is no fallback to demo data.

## 4. Deploy the static frontend

Connect the repository to your static host. Settings:

- Build command: `npm ci && npm run build`
- Output directory: `dist`
- Node version: 22
- Environment: the two public `VITE_` variables above

Netlify and Vercel configuration files are included. Cloudflare Pages can use the same build command and output directory. Hash-based navigation needs no SPA rewrite. Rebuild after changing frontend environment variables. Set the final website URL in Supabase Auth's Site URL configuration.

Verify live manager sign-in, employee creation, team creation, assignment creation, and replies after deploying both the database and Edge Function. Frontend hosting alone does not deploy the Supabase backend.

## Permissions

- Anonymous visitors cannot read app tables.
- Managers can read all workspace records, manage teams/assignments, and add feedback.
- Employees can read their own profile and assignments owned by them or a team they currently belong to, plus associated feedback. They can add feedback only to those assignments.
- Employees cannot create assignments, edit statuses, change membership, grant roles, or impersonate feedback authors.
- Replies have a composite foreign key enforcing that parent and child belong to the same assignment.
- Team membership changes are transactional. Removing someone from a team removes their access to that team's assignments.

The employee UI, file uploads/Storage, and AI analysis remain future sections. They are not enabled by this migration.

## Validation

```sh
npm run build
npm test  # requires Docker; creates and removes a disposable PostgreSQL container
npm run test:ui  # requires Chrome; set CHROME_PATH if installed elsewhere
```

`tests/policies.sql` exercises real PostgreSQL access policies: manager access, employee isolation, anonymous denial, role escalation denial, author spoofing denial, team removal, and cross-assignment reply rejection. Run it only in a disposable database. `tests/bootstrap.sql` provides a minimal Auth stand-in for plain PostgreSQL; do not run that bootstrap in a real Supabase project.

Validation completed locally: production build, PostgreSQL policy tests, Deno Edge Function type-check, and Chrome workflow test passed. Hosted Supabase Auth and Edge Function integration has not yet been tested.

Browser tests use mocked Supabase HTTP responses to check UI wiring; they do not replace live Auth/Edge Function verification after deployment.

## Previous version and data

The original runnable Python/SQLite app and its Docker setup are preserved under `legacy/`. No SQLite data or existing Docker volumes have been deleted. This Supabase schema starts empty; existing SQLite records are not automatically imported. Employee accounts must be recreated in Supabase Auth; old password hashes cannot be copied into this login flow.

Supabase backend and Vercel frontend are now deployed. Production: https://bens-workroom.vercel.app. See DEPLOYMENT.md for deployment details and the pending first-manager account setup.
