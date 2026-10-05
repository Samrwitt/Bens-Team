-- Read state is private to each manager and persists across devices.
create table public.feedback_reads (
  manager_id uuid not null references auth.users(id) on delete cascade,
  feedback_id bigint not null references public.feedback(id) on delete cascade,
  primary key (manager_id, feedback_id)
);
alter table public.feedback_reads enable row level security;
create policy feedback_reads_select on public.feedback_reads for select to authenticated
using (manager_id = auth.uid() and public.is_manager());
create policy feedback_reads_insert on public.feedback_reads for insert to authenticated
with check (manager_id = auth.uid() and public.is_manager()
  and exists (select 1 from public.feedback f where f.id = feedback_id
    and public.can_access_assignment(f.assignment_id)));
grant select, insert on public.feedback_reads to authenticated;
grant all on public.feedback_reads to service_role;
