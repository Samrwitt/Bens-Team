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

The employee portal is live at https://bens-workroom.vercel.app. Production deployment: `dpl_jy4i2B3rXS6EaFHVPxXw1PTBrCJT`.

- Applied `202609300001_feedback_authors.sql`.
- Verified the existing attachment bucket, table, policies, and `post_feedback` function match `202610030001_feedback_attachments.sql`; repaired its missing migration history entry.
- Deployed the `analyze-assignment` Edge Function and updated frontend.
- Verified the public homepage and bundle return HTTP 200, include the employee portal, and omit the old manager-only login rejection.
- All eight backend tests and five browser tests passed, including employee sign-in and manager permissions.

Gemini is configured with server-only `GEMINI_API_KEY` and `GEMINI_MODEL` secrets. The selected model is `gemini-3.8-flash`. Two minimal generation checks on 2026-10-05 returned HTTP 503 UNAVAILABLE (temporary high demand); generation was not verified successfully.

### Workspace interface update (2026-10-05)

- Image attachments display inline using private signed URLs; other attachments retain download buttons.
- The manager assignment list shows employee update counts and latest reply previews. Use Refresh updates to fetch new replies.
- Ask AI opens an assignment-specific popup and loads sources on demand.
- The feedback composer includes a ✨ Ask AI icon and a 📎 attachment button. Replies also use the attachment button; selected filenames display beside it.
- Managers can change status directly in the assignment list; employees retain read-only status displays.
- Production build and all eight browser tests passed. Public homepage and bundle verified to contain all four changes.

Feedback layout refinement: attachment and AI icons sit inside the feedback input area; reply attachment controls also sit inside their input area. The AI popup uses an × close icon and concise text. All eight browser tests passed and the production bundle was verified.

Image preview refinement: attachments display as 160 × 110 thumbnails. Clicking opens a viewport-sized image dialog with ×, Escape, and backdrop dismissal. All eight browser tests passed, including thumbnail sizing and opening/closing the viewer.

Reply interface refinement: the AI icon is outside the text input beside Post feedback. Per-message Reply buttons are replaced by one message selector in the composer footer. Selecting a message posts a reply in that thread; New message posts top-level feedback. All eight browser tests passed.

Chat redesign: chronological message bubbles replace nested text blocks. Clicking or keyboard-activating a message reveals Reply; the composer shows a quoted reply preview and cancellation preserves the draft. The reply selector and AI Sources dropdown are removed. Build and all eight browser tests passed; production bundle verified.

Alignment adjustment: all chat bubbles align on the left, including the signed-in user’s messages. Build passed and the production stylesheet was verified.

Typography adjustment: message bodies, author names, and reply preview labels use regular font weight. Build passed and production stylesheet verified.

AI placement adjustment: the AI icon sits at the top right of the conversation panel beside its heading. Build and all eight browser tests passed; production bundle verified.

Unread count update: applied 202610050001_feedback_reads.sql. Manager assignment rows show only the unread employee message count. Opening an assignment saves the displayed employee messages as read per manager; new messages remain unread. Read state persists across refreshes and devices. Eight backend and eight browser tests passed, including read-state authorization and count clearing/reappearance.

Assignment table simplification: removed the header row and Messages column. Unread counts display beside assignment titles only when greater than zero. Build and all eight browser tests passed; production bundle verified.

Clickable assignment rows: removed the arrow column. Clicking row content or pressing Enter/Space on a focused row opens its assignment. Status controls remain independent. Restored manager toolbar controls. Build and eight browser tests passed; production bundle verified.

Composer refinement: a compact 56px text area with attachment and Post feedback buttons together on the right inside the input area. The top-right AI sparkle uses a gray SVG icon instead of a colored emoji. Build and all eight browser tests passed; production assets verified.

Gemini setup (2026-10-05): renamed the local MODEL setting to GEMINI_MODEL and saved only the two Gemini settings as Supabase backend secrets. No frontend secret or website redeploy was needed.

Gemini/Groq fallback (2026-10-05): configured GROQ_API_KEY and GROQ_MODEL=openai/gpt-oss-120b as server-only secrets. Google rejected gemini-2.5-flash as unavailable for new users; updated GEMINI_MODEL to its recommended gemini-3.8-flash. The backend alternates the first provider per worker and tries the other after provider errors, timeouts, or unusable answers. Each attempt times out after 20 seconds; each provider is attempted at most once per question. Both providers receive the same server-retrieved assignment sources and use shared answer validation. Groq produced a live synthetic-assignment answer with a valid source citation; Gemini returned temporary high demand. All 12 backend tests passed.

AI chat update: deployed chat-style questions and answers with Send/Enter and Shift+Enter for newlines. Conversation stays available when reopening the assignment popup during the current page session and clears on logout/reload. Follow-ups include up to four recent completed turns; history is validated and current assignment evidence is fetched anew on every request. Both providers use concise answer instructions that distinguish confirmed progress from unknown scope. Fourteen backend tests and eight browser tests passed; frontend bundle and Edge Function deployment verified.

AI answer cleanup: removed visible internal source codes from generated answers, including [A1], (F6), and grouped references. Providers are instructed to attribute updates naturally; source validation remains active before display cleanup. All 15 backend tests passed and the updated Edge Function was deployed.

AI input and suggested feedback: popup input renders immediately without a preliminary server request. Structured AI responses can include an editable question that the manager explicitly sends through authenticated post_feedback. Sent suggestions cannot be posted twice from the same chat, and closing the popup refreshes the assignment conversation. Build, 16 backend tests, and nine browser tests passed. Backend and frontend deployed; production controls verified.

Chat layout refinement: feedback composer is a single-line input with its controls alongside. Empty AI chat has no reserved blank space; pending replies show Thinking. Sent suggestions show a checkmark and explicit posted-to-feedback confirmation. Build and nine browser tests passed; production deployment verified.

AI suggestion controls: send-to-feedback text replaced with an accessible send-arrow icon, changing to a checkmark after posting. Removed the inner chat scroll area; suggested question fields grow to fit their text. Build and nine browser tests passed; production bundle verified.

Inset AI send control and message count contrast: suggested question send arrow sits inside its input border. Feedback heading totals and manager unread badges use darker colors; manager unread clearing remains intact. Build and nine browser tests passed; production bundle verified.

Employee message count: assignment rows now display total visible feedback messages for employees when nonzero, using the same dark badge. Manager unread counts retain their existing read-clearing behavior. Build and nine browser tests passed; production verified.
