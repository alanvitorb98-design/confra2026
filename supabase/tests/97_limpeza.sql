-- What the Security and Performance Advisors check stays true: no table without a policy or primary key,
-- no foreign key without an index, no extension in public.
do $$ begin
  assert not exists (
    select 1 from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relrowsecurity
      and c.relname not like 'test\_%' and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
  ), 'tabela com RLS sem policy';
  assert not exists (
    select 1 from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname not like 'test\_%'
      and not exists (select 1 from pg_index i where i.indrelid = c.oid and i.indisprimary)
  ), 'tabela sem chave primária';
  assert not exists (
    select 1 from pg_constraint f where f.contype = 'f' and f.connamespace = 'public'::regnamespace
      and not exists (select 1 from pg_index i where i.indrelid = f.conrelid and (i.indkey::int2[])[0] = f.conkey[1])
  ), 'chave estrangeira sem índice';
  assert not exists (select 1 from pg_extension where extnamespace = 'public'::regnamespace), 'extensão no schema public';
end $$;
