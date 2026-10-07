# Local OCR worker

Tesseract reads image text. Poppler reads PDF text and renders scanned pages for Tesseract. This service does not contact an LLM or any external API. PDF.js remains the first extractor in the Supabase function; only images and PDFs containing scanned pages reach this worker.

Supabase Edge Functions cannot run these native executables, so host this worker on your own server behind an HTTPS reverse proxy. Use the same random `LOCAL_OCR_SECRET` in the worker environment and Supabase Edge Function secrets. Set `LOCAL_OCR_URL` to `https://YOUR_OCR_HOST/extract` in Supabase. Never put the secret in frontend variables. Without this worker configured, OCR jobs retry and then show a failure; they never fall back to Gemini/Groq.

Build and run (set `LOCAL_OCR_SECRET` in your shell first):

```sh
docker build -t workroom-ocr services/local-ocr
docker run --rm --read-only --tmpfs /tmp:size=256m --memory=512m --cpus=1 \
  --cap-drop=ALL --security-opt=no-new-privileges \
  -p 127.0.0.1:8090:8090 -e LOCAL_OCR_SECRET workroom-ocr
```

Or install `tesseract-ocr`, `tesseract-ocr-eng`, and `poppler-utils`, then run `python3 services/local-ocr/server.py`.

Default language is English. Set `OCR_LANGUAGE` and install the matching Tesseract language packs for other languages. Limits: 8 MB, 50 PDF pages, 100,000 text characters, one active job, and 80 seconds of extraction time. Unreadable pages are labeled explicitly. OCR extracts text, not visual descriptions; a chart or screenshot may need human review. PDFs with selectable text use that text; pages with no text use OCR. Pages containing both selectable text and embedded image text retain the selectable text only.

Deploy the updated `process-attachments` function after configuring the service. Apply `202610070001_local_ocr_reprocess.sql` to queue old files again so prior LLM-generated recognition text is replaced. Do not deploy only the migration with the old function. Redeploy the frontend to update its explanation. API LLM mode uses this same locally extracted text; only the manager's explicit API question triggers LLM generation.
