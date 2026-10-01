-- Employees can see the names of authors in feedback they are allowed to read.
-- Do not expose other profile fields (especially emails) or unrelated employees.
create function public.feedback_authors()
returns table(auth_user_id uuid, name text)
language sql stable security definer set search_path = '' as $$
  select e.auth_user_id, e.name
  from public.employees e
  where exists (
    select 1 from public.feedback f
    where f.author_id = e.auth_user_id
      and public.can_access_assignment(f.assignment_id)
  );
$$;
revoke all on function public.feedback_authors() from public, anon;
grant execute on function public.feedback_authors() to authenticated;
