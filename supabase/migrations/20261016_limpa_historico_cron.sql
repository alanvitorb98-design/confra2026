-- The live nudge runs every 3 seconds, so pg_cron's run history grows ~29k rows a day: keep only the last day.
select cron.schedule('limpa-historico-cron', '17 * * * *', $$delete from cron.job_run_details where end_time < now() - interval '1 day'$$);
