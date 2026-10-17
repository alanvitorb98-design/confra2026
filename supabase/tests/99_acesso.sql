-- What a phone can reach, checked over the whole database so a new table or function cannot slip through:
-- every table has row rules and phones only read; visitors (not signed up) reach only the listed functions;
-- every function that runs with the owner's rights has a fixed search_path; no views, public buckets or
-- table changes streamed to the realtime server.
begin;
do $$
declare r record; bad text := '';
begin
  for r in select c.oid, c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname not like 'test\_%' loop
    if not r.relrowsecurity then bad := bad || r.relname || ' sem RLS; '; end if;
    if has_table_privilege('anon', r.oid, 'select') then bad := bad || r.relname || ' visitante lê; '; end if;
    if has_table_privilege('anon', r.oid, 'insert,update,delete,truncate') then bad := bad || r.relname || ' visitante escreve; '; end if;
    if has_table_privilege('authenticated', r.oid, 'insert,update,delete,truncate') then bad := bad || r.relname || ' convidado escreve direto; '; end if;
  end loop;
  assert bad = '', bad;
end $$;

do $$
declare bad text;
begin
  select string_agg(p.proname, ', ') into bad from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
    and p.prorettype <> 'trigger'::regtype and p.proname not like 'test\_%'
    and p.proname not in ('drop_push', 'event_public', 'ping', 'push_alive', 'save_push');
  assert bad is null, 'visitante chama: ' || bad;

  select string_agg(p.proname, ', ') into bad from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef and not coalesce(array_to_string(p.proconfig, ',') like '%search_path=%', false);
  assert bad is null, 'search_path solto: ' || bad;

  select string_agg(p.proname, ', ') into bad from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
    and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
    and p.prosecdef;
  assert bad is null, 'trigger chamável pelo celular: ' || bad;

  assert not exists (select 1 from pg_views where schemaname = 'public'), 'view no schema público';
  assert not exists (select 1 from storage.buckets where public), 'bucket público';
  assert not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'),
    'tabela mandando mudanças pro realtime';
end $$;
rollback;
