# Deployment status

Grouped progress and compact mode selector (2026-10-09): deployed `analyze-assignment` with one attribution per author and frontend `dpl_97sSoFgG6PYgPV4yyuWUVvRSyRJb` with a compact Local/AI select beside the question label. Analysis suite, production build, and all 11 browser tests passed.

Local response refinement (2026-10-09): removed local suggested feedback drafts and replaced the generic progress explanation with concise attributed reports selected using conservative rules. Requests and future plans are excluded; negative reports remain intact. Analysis tests passed. Backend-only update deployed to `analyze-assignment`; existing chat responses require a new question.

Local progress overview deployed (2026-10-09): deployed `analyze-assignment` to Supabase project `ubjqmdvjttkufcfeyfyw` and frontend deployment `dpl_HjXUcoLGWFzLfk5cwVhuKWX2Hf54` to https://bens-workroom.vercel.app. Local progress questions now return recorded assignment status, owner, due date, recent attributed feedback, and an editable follow-up. Analysis tests passed; Vercel production build passed. Authenticated end-to-end progress verification remains pending.

Text size refined (2026-10-08): feedback/reply inputs and conversation messages reduced to 17px. Build passed. Vercel deployment: `dpl_GeCHxERm9NSdZWrfsRv582rFD9TV`.

Text size reduced (2026-10-08): feedback/reply inputs and conversation messages returned to 18px at the user's request. Build passed. Vercel deployment: `dpl_3machPtWJsC7czdyqs5egVj8Mfx9`.

Further text enlargement (2026-10-08): feedback/reply inputs and conversation message text increased to 20px. Build passed. Vercel deployment: `dpl_GmEjvB5oi3Xf9t4BV7fSNqFPjgy4`.

Feedback text enlargement (2026-10-08): feedback/reply input and conversation message text increased from 14px to 18px with 1.6 line spacing. Production build passed. Vercel deployment: `dpl_6tG1iLTBRCFSqhYDuicieFa5dZEy`.

## Text box and RAG mode deployment (2026-10-08)

Local OCR disabled at the user's request: local search excludes image/PDF extraction, including previously cached OCR text, and retains saved text/DOCX content from either extraction version. OCR source files remain in the repository. No OCR worker or reprocessing migration is deployed. Existing API-mode attachment processing is unchanged. The interface explicitly describes the local-search coverage.

- Deployed frontend `dpl_5uwbTZvFd7taPvi8oZjUWgfAghDv` to https://bens-workroom.vercel.app, including an accurate explanation of local attachment availability.
- Feedback and reply composer now starts at 160px, shows six rows, and supports vertical resizing.
- Deployed `analyze-assignment` with manager-selectable local vector search and API LLM. Local search computes lexical vectors on demand without an embedding or generation API request.
- Analysis and attachment suites pass under Node 24; database authorization tests and all 11 browser tests pass. Earlier attachment test failures were caused by unsupported Node 18.
- Verified production assets contain the larger composer and both mode options. Stored manager credentials were rejected, so authenticated live query verification remains pending.
- Local OCR is not configured in Supabase (`LOCAL_OCR_URL` and `LOCAL_OCR_SECRET` are absent). The updated local-only `process-attachments` function and reprocessing migration were not deployed because that would disable image/scanned-PDF extraction until an OCR host is configured. Local search excludes legacy provider-extracted attachment content. Existing production attachment processing remains active.
- Automatic approval review rejected a live API-mode check because production content could reach a third-party LLM. No live API generation check was performed.

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

The employee portal is live at https://bens-workroom.vercel.app. Production deployment: `dpl_C5esor4ZerzUqWdL2sD8YzyA8mCb`.

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

Background attachment extraction (2026-10-05): applied and recorded 202610050002_attachment_processing.sql; deployed process-attachments and analyze-assignment. Dedicated random worker credential stored server-side and in Vault. Installed pg_net/pg_cron upload dispatch and one-minute queue retry through supabase/operations/attachment-processing.sql. Existing attachments queued automatically.

Text, readable PDFs, and DOCX body content use local extraction. Image/scanned PDF recognition uses configured provider credentials; images prefer the verified available Groq qwen/qwen3.8-27b vision model, with Gemini fallback. Successful results are privately cached by versioned SHA-256. One active extraction globally, two jobs per invocation, two-minute leases, delayed retries, and three-attempt maximum bound background usage. Questions retrieve saved selected-assignment file content, with pending/failure coverage reported explicitly.

Verification: production build, 24 backend/database tests, and ten browser tests passed. Live synthetic text/PDF/DOCX uploads became ready without an AI question; temporary assignment/files/cache entries removed afterward. Existing image attachments have begun processing (two ready, one queued for a provider-busy retry at verification). Frontend bundle verified. fflate upgraded to patched 0.8.3; dependency audit reported zero vulnerabilities. Size/page/context limits and DOCX embedded-picture limitation documented in README.md.

Live previews: redeployed Vercel and captured 16 manager pages from production with existing records and a real AI answer. Previous sample images archived separately. Employee production captures pending valid credentials; both supplied passwords were rejected.

Employee live previews completed: corrected employee credentials worked. All 21 production captures are saved in previews with refreshed manager/employee/AI galleries. No forms were saved and no feedback was posted during capture. Earlier sample screenshots remain separately labeled in previews/sample-data.
