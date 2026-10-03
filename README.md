# Workroom — manager and employee workspace

The active app is a static Vite frontend backed by Supabase Auth, PostgreSQL, and two Edge Functions. No Python server or Docker service is needed in production.

Implemented: manager and employee sign-in, employee account creation and password resets, teams, assignments, statuses, feedback and nested replies, and manager-only assignment AI analysis.

**Section 2:** See [SECTION2.md](SECTION2.md) for the employee portal, assignment analysis, deployment steps, and how to connect Gemini later. Without a Gemini key, the analysis panel shows assignment sources without generating answers.

## Start here: edit the code

The editable application code is directly in this project folder.

| File or folder | What to edit |
| --- | --- |
| [static/js/pages/login.js](static/js/pages/login.js) | Sign-in page content |
| [static/js/pages/assignments.js](static/js/pages/assignments.js) | Assignment list, search, filters, and statistics |
| [static/js/pages/assignment-detail.js](static/js/pages/assignment-detail.js) | Assignment brief, status, feedback, and replies |
| [static/js/pages/employees.js](static/js/pages/employees.js) | Employee list |
| [static/js/pages/teams.js](static/js/pages/teams.js) | Team cards and members |
| [static/js/forms/](static/js/forms/) | Add/edit dialogs, grouped by feature |
| [static/js/components/](static/js/components/) | Shared navigation, headings, dialog, fields, and notifications |
| [static/js/components/assignment-analysis.js](static/js/components/assignment-analysis.js) | Assignment AI question, answer, and sources |
| [supabase/functions/analyze-assignment/](supabase/functions/analyze-assignment/) | Authenticated assignment retrieval and Gemini request |
| [static/css/](static/css/) | Base styles, layout, components, forms, and responsive rules |
| [static/js/services/backend.js](static/js/services/backend.js) | Supabase calls |
| [static/app.js](static/app.js) | App startup, routing, and action wiring |
| [static/index.html](static/index.html) | HTML shell that loads the app |
| [supabase/functions/manage-employee/index.ts](supabase/functions/manage-employee/index.ts) | Employee management backend |
| [supabase/migrations/](supabase/migrations/) | Database schema and access policies |
| [tests/](tests/) | Automated checks |

**Where is the page HTML?** Open the matching file in `static/js/pages/`. Its multiline `/* HTML */` templates contain the headings, text, tables, and buttons for that screen. `${...}` inserts dynamic values. Dialog contents live in `static/js/forms/`. Keep `escapeHtml(...)` around user-entered text when editing templates.

`static/style.css` loads the stylesheets in order. Start with `static/css/base.css` for global defaults, `layout.css` for navigation and headings, `components.css` for tables/cards/details, `forms.css` for forms/dialogs/login, `responsive.css` for smaller screens, and `analysis.css` for the AI panel.

The page factories receive shared state and actions from `static/app.js`; they do not fetch their own copies of workspace data. Existing HTML event attributes call the actions registered there. Shared formatting helpers live in `static/js/utils/format.js`.

To run locally, follow section 3 below. Changes do not automatically update the live website.

`Workroom-Clean.zip` is a shareable snapshot of the active source, tests, configuration, and setup instructions. Extract it to edit the files. It excludes private environment files and installed dependencies. Recreate the ZIP after further edits before sharing it again.

## 1. Create the Supabase backend

Create a Supabase project. For a new project, run the SQL files in `supabase/migrations/` in filename order, once each, in its SQL Editor. They create the tables, row-level access policies, and restricted feedback-author lookup. For the existing project, follow the upgrade instructions in [SECTION2.md](SECTION2.md).

Alternatively, with the Supabase CLI installed:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy manage-employee
supabase functions deploy analyze-assignment
```

If you used SQL Editor for the schema, skip `db push` and deploy the functions. The Edge Functions need Supabase's built-in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables. Each function explicitly verifies the user's JWT through Auth and checks their database role before running an administrative action. `verify_jwt=false` in its config supports publishable keys; it does not bypass these in-function authorization checks.

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

Open the address Vite prints and sign in with a manager or employee email and password. Missing configuration shows a setup screen; there is no fallback to demo data.

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

- Employees can see feedback-author names only for assignments they can access. Other profile fields remain private.
- AI source retrieval and generation require a verified manager session. Gemini credentials remain on the server.

Feedback and replies support up to 10 private file attachments (20 MB each), including images, PDFs, and code. Apply `supabase/migrations/202610030001_feedback_attachments.sql` before using this version. Downloads require assignment access.

RAG is planned as the final section: combine the manager assignment, all feedback/replies, and uploaded file contents for an API LLM or local vector analysis. File extraction and retrieval are not implemented yet; current assignment AI uses only the brief and text feedback.

## Validation

```sh
npm run build
npm test  # requires Docker; creates and removes a disposable PostgreSQL container
npm run test:ui  # requires Chrome; set CHROME_PATH if installed elsewhere
```

`tests/policies.sql` exercises real PostgreSQL access policies: manager access, employee isolation, anonymous denial, role escalation denial, author spoofing denial, team removal, and cross-assignment reply rejection. Run it only in a disposable database. `tests/bootstrap.sql` provides a minimal Auth stand-in for plain PostgreSQL; do not run that bootstrap in a real Supabase project.

Validation includes production builds, PostgreSQL policy tests, AI-handler tests without a real key, Edge Function checks, and Chrome workflows. See SECTION2.md for limits of local validation.

Browser tests use mocked Supabase HTTP responses to check UI wiring; they do not replace live Auth/Edge Function verification after deployment.

Existing production site: https://bens-workroom.vercel.app. Section 2 changes are prepared locally; see [SECTION2.md](SECTION2.md) before deploying. See DEPLOYMENT.md for the existing project details.
