-- Private files remain linked to feedback for subsequent retrieval/analysis.
insert into storage.buckets(id, name, public, file_size_limit)
values ('feedback-files', 'feedback-files', false, 20971520);

create table public.feedback_attachments (
  id bigint generated always as identity primary key,
  feedback_id bigint not null references public.feedback(id) on delete cascade,
  name text not null check (length(name) between 1 and 255),
  path text not null unique,
  content_type text not null,
  size bigint not null check (size between 1 and 20971520)
);
alter table public.feedback_attachments enable row level security;
create policy attachments_read on public.feedback_attachments for select to authenticated
using (exists (select 1 from public.feedback f where f.id=feedback_id and public.can_access_assignment(f.assignment_id)));
grant select on public.feedback_attachments to authenticated;
grant all on public.feedback_attachments to service_role;

-- Paths: author UUID / assignment ID / unique object ID.
create policy feedback_files_insert on storage.objects for insert to authenticated
with check (bucket_id='feedback-files' and (storage.foldername(name))[1]=auth.uid()::text
  and (storage.foldername(name))[2] ~ '^[0-9]+$'
  and public.can_access_assignment(((storage.foldername(name))[2])::bigint));
create policy feedback_files_read on storage.objects for select to authenticated
using (bucket_id='feedback-files' and exists (
  select 1 from public.feedback_attachments a join public.feedback f on f.id=a.feedback_id
  where a.path=storage.objects.name and public.can_access_assignment(f.assignment_id)));
create policy feedback_files_cleanup on storage.objects for delete to authenticated
using (bucket_id='feedback-files' and (storage.foldername(name))[1]=auth.uid()::text
  and not exists (select 1 from public.feedback_attachments a where a.path=storage.objects.name));

create function public.post_feedback(target_assignment bigint, feedback_body text,
  reply_to bigint default null, files jsonb default '[]'::jsonb)
returns bigint language plpgsql security definer set search_path='' as $$
declare feedback_id bigint; item jsonb;
begin
  if auth.uid() is null or not public.can_access_assignment(target_assignment) then
    raise exception 'Assignment access required' using errcode='42501';
  end if;
  if jsonb_typeof(files) <> 'array' or jsonb_array_length(files)>10 then
    raise exception 'Attach up to 10 files';
  end if;
  insert into public.feedback(assignment_id,parent_id,author_id,body)
  values(target_assignment,reply_to,auth.uid(),feedback_body) returning id into feedback_id;
  for item in select * from jsonb_array_elements(files) loop
    if not exists (select 1 from storage.objects o where o.bucket_id='feedback-files'
      and o.name=item->>'path'
      and split_part(o.name,'/',1)=auth.uid()::text
      and split_part(o.name,'/',2)=target_assignment::text
      and (o.metadata->>'size')::bigint=(item->>'size')::bigint) then
      raise exception 'Uploaded file not found';
    end if;
    insert into public.feedback_attachments(feedback_id,name,path,content_type,size)
    values(feedback_id,item->>'name',item->>'path',item->>'content_type',(item->>'size')::bigint);
  end loop;
  return feedback_id;
end; $$;
revoke all on function public.post_feedback(bigint,text,bigint,jsonb) from public,anon;
grant execute on function public.post_feedback(bigint,text,bigint,jsonb) to authenticated;
