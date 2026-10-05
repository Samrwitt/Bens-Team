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

## Employee portal deployed (2026-10-05)

The employee portal is live at https://bens-workroom.vercel.app. Production deployment: `dpl_CkQgb7pvGnQP9gQUyip7KyMevXe4`.

- Applied `202609300001_feedback_authors.sql`.
- Verified the existing attachment bucket, table, policies, and `post_feedback` function match `202610030001_feedback_attachments.sql`; repaired its missing migration history entry.
- Deployed the `analyze-assignment` Edge Function and updated frontend.
- Verified the public homepage and bundle return HTTP 200, include the employee portal, and omit the old manager-only login rejection.
- All eight backend tests and five browser tests passed, including employee sign-in and manager permissions.

Gemini can be connected with the server-only `GEMINI_API_KEY` secret; its configuration was not checked during this deployment.

### Workspace interface update (2026-10-05)

- Image attachments display inline using private signed URLs; other attachments retain download buttons.
- The manager assignment list shows employee update counts and latest reply previews. Use Refresh updates to fetch new replies.
- Ask AI opens an assignment-specific popup and loads sources on demand.
- The feedback composer includes a ✨ Ask AI icon and a 📎 attachment button. Replies also use the attachment button; selected filenames display beside it.
- Managers can change status directly in the assignment list; employees retain read-only status displays.
- Production build and all eight browser tests passed. Public homepage and bundle verified to contain all four changes.

Feedback layout refinement: attachment and AI icons sit inside the feedback input area; reply attachment controls also sit inside their input area. The AI popup uses an × close icon and concise text. All eight browser tests passed and the production bundle was verified.

Image preview refinement: attachments display as 160 × 110 thumbnails. Clicking opens a viewport-sized image dialog with ×, Escape, and backdrop dismissal. All eight browser tests passed, including thumbnail sizing and opening/closing the viewer.
