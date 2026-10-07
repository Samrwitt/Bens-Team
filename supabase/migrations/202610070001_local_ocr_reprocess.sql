-- Re-extract legacy provider-generated content with the local-only pipeline.
-- Apply with the updated process-attachments function and configured OCR worker.
update public.attachment_processing
set status='queued', attempts=0, available_at=now(), lease_until=null,
    lease_token=null, content_hash=null, extracted_text=null, error=null, updated_at=now()
where content_hash is null or content_hash not like 'v2-local:%';
