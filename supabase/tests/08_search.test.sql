begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public,extensions;
select plan(35);
-- The test runner has ADMIN but not SET on newly created NOINHERIT roles.
-- These grants roll back with this test and do not alter deployed privileges.
grant api_agent to postgres with inherit false;
grant api_agent to postgres with set true;

insert into app.member_invites(email,role) values('m01-search@example.test','viewer');
insert into auth.users(id,email) values
('80000000-0000-0000-0000-000000000001','m01-search@example.test'),
('80000000-0000-0000-0000-000000000002','m01-outsider@example.test');
insert into app.competitors(id,company_code,slug,name,priority_tier)
values('80000000-0000-0000-0000-000000000003','SEARCH8','search8','Ramadan Studio','pilot');
insert into app.organizations(id,kind,name,slug)
values('80000000-0000-0000-0000-000000000004','brand','Ramadan Brand','ramadan-brand');
insert into app.people(id,name,slug,primary_role)
values('80000000-0000-0000-0000-000000000005','Ramadan Director','ramadan-director','director');
insert into app.campaigns(id,title,first_seen_at,last_seen_at)
values('80000000-0000-0000-0000-000000000006','Ramadan Campaign',now(),now());
insert into app.news_articles(id,url,kind,title)
values('80000000-0000-0000-0000-000000000007','https://example.test/news8','news','Ramadan News');

select ok((select search_tsv @@ to_tsquery('simple','ramadan') from app.items where external_id = 'fixture-1'),'item insert populates TSV');
select ok((select search_tsv @@ to_tsquery('simple','ramadan') from app.competitors where company_code = 'SEARCH8'),'competitor insert populates TSV');
select ok((select search_tsv @@ to_tsquery('simple','ramadan') from app.organizations where slug = 'ramadan-brand'),'organization insert populates TSV');
select ok((select search_tsv @@ to_tsquery('simple','ramadan') from app.people where slug = 'ramadan-director'),'person insert populates TSV');
select ok((select search_tsv @@ to_tsquery('simple','ramadan') from app.campaigns where id = '80000000-0000-0000-0000-000000000006'),'campaign insert populates TSV');
select ok((select search_tsv @@ to_tsquery('simple','ramadan') from app.news_articles where id = '80000000-0000-0000-0000-000000000007'),'news insert populates TSV');

insert into app.embeddings(entity_type,entity_id,model,content_hash,embedding)
select 'item',id,'local-test','fixture',('[1,' || repeat('0,',1534) || '0]')::extensions.vector
from app.items where external_id in ('fixture-1','fixture-2','fixture-3');
update app.items set status = 'removed' where external_id = 'fixture-3';

