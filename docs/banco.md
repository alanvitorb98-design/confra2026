# Banco de dados no repositório

`supabase/schema.sql` é o retrato completo do banco de produção (tabelas, funções, regras de acesso,
gatilhos, permissões, bucket). Ele não tem dados, segredos nem os agendamentos (cron).

**Quando atualizar:** depois de aplicar qualquer migração no banco de produção. Rode
`scripts/dump-schema.sql` no SQL editor do Supabase (ou pela ferramenta MCP, trocando o último `select` por
`select string_agg(sql, E'\n\n' order by ord, name) from stmts;`) e salve o resultado em `supabase/schema.sql`.

**Testes do banco:** `supabase/tests/*.sql` rodam em ordem num Supabase local criado no CI a partir do
`schema.sql` (job `banco`). Cada arquivo abre uma transação, monta o caso, confere com `assert` e desfaz
tudo. `00_setup.sql` cria três convidados (Ana, Bia e Org, organizadora) e troca a chamada do servidor de
rostos por um registro, para os testes nunca saírem para a internet.

Para rodar na sua máquina (precisa de Docker): `supabase init`, `supabase start`, depois o `psql` dos passos
do job `banco` no workflow.
