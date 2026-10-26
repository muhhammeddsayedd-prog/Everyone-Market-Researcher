-- M04 first vertical: resolve only an account already claimed by a running
-- dev Vimeo collector. No scheduling, watermark, role or historical changes.
-- https://supabase.com/docs/guides/database/functions
-- https://www.postgresql.org/docs/current/explicit-locking.html
create function ops.set_account_external_id(p_account_id uuid,p_external_id text,
  p_uploads_playlist_id text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_run_id uuid;
  v_competitor_id uuid;
  v_run ops.scrape_runs%rowtype;
  v_account app.competitor_accounts%rowtype;
  v_owner_status text;
  v_now timestamptz;
begin
  if p_account_id is null
    or (p_external_id is not null and p_external_id !~ '^[A-Za-z0-9_-]{1,128}$')
    or (p_uploads_playlist_id is not null and p_uploads_playlist_id !~ '^[A-Za-z0-9_-]{1,128}$') then
    raise exception using errcode='22023',message='invalid account resolution parameters';
  end if;
  -- Discover IDs without locking, then follow the existing ingestion order:
  -- parent run, competitor, account. Recheck the discovered IDs under locks.
  select a.last_run_id,a.competitor_id into v_run_id,v_competitor_id
    from app.competitor_accounts a where a.id=p_account_id;
  if not found or v_run_id is null then
    raise exception using errcode='42501',message='dev Vimeo account claim required';
  end if;
  select r.* into v_run from ops.scrape_runs r where r.id=v_run_id for share;
  if not found or v_run.status<>'running' or v_run.env<>'dev' or v_run.platform is distinct from 'vimeo' then
    raise exception using errcode='42501',message='dev Vimeo account claim required';
  end if;
  select c.status into v_owner_status from app.competitors c where c.id=v_competitor_id for share;
  if not found or v_owner_status<>'active' then
    raise exception using errcode='42501',message='dev Vimeo account claim required';
  end if;
  select a.* into v_account from app.competitor_accounts a where a.id=p_account_id for update;
  v_now:=clock_timestamp();
  if not found or v_account.last_run_id is distinct from v_run_id
    or v_account.competitor_id is distinct from v_competitor_id
    or v_account.platform<>'vimeo' or v_account.status not in ('active','failing')
    or v_account.locked_until is null or v_account.locked_until<=v_now then
    raise exception using errcode='42501',message='dev Vimeo account claim required';
  end if;
  if p_external_id is null then
    -- A failed lookup must not erase saved identifiers or release its claim.
    -- Final collector outcome/failure accounting remains report_account_result.
    update app.competitor_accounts set resolve_status='failed',
      last_error='vimeo_external_id_unresolved',last_error_at=v_now,updated_at=v_now
      where id=p_account_id;
  else
    update app.competitor_accounts set external_id=p_external_id,
      uploads_playlist_id=p_uploads_playlist_id,resolve_status='resolved',
      last_error=case when last_error='vimeo_external_id_unresolved' then null else last_error end,
      updated_at=v_now where id=p_account_id;
  end if;
end;
$$;

revoke all on function ops.set_account_external_id(uuid,text,text) from public,anon,authenticated,api_agent;
grant execute on function ops.set_account_external_id(uuid,text,text) to n8n_writer;
