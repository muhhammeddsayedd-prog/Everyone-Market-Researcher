-- Deterministic local/CI fixtures only. Hosted db push never runs this file.
insert into app.competitors(id,company_code,slug,name,priority_tier,hq_country)
values('99900000-0000-0000-0000-000000000001','C999','test-house','Test House','pilot','EG');
insert into app.competitor_accounts(id,competitor_id,platform,handle,url,backfill_status)
values
('99900000-0000-0000-0000-000000000011','99900000-0000-0000-0000-000000000001','instagram','testhouse','https://www.instagram.com/testhouse/','done'),
('99900000-0000-0000-0000-000000000012','99900000-0000-0000-0000-000000000001','vimeo','testhouse','https://vimeo.com/testhouse','done'),
('99900000-0000-0000-0000-000000000013','99900000-0000-0000-0000-000000000001','website_work_page','https://example.com/work','https://example.com/work','done');
insert into app.organizations(id,kind,name,slug,industry,country,status)
values('99900000-0000-0000-0000-000000000021','brand','Test Telecom','test-telecom','telecom','EG','confirmed');
insert into app.org_aliases(org_id,alias,alias_normalized,source)
values('99900000-0000-0000-0000-000000000021','Test Telecom','test telecom','human');
insert into app.items(id,competitor_id,account_id,platform,item_type,external_id,url,published_at,
  title,caption_original,brand_id,country,content_type,occasion,ai_status)
select ('99900000-0000-0000-0000-' || lpad((100+n)::text,12,'0'))::uuid,
  '99900000-0000-0000-0000-000000000001'::uuid,'99900000-0000-0000-0000-000000000011'::uuid,
  'instagram'::app.platform,'video'::app.item_type,'fixture-' || n,'https://example.com/items/' || n,
  '2026-10-01T12:00:00Z'::timestamptz + n * interval '1 day',
  case when n = 1 then 'Ramadan telecom film' else 'Local fixture film ' || n end,
  'Local test content ' || n,'99900000-0000-0000-0000-000000000021'::uuid,
  'EG'::app.country_code,'tvc_brand_film','ramadan','published'::app.ai_status
from generate_series(1,10) n;
