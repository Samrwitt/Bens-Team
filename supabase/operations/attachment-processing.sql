-- Production plumbing, installed after the worker and its Vault secret.
-- Kept separate from portable schema migrations: requires Supabase pg_net, pg_cron, Vault.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
create function public.dispatch_attachment_processing() returns void
language plpgsql security definer set search_path='' as $$
declare worker_secret text;
begin
  if not exists(select 1 from public.attachment_processing where
    (status='queued' and available_at<=now()) or (status='processing' and lease_until<=now())) then return; end if;
  select decrypted_secret into worker_secret from vault.decrypted_secrets where name='attachment_processing_secret';
  if worker_secret is null then return; end if;
  perform net.http_post(
    url := 'https://ubjqmdvjttkufcfeyfyw.supabase.co/functions/v1/process-attachments',
    headers := jsonb_build_object('Content-Type','application/json','x-processing-secret',worker_secret),
    body := '{}'::jsonb, timeout_milliseconds := 5000);
end; $$;
revoke all on function public.dispatch_attachment_processing() from public,anon,authenticated;
create function public.start_attachment_processing() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform public.dispatch_attachment_processing();
  return null;
end; $$;
revoke all on function public.start_attachment_processing() from public,anon,authenticated;
create trigger start_attachment_worker after insert on public.attachment_processing
for each statement execute function public.start_attachment_processing();
select cron.schedule('process-attachment-queue','* * * * *','select public.dispatch_attachment_processing()');
select public.dispatch_attachment_processing();