set local role authenticated;
set local request.jwt.claims = '{"sub":"80000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is((select count(*)::int from app.search('ramadan') where entity_id = '99900000-0000-0000-0000-000000000101'),1,'member finds seeded Ramadan item');
select is((select count(distinct entity_type)::int from app.search('ramadan')),6,'all six keyword source branches work');
select is((select count(*)::int from app.search('ramadan',p_types => array['person'])),1,'type filter restricts keyword results');
select is((select count(*)::int from app.search('ramadan',p_types => array['item'],p_filters => '{"country":"UAE"}')),0,'country excludes keyword item');
select is((select count(*)::int from app.search('ramadan',p_types => array['item'],p_filters => '{"platform":"vimeo"}')),0,'platform excludes keyword item');
select is((select count(*)::int from app.search('ramadan',p_types => array['item'],p_filters => '{"competitor_id":"80000000-0000-0000-0000-000000000003"}')),0,'competitor excludes keyword item');
select is((select count(*)::int from app.search('ramadan',p_types => array['item'],p_filters => '{"brand_id":"80000000-0000-0000-0000-000000000004"}')),0,'brand excludes keyword item');
select is((select count(*)::int from app.search('ramadan',p_types => array['item'],p_filters => '{"from":"2026-10-03T00:00:00Z"}')),0,'from is inclusive lower bound');
select is((select count(*)::int from app.search('ramadan',p_types => array['item'],p_filters => '{"to":"2026-10-02T12:00:00Z"}')),0,'to is exclusive upper bound');
select is((select count(*)::int from app.search('ramadan',p_types => array['item'],p_filters => '{"content_type":"story"}')),0,'content type excludes keyword item');
select is((select count(*)::int from app.search('ramadan',p_types => array['item'],p_filters => '{"occasion":"eid"}')),0,'occasion excludes keyword item');
select is((select count(*)::int from app.search('ramadan',p_types => array['item'],p_filters => '{"country":"EG","platform":"instagram","competitor_id":"99900000-0000-0000-0000-000000000001","brand_id":"99900000-0000-0000-0000-000000000021","from":"2026-10-02T12:00:00Z","to":"2026-10-03T00:00:00Z","content_type":"tvc_brand_film","occasion":"ramadan"}')),1,'all matching filters retain item');
select is((select count(*)::int from app.search('ramadan',p_limit => 1)),1,'limit honored');
select is((select count(*)::int from app.search('ramadan',p_limit => 0)),0,'zero limit returns no rows');
select is((select count(*)::int from app.search('')),0,'empty keyword without embedding returns no rows');
select is((select count(*)::int from app.search('',('[1,' || repeat('0,',1534) || '0]')::extensions.vector,array['item'])),2,'semantic-only branch excludes removed item');
select is((select count(*)::int from app.search('',('[1,' || repeat('0,',1534) || '0]')::extensions.vector,array['item'],'{"country":"UAE"}')),0,'semantic branch shares item filters');
select ok((select score > 1.0/61 from app.search('ramadan',('[1,' || repeat('0,',1534) || '0]')::extensions.vector,array['item']) where entity_id = '99900000-0000-0000-0000-000000000101'),'RRF fuses keyword and semantic ranks');
select is((select count(*)::int from app.similar('item','99900000-0000-0000-0000-000000000101')),1,'similar excludes source and removed targets');
set local request.jwt.claims = '{"sub":"80000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from app.search('ramadan')),0,'non-member keyword search sees nothing');
select is((select count(*)::int from app.search('',('[1,' || repeat('0,',1534) || '0]')::extensions.vector)),0,'non-member semantic search sees nothing');
select is((select count(*)::int from app.similar('item','99900000-0000-0000-0000-000000000101')),0,'non-member similar sees nothing');
reset role;
update app.people set name = 'Updated filmmaker' where slug = 'ramadan-director';
select ok((select search_tsv @@ to_tsquery('simple','updated') from app.people where slug = 'ramadan-director'),'TSV updates on change');
select ok(not has_function_privilege('anon','app.search(text,extensions.vector,text[],jsonb,integer)','execute'),'anon cannot execute search');
select ok(not has_function_privilege('anon','app.me()','execute'),'anon cannot execute me');
set local role api_agent;
select is((select count(*)::int from app.search('ramadan',p_types => array['news'])),1,'agent searches through RLS read grants');
reset role;
select is((select count(*)::int from app.taxonomy_terms),120,'all 120 baseline taxonomies seeded');
select is((select count(*)::int from ops.settings where key = any(array[
  'auto_publish_threshold','campaign_window_days','campaign_similarity_min',
  'alias_trgm_min','alias_embedding_min','daily_budget_usd','metrics_refresh_days',
  'removal_window_days','stories_twice_daily','ai_batch_size','vision_max_share',
  'stats_daily_enabled','ai_batch_mode'])),13,'all thirteen original settings retained after M03 adds verification metadata');
select is((select count(distinct (provider,sku))::int from ops.price_book where sku = any(array[
  'apify/instagram-scraper:result','data-slayer/instagram-stories-scraper:result',
  'igview-owner/instagram-story-viewer:result','louisdeconinck/instagram-story-details-scraper:profile',
  'goat255/vimeo-scraper:video','dltik/vimeo-scraper:video','apify/website-content-crawler:cu',
  'harvestapi/linkedin-company-posts:post','harvestapi/linkedin-company-employees:short_profile',
  'streamers/youtube-scraper:video','search','credit','extract_model:input',
  'extract_model:output','brief_model:input','brief_model:output','text-embedding-3-small'])),17,
  'all seventeen original price SKUs retained across dated M03 price revisions');
select * from finish();
rollback;
