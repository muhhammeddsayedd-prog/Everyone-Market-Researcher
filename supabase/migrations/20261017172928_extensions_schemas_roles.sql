-- everyone. Market Radar — extensions, schemas, machine roles and stable enums.
-- Created with the Supabase CLI; adapted from reference/sql/001 (preserved).

-- ── Extensions ────────────────────────────────────────────────────────────────
create schema if not exists extensions;
create extension if not exists pgcrypto      with schema extensions;
create extension if not exists vector        with schema extensions;
create extension if not exists pg_trgm       with schema extensions;
create extension if not exists unaccent      with schema extensions;
create extension if not exists pgmq;                       -- Supabase Queues
create extension if not exists pg_cron with schema pg_catalog; -- housekeeping only

-- ── Schemas ──────────────────────────────────────────────────────────────────
create schema if not exists app;      -- clean data, exposed to the Data API (RLS)
create schema if not exists ingest;   -- raw payloads, NOT exposed
create schema if not exists ops;      -- runs, costs, keys, audit, NOT exposed
create schema if not exists api;      -- views + RPCs for agents, NOT exposed (reached via Next.js as api_agent)
create schema if not exists private;  -- helper SECURITY DEFINER functions, NOT exposed

-- ── Login roles for machines (passwords set by the owner, stored in n8n / Vercel) ──
-- Passwords are deliberately unset. The owner supplies them separately (MA-05).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'n8n_writer') then
    create role n8n_writer login noinherit nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'api_agent') then
    create role api_agent login noinherit nobypassrls;
  end if;
end $$;
alter role n8n_writer login noinherit nobypassrls;
alter role api_agent login noinherit nobypassrls;
alter role n8n_writer set statement_timeout = '120s';
alter role api_agent  set statement_timeout = '15s';
alter role n8n_writer set search_path = '';
alter role api_agent  set search_path = '';

revoke all on schema app, ingest, ops, api, private from public, anon, authenticated, n8n_writer, api_agent;
grant usage on schema app to authenticated, n8n_writer, api_agent;
grant usage on schema ingest, ops to n8n_writer;
grant usage on schema api to api_agent;
grant usage on schema extensions to authenticated, n8n_writer, api_agent;

-- Clear schema-specific default grants. Every function below and in later
-- migrations also revokes PUBLIC EXECUTE explicitly: a schema-level default
-- revocation cannot remove PostgreSQL's global PUBLIC function grant.
alter default privileges in schema app, ingest, ops, api, private
  revoke all on tables from public, anon, authenticated, n8n_writer, api_agent;
alter default privileges in schema app, ingest, ops, api, private
  revoke all on sequences from public, anon, authenticated, n8n_writer, api_agent;

-- ── Enums (stable sets only; editable lists live in app.taxonomy_terms) ──
create type app.member_role    as enum ('viewer', 'analyst', 'admin');
create type app.member_status  as enum ('invited', 'active', 'disabled');
create type app.platform       as enum ('vimeo', 'instagram', 'instagram_stories', 'website', 'website_work_page',
                                        'linkedin', 'linkedin_employees', 'youtube', 'news');
create type app.account_status as enum ('active', 'paused', 'failing', 'invalid', 'disabled');
create type app.backfill_status as enum ('pending', 'running', 'done', 'failed', 'not_applicable');
create type app.priority_tier  as enum ('baseline', 'pilot', 'next_wave', 'adjacent');
create type app.item_type      as enum ('video', 'post', 'reel', 'carousel', 'story', 'project_page',
                                        'linkedin_post', 'news_article', 'award_entry');
create type app.item_status    as enum ('active', 'removed');
create type app.ai_status      as enum ('pending', 'processing', 'published', 'review', 'skipped', 'failed', 'duplicate');
create type app.org_kind       as enum ('brand', 'agency', 'post_house', 'media', 'other');
create type app.entity_status  as enum ('confirmed', 'unconfirmed', 'merged');
create type app.review_kind    as enum ('item_low_confidence', 'new_brand', 'new_agency', 'new_person',
                                        'campaign_merge', 'entity_merge', 'account_suggestion');
create type app.review_status  as enum ('open', 'approved', 'corrected', 'rejected', 'snoozed');
create type app.country_code   as enum ('EG', 'KSA', 'UAE', 'OTHER');
