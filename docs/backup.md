# Backup

`.github/workflows/backup.yml` roda toda noite (03:30 em Brasília) e quando você manda (Actions › Backup ›
Run workflow).

**Banco:** copia papéis, estrutura e dados com o Supabase CLI, restaura a cópia num Supabase local e confere
as linhas de convidados, fotos, rostos, missões, convites e logins. Só depois criptografa (AES-256) e guarda
como artefato do workflow por 30 dias. Se a restauração falhar, o job fica vermelho: a cópia daquela noite
não presta.

**Fotos:** copia os originais do bucket R2 do evento para um segundo bucket. É cópia que só soma: apagar
uma foto no app não apaga da cópia.

## Ligar

1. Supabase › Connect › Session pooler: copie a URL com a senha do banco.
2. Gere uma frase longa e aleatória e guarde num lugar fora do GitHub (gerenciador de senhas). Sem ela
   ninguém abre a cópia, nem você.
3. GitHub › Settings › Secrets and variables › Actions › New repository secret: `BACKUP_DB_URL` e
   `BACKUP_PASSPHRASE`.
4. Fotos (opcional): crie o bucket da cópia no R2 (nome no topo do workflow, `COPY`) e um token R2 com
   leitura no bucket das fotos e escrita no da cópia. Secrets `R2_BACKUP_ACCOUNT_ID`, `R2_BACKUP_KEY_ID`,
   `R2_BACKUP_SECRET`.

Sem os secrets o workflow avisa e termina verde.

## Restaurar

1. Baixe o artefato `banco-…` da execução do Actions e abra:
   `gpg -d banco-AAAAMMDD-HHMM.tgz.gpg > copia.tgz && mkdir copia && tar -xzf copia.tgz -C copia`
2. Num projeto Supabase novo (ou no mesmo, vazio):
   ```
   psql "URL_DO_BANCO" --single-transaction -v ON_ERROR_STOP=1 \
     -f copia/roles.sql -f copia/schema.sql -c 'SET session_replication_role = replica' -f copia/data.sql
   ```
3. Os agendamentos (cron), os secrets das funções e as funções em si não vão na cópia: publique
   `supabase/functions/*` e recrie os crons como em `docs/banco.md`.
