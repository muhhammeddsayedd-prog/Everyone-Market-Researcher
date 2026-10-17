-- Public reads; no anon/authenticated Storage write policies are created.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('media','media',true,5242880,array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict(id) do nothing;

select cron.schedule('emr-unlock-stale-accounts','15 * * * *',
  $$update app.competitor_accounts set locked_until = null where locked_until < now()$$);
select cron.schedule('emr-archive-queue-cleanup','30 3 * * *',
  $$delete from pgmq.a_ai_extract where archived_at < now() - interval '30 days';
    delete from pgmq.a_embed where archived_at < now() - interval '30 days';
    delete from pgmq.a_media where archived_at < now() - interval '30 days'$$);
