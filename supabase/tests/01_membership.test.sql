begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(15);

insert into app.member_invites(email,role) values
  ('m01-admin@example.test','admin'), ('m01-analyst@example.test','analyst');
insert into auth.users(id,email,raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001','M01-ADMIN@example.test','{"full_name":"Test Admin"}'),
  ('10000000-0000-0000-0000-000000000002','m01-analyst@example.test','{}'),
  ('10000000-0000-0000-0000-000000000003','m01-uninvited@example.test','{"role":"admin","full_name":"Uninvited"}');

select is((select role::text from app.members where user_id = '10000000-0000-0000-0000-000000000001'),
  'admin', 'invite assigns admin role');
select is((select email from app.members where user_id = '10000000-0000-0000-0000-000000000001'),
  'm01-admin@example.test', 'membership normalizes invited email');
select is((select full_name from app.members where user_id = '10000000-0000-0000-0000-000000000001'),
  'Test Admin', 'user metadata supplies display name only');
select is((select role::text from app.members where user_id = '10000000-0000-0000-0000-000000000002'),
  'analyst', 'invite assigns analyst role');
select is((select count(*)::int from app.member_invites where email in ('m01-admin@example.test','m01-analyst@example.test')),
  0, 'successful sign-up consumes invites');
select is((select count(*)::int from app.members where user_id = '10000000-0000-0000-0000-000000000003'),
  0, 'uninvited user metadata cannot grant membership');

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(app.me()->>'role','admin','me reports the invited admin role');
select ok(private.is_member(),'admin is an active member');
select ok(private.has_role('analyst'),'admin meets the analyst minimum');
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}';
select ok(private.has_role('analyst'),'analyst meets the analyst minimum');
select ok(not private.has_role('admin'),'analyst cannot claim admin');
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}';
select ok(not private.is_member(),'uninvited sign-in remains unauthorized');
select is(app.me(),null::jsonb,'non-member has no membership response');
reset role;
update app.members set status = 'disabled' where user_id = '10000000-0000-0000-0000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';
select ok(not private.is_member(),'disabled member loses access immediately');
select ok(not private.has_role('admin'),'disabled admin loses admin authorization');

select * from finish();
rollback;
