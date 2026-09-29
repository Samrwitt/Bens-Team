-- Single-workspace manager app. Auth identities are separate from stable numeric employee IDs.
create table public.employees (
  id bigint generated always as identity primary key,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200),
  email text not null unique,
  role text not null default 'employee' check (role in ('manager','employee'))
);
create table public.teams (
  id bigint generated always as identity primary key,
  name text not null unique check (length(trim(name)) between 1 and 200)
);
create table public.members (
  team_id bigint references public.teams(id) on delete cascade,
  employee_id bigint references public.employees(id) on delete cascade,
  primary key(team_id,employee_id)
);
create table public.assignments (
  id bigint generated always as identity primary key,
  title text not null check (length(trim(title)) between 1 and 500),
  description text not null check (length(trim(description)) between 1 and 10000),
  employee_id bigint references public.employees(id),
  team_id bigint references public.teams(id),
  due date not null,
  status text not null default 'Open' check (status in ('Open','In progress','Done')),
  check ((employee_id is not null) <> (team_id is not null))
);
create table public.feedback (
  id bigint generated always as identity primary key,
  assignment_id bigint not null references public.assignments(id) on delete cascade,
  parent_id bigint,
  author_id uuid not null default auth.uid() references auth.users(id),
  body text not null check (length(trim(body)) between 1 and 10000),
  created timestamptz not null default now(),
  unique(id,assignment_id),
  foreign key(parent_id,assignment_id) references public.feedback(id,assignment_id),
  check (parent_id is null or parent_id < id)
);
create index members_employee on public.members(employee_id);
create index assignments_employee on public.assignments(employee_id);
create index assignments_team on public.assignments(team_id);
create index feedback_assignment on public.feedback(assignment_id);

create function public.is_manager() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.employees where auth_user_id = auth.uid() and role='manager');
$$;
create function public.my_employee_id() returns bigint
language sql stable security definer set search_path = '' as $$
  select id from public.employees where auth_user_id=auth.uid();
$$;
create function public.in_team(target bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.members where team_id=target and employee_id=public.my_employee_id());
$$;
create function public.can_access_assignment(target bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.assignments a where a.id=target and
    (public.is_manager() or a.employee_id=public.my_employee_id() or public.in_team(a.team_id)));
$$;

alter table public.employees enable row level security;
alter table public.teams enable row level security;
alter table public.members enable row level security;
alter table public.assignments enable row level security;
alter table public.feedback enable row level security;

-- Profiles are written only by trusted administration, never by browser clients.
create policy employee_read on public.employees for select to authenticated
using (public.is_manager() or auth_user_id=auth.uid());
create policy teams_read on public.teams for select to authenticated
using (public.is_manager() or public.in_team(id));
create policy teams_manage on public.teams for all to authenticated
using (public.is_manager()) with check(public.is_manager());
create policy members_read on public.members for select to authenticated
using (public.is_manager() or employee_id=public.my_employee_id());
create policy members_manage on public.members for all to authenticated
using (public.is_manager()) with check(public.is_manager());
create policy assignment_read on public.assignments for select to authenticated
using (public.can_access_assignment(id));
create policy assignment_manage on public.assignments for all to authenticated
using (public.is_manager()) with check(public.is_manager());
create policy feedback_read on public.feedback for select to authenticated
using (public.can_access_assignment(assignment_id));
create policy feedback_write on public.feedback for insert to authenticated
with check (author_id=auth.uid() and public.can_access_assignment(assignment_id));

-- Team edits and membership replacement must succeed or fail together.
create function public.save_team(team_name text, member_ids bigint[], target_id bigint default null)
returns bigint language plpgsql security invoker set search_path='' as $$
declare result_id bigint;
begin
  if not public.is_manager() then raise exception 'Manager access required' using errcode='42501'; end if;
  if exists(select 1 from unnest(member_ids) m where not exists(select 1 from public.employees e where e.id=m and e.role='employee')) then
    raise exception 'Select employees only';
  end if;
  if target_id is null then
    insert into public.teams(name) values(trim(team_name)) returning id into result_id;
  else
    update public.teams set name=trim(team_name) where id=target_id returning id into result_id;
    if result_id is null then raise exception 'Team not found'; end if;
    delete from public.members where team_id=result_id;
  end if;
  insert into public.members(team_id,employee_id) select result_id, m from (select distinct unnest(member_ids) m) ids;
  return result_id;
end; $$;

revoke all on public.employees, public.teams, public.members, public.assignments, public.feedback from anon, authenticated;
grant select on public.employees to authenticated;
grant select,insert,update,delete on public.teams,public.members to authenticated;
grant select,insert,update on public.assignments to authenticated;
grant select,insert on public.feedback to authenticated;
grant usage,select on all sequences in schema public to authenticated;
revoke all on function public.is_manager(),public.my_employee_id(),public.in_team(bigint),public.can_access_assignment(bigint),public.save_team(text,bigint[],bigint) from public,anon;
grant execute on function public.is_manager(),public.my_employee_id(),public.in_team(bigint),public.can_access_assignment(bigint),public.save_team(text,bigint[],bigint) to authenticated;
grant all on public.employees, public.teams, public.members, public.assignments, public.feedback to service_role;
grant usage,select on all sequences in schema public to service_role;
