-- Minimal Supabase Auth stand-in for isolated PostgreSQL policy tests only.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;

-- Minimal private Storage stand-in; real uploads are handled by Supabase Storage.
create schema storage;
create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint);
create table storage.objects(id bigint generated always as identity primary key, bucket_id text references storage.buckets(id), name text, metadata jsonb);
create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select,insert,delete on storage.objects to authenticated;
grant usage,select on all sequences in schema storage to authenticated;
