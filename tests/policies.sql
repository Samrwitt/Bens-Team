\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values
 ('00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000003');
insert into public.employees(auth_user_id,name,email,role) values
 ('00000000-0000-0000-0000-000000000001','Manager','manager@test.local','manager'),
 ('00000000-0000-0000-0000-000000000002','Employee A','a@test.local','employee'),
 ('00000000-0000-0000-0000-000000000003','Employee B','b@test.local','employee');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select public.save_team('Design',array[2::bigint],null);
insert into public.assignments(title,description,employee_id,due) values ('Private A','Brief',2,'2026-10-01'),('Private B','Brief',3,'2026-10-01');
insert into public.assignments(title,description,team_id,due) values ('Team assignment','Brief',1,'2026-10-01');
insert into public.feedback(assignment_id,body) values (1,'Manager feedback');
do $$ begin
  if (select count(*) from public.assignments) <> 3 then raise exception 'Manager should see all assignments'; end if;
  begin
    perform public.save_team('Should rollback',array[999::bigint],1);
    raise exception 'Invalid team member was accepted';
  exception when raise_exception then
    if sqlerrm='Invalid team member was accepted' then raise; end if;
  end;
  if (select name from public.teams where id=1) <> 'Design' then raise exception 'Team transaction did not roll back'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
do $$ begin
 if (select count(*) from public.feedback_authors()) <> 1 then raise exception 'Accessible author names missing'; end if;
 if (select name from public.feedback_authors() limit 1) <> 'Manager' then raise exception 'Wrong author disclosed'; end if;
 if public.is_manager() then raise exception 'Employee became manager'; end if;
 if (select count(*) from public.assignments) <> 2 then raise exception 'Employee assignment isolation failed'; end if;
 if (select count(*) from public.employees) <> 1 then raise exception 'Employee profile isolation failed'; end if;
 begin
  update public.employees set role='manager' where id=2;
  raise exception 'Privilege escalation succeeded';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.assignments(title,description,employee_id,due) values('Unauthorized','Brief',2,'2026-10-01');
  raise exception 'Employee created assignment';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.feedback(assignment_id,body) values(2,'Unauthorized');
  raise exception 'Cross-assignment write succeeded';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.feedback(assignment_id,author_id,body) values(1,'00000000-0000-0000-0000-000000000001','Spoof');
  raise exception 'Author spoofing succeeded';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.feedback(assignment_id,parent_id,body) values(3,1,'Cross-assignment reply');
  raise exception 'Cross-assignment parent accepted';
 exception when foreign_key_violation then null; end;
 update public.assignments set status='Done' where id=1;
 if (select status from public.assignments where id=1) <> 'Open' then raise exception 'Employee changed status'; end if;
end $$;
insert into public.feedback(assignment_id,parent_id,body) values(1,1,'Allowed employee reply');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
do $$ begin
 if (select count(*) from public.assignments) <> 1 then raise exception 'Other employee isolation failed'; end if;
 if (select count(*) from public.feedback_authors()) <> 0 then raise exception 'Unrelated author names disclosed'; end if;
 if (select count(*) from public.feedback) <> 0 then raise exception 'Other employee can read private feedback'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select public.save_team('Design',array[]::bigint[],1);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
do $$ begin
 if (select count(*) from public.assignments) <> 1 then raise exception 'Removed team member retained access'; end if;
end $$;
set local role anon;
do $$ begin
 begin
  perform * from public.feedback_authors();
  raise exception 'Anonymous author lookup succeeded';
 exception when insufficient_privilege then null; end;
 begin
  perform * from public.assignments;
  raise exception 'Anonymous read succeeded';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
\echo All authorization and relational integrity checks passed.
