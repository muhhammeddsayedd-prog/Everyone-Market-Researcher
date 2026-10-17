begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
-- Permit the anonymous role to call the test assertion functions only. The
-- application schema remains inaccessible, and this grant rolls back below.
grant usage on schema extensions to anon;
select plan(63);

insert into app.member_invites(email,role) values ('m01-viewer@example.test','viewer'), ('m01-other@example.test','viewer');
insert into auth.users(id,email) values
  ('20000000-0000-0000-0000-000000000001','m01-viewer@example.test'),
  ('20000000-0000-0000-0000-000000000002','m01-other@example.test'),
  ('20000000-0000-0000-0000-000000000003','m01-outsider@example.test');
insert into app.competitors(id,company_code,slug,name,priority_tier) values
  ('20000000-0000-0000-0000-000000000010','M01-RLS','m01-rls','RLS fixture','pilot');
insert into app.competitor_accounts(id,competitor_id,platform,handle,url) values
  ('20000000-0000-0000-0000-000000000012','20000000-0000-0000-0000-000000000010','instagram','m01-rls','https://example.test/account');
insert into app.organizations(id,kind,name,slug) values
  ('20000000-0000-0000-0000-000000000020','brand','RLS brand','m01-rls-brand');
insert into app.org_aliases(org_id,alias,alias_normalized) values
  ('20000000-0000-0000-0000-000000000020','RLS brand','rlsbrand');
insert into app.people(id,name,slug) values
  ('20000000-0000-0000-0000-000000000021','RLS person','m01-rls-person');
insert into app.person_aliases(person_id,alias,alias_normalized) values
  ('20000000-0000-0000-0000-000000000021','RLS person','rlsperson');
insert into app.items(id,competitor_id,platform,item_type,external_id,url,title) values
  ('20000000-0000-0000-0000-000000000011','20000000-0000-0000-0000-000000000010',
   'instagram','post','m01-rls-item','https://example.test/rls','RLS fixture');
insert into app.item_credits(item_id,person_id,person_name_raw,role) values
  ('20000000-0000-0000-0000-000000000011','20000000-0000-0000-0000-000000000021','RLS person','director');
insert into app.media_assets(item_id,kind,storage_path) values
  ('20000000-0000-0000-0000-000000000011','thumbnail','m01-rls/thumb.jpg');
insert into app.campaigns(id,title,first_seen_at,last_seen_at) values
  ('20000000-0000-0000-0000-000000000022','RLS campaign',now(),now());
insert into app.campaign_items(campaign_id,item_id) values
  ('20000000-0000-0000-0000-000000000022','20000000-0000-0000-0000-000000000011');
insert into app.website_pages(id,account_id,competitor_id,url) values
  ('20000000-0000-0000-0000-000000000023','20000000-0000-0000-0000-000000000012',
   '20000000-0000-0000-0000-000000000010','https://example.test/rls-work');
insert into app.employee_snapshots(competitor_id,snapshot_date,headcount_listed) values
  ('20000000-0000-0000-0000-000000000010',current_date,1);
insert into app.news_articles(id,url,kind,title) values
  ('20000000-0000-0000-0000-000000000024','https://example.test/rls-news','news','RLS news');
insert into app.news_mentions(article_id,entity_type,entity_id) values
  ('20000000-0000-0000-0000-000000000024','competitor','20000000-0000-0000-0000-000000000010');
insert into app.briefs(week_start,scope,title,body_md) values ('2000-01-03','ALL','RLS brief','Test only');
insert into app.review_tasks(kind,entity_type,entity_id) values
  ('item_low_confidence','item','20000000-0000-0000-0000-000000000011');
insert into app.alert_rules(name,kind,recipients) values ('RLS alert','daily_digest',array['m01-viewer@example.test']);
insert into app.embeddings(entity_type,entity_id,model,content_hash,embedding) values
  ('item','20000000-0000-0000-0000-000000000011','test','rls-fixture',array_fill(0.1::real,array[1536])::extensions.vector);
insert into app.stats_daily(day,competitor_id,platform) values
  (current_date,'20000000-0000-0000-0000-000000000010','instagram');
insert into app.member_invites(email) values ('m01-pending@example.test');
insert into app.allowed_domains(domain) values ('m01-rls.example.test');
insert into app.saved_views(user_id,name,path) values
  ('20000000-0000-0000-0000-000000000002','Other member view','/feed');

set local role authenticated;
set local request.jwt.claims = '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}';
select ok((select count(*) > 0 from app.competitors),'active member reads competitors');
select ok((select count(*) > 0 from app.items),'active member reads items');
select ok((select count(*) > 0 from app.feed_v),'active member reads invoker feed');
select results_eq(format('select count(*) > 0 from app.%I',t),array[true],
  format('active member reads app.%s',t)) from unnest(array[
    'competitor_accounts','organizations','org_aliases','people','person_aliases','item_credits','media_assets',
    'campaigns','campaign_items','website_pages','employee_snapshots','news_articles','news_mentions','briefs',
    'review_tasks','taxonomy_terms','alert_rules','embeddings','stats_daily','members']) t;
select throws_ok($$insert into app.items select * from app.items limit 1$$,'42501',null,'member cannot insert collected items');
select throws_ok($$update app.items set title = 'tampered'$$,'42501',null,'member cannot update collected items directly');
select throws_ok($$delete from app.items$$,'42501',null,'member cannot delete collected items');
select is((select count(*)::int from app.saved_views),0,'member cannot see another member saved view');
select lives_ok($$insert into app.saved_views(user_id,name,path) values
  ('20000000-0000-0000-0000-000000000001','My view','/feed')$$,'member can create own saved view');
select is((select count(*)::int from app.saved_views),1,'member sees own saved view');
select throws_ok($$update app.saved_views set user_id = '20000000-0000-0000-0000-000000000002'$$,
  '42501',null,'owner cannot transfer a saved view');
select throws_ok($$select * from ops.cost_ledger$$,'42501',null,'member cannot read ops');
select throws_ok($$select * from ingest.raw_items$$,'42501',null,'member cannot read raw payloads');

set local request.jwt.claims = '{"sub":"20000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*)::int from app.competitors),0,'non-member reads no competitors');
select is((select count(*)::int from app.items),0,'non-member reads no items');
select is((select count(*)::int from app.feed_v),0,'non-member reads no feed');
select results_eq(format('select count(*)::int from app.%I',t),array[0],
  format('non-member reads no app.%s rows',t)) from unnest(array[
    'competitor_accounts','organizations','org_aliases','people','person_aliases','item_credits','media_assets',
    'campaigns','campaign_items','website_pages','employee_snapshots','news_articles','news_mentions','briefs',
    'review_tasks','taxonomy_terms','alert_rules','embeddings','stats_daily','members','member_invites',
    'allowed_domains','saved_views']) t;
select throws_ok($$insert into app.saved_views(user_id,name,path) values
  ('20000000-0000-0000-0000-000000000003','Unauthorized','/feed')$$,'42501',null,'non-member cannot save a view');

reset role;
update app.members set status = 'disabled' where user_id = '20000000-0000-0000-0000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is((select count(*)::int from app.saved_views),0,'disabled member cannot read former saved views');
select results_eq($$update app.saved_views set name = 'tampered' returning id$$,
  array[]::bigint[],'disabled member cannot update former saved views');
set local role anon;
select throws_ok($$select * from app.competitors$$,'42501',null,'anon cannot access competitors');
select throws_ok($$select * from app.feed_v$$,'42501',null,'anon cannot access the feed');

select * from finish();
rollback;
