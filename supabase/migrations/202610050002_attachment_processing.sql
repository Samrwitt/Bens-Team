-- Durable background queue. Extraction content is server-only; status follows assignment access.
create table public.attachment_processing (
  attachment_id bigint primary key references public.feedback_attachments(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','processing','ready','failed','unsupported')),
  attempts integer not null default 0 check (attempts between 0 and 3),
  available_at timestamptz not null default now(),
  lease_until timestamptz,
  lease_token uuid,
  content_hash text,
  extracted_text text,
  error text,
  updated_at timestamptz not null default now()
);
alter table public.attachment_processing enable row level security;
create policy processing_read on public.attachment_processing for select to authenticated
using (exists (select 1 from public.feedback_attachments a join public.feedback f on f.id=a.feedback_id
  where a.id=attachment_id and public.can_access_assignment(f.assignment_id)));
grant select(attachment_id,status,error,updated_at) on public.attachment_processing to authenticated;
grant all on public.attachment_processing to service_role;
create index attachment_queue on public.attachment_processing(available_at) where status in ('queued','processing');

create table public.attachment_content_cache (
  hash text primary key,
  extracted_text text not null check(length(extracted_text) between 1 and 100000),
  created_at timestamptz not null default now()
);
alter table public.attachment_content_cache enable row level security;
grant all on public.attachment_content_cache to service_role;

create function public.queue_attachment_processing() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.attachment_processing(attachment_id) values(new.id);
  return new;
end; $$;
revoke all on function public.queue_attachment_processing() from public,anon,authenticated;
create trigger queue_attachment after insert on public.feedback_attachments
for each row execute function public.queue_attachment_processing();
insert into public.attachment_processing(attachment_id) select id from public.feedback_attachments;

-- One active extraction globally keeps provider bursts bounded. Stale leases are recoverable.
create function public.claim_attachment_job() returns setof public.attachment_processing
language plpgsql security definer set search_path='' as $$
declare job_id bigint;
begin
  perform pg_advisory_xact_lock(8251905);
  if exists(select 1 from public.attachment_processing where status='processing' and lease_until>now()) then return; end if;
  update public.attachment_processing set status='failed',error='Processing could not finish. Please upload the file again.',lease_until=null
    where status='processing' and lease_until<=now() and attempts>=3;
  select attachment_id into job_id from public.attachment_processing
    where attempts<3 and ((status='queued' and available_at<=now()) or (status='processing' and lease_until<=now()))
    order by available_at,attachment_id for update skip locked limit 1;
  if job_id is null then return; end if;
  return query update public.attachment_processing set status='processing', attempts=attempts+1,
    lease_until=now()+interval '120 seconds',lease_token=gen_random_uuid(),updated_at=now()
    where attachment_id=job_id returning *;
end; $$;
revoke all on function public.claim_attachment_job() from public,anon,authenticated;
grant execute on function public.claim_attachment_job() to service_role;
