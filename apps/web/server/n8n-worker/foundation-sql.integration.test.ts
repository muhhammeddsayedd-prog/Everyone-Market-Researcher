// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { foundationReceipt, foundationRequest, foundationWindowId } from '@emr/shared';

// Explicit local opt-in only. All connection fields override environment
// defaults, including the public local-fixture password. This is SQL contract
// simulation, never a restricted hosted-login or native n8n receipt.
describe.skipIf(process.env.EMR_M03_LOCAL_SQL_TEST !== 'true')(
  'actual local SQL / application contract boundary',
  () => {
    it('validates real fixed results, status, replay, conflicts and closure within a rollback-only fixture', async () => {
      const c = new Client({
        host: '127.0.0.1',
        port: 60322,
        user: 'supabase_admin',
        password: 'postgres',
        database: 'postgres',
        ssl: false,
        connectionTimeoutMillis: 3000,
        application_name: 'emr-m03-local-contracts',
      });
      c.on('error', () => {});
      await c.connect();
      try {
        await c.query('begin');
        await c.query("set local statement_timeout='10s'; set local lock_timeout='3s'");
        await c.query('select pg_advisory_xact_lock(817405,0)');
        const pristine = await c.query('select count(*)::int as n from ops.foundation_gateway_rate_windows');
        if (pristine.rows[0]?.n !== 0) throw Error('local_contract_fixture_conflict');
        await c.query('select ops.foundation_gateway_provision($1::jsonb)', [
          JSON.stringify({
            audience: 'https://everyone-market-researcher-contract.vercel.app',
            commitSha: 'a'.repeat(40),
            deploymentId: 'dpl_contract',
            actorBuild: '0.3.99',
            approvalReference: 'local-contract-only',
            maxTotalChargeUsd: 1,
            batchMaxUsd: 2,
          }),
        ]);
        await c.query('set session authorization n8n_writer');
        async function operation(op: string, args: unknown) {
          const input = foundationRequest({ version: 1, requestId: randomUUID(), operation: op, args });
          const params = [foundationWindowId, input.requestId, input.operation, JSON.stringify(input.args)];
          const admit = (
            await c.query(
              'select ops.foundation_gateway_admit($1::uuid,$2::uuid,$3::text,$4::jsonb) as r',
              params,
            )
          ).rows[0].r;
          foundationReceipt(admit, input.operation);
          const raw = (
            await c.query(
              'select ops.foundation_gateway_execute($1::uuid,$2::uuid,$3::text,$4::jsonb) as r',
              params,
            )
          ).rows[0].r;
          const r = foundationReceipt(raw, input.operation);
          if (r.state !== 'completed') throw Error('local_contract_business_rejected');
          const cached = (
            await c.query(
              'select ops.foundation_gateway_admit($1::uuid,$2::uuid,$3::text,$4::jsonb) as r',
              params,
            )
          ).rows[0].r;
          if (!foundationReceipt(cached, input.operation).replayed)
            throw Error('local_contract_replay_not_marked');
          const status = (
            await c.query('select ops.foundation_gateway_status($1::uuid,$2::uuid) as r', [
              foundationWindowId,
              input.requestId,
            ])
          ).rows[0].r;
          const observed = foundationReceipt(status, 'request.status');
          if (observed.operation !== op || JSON.stringify(observed.result) !== JSON.stringify(r.result))
            throw Error('local_contract_status_mismatch');
          return { input, result: r.result };
        }
        const started = await operation('run.start', {
          workflow: 'WF-99',
          platform: 'website_work_page',
          mode: 'manual',
          env: 'dev',
          executionId: 'local_contract_' + randomUUID().replaceAll('-', ''),
        });
        const runId = (started.result as { run_id: string }).run_id;
        const conflictArgs = { ...started.input.args, executionId: 'different_local_execution' };
        const conflict = (
          await c.query('select ops.foundation_gateway_admit($1::uuid,$2::uuid,$3::text,$4::jsonb) as r', [
            foundationWindowId,
            started.input.requestId,
            'run.start',
            JSON.stringify(conflictArgs),
          ])
        ).rows[0].r;
        expect(foundationReceipt(conflict, 'run.start').state).toBe('conflict');
        await operation('run.finish', { runId, status: 'success', error: null, apifyRunId: null });
        await operation('settings.read', { key: 'stats_daily_enabled' });
        await operation('prices.read', {});
        await operation('health.guard', {});
        await operation('health.read', {});
        await operation('cost.log', { entries: [] });
        await operation('apify.read', { apifyRunId: 'LocalUnknownOriginal' });
        await operation('launch.read', { launchId: randomUUID() });
        await operation('callback.reject', {
          executionId: 'local_contract_reject',
          apifyRunId: 'LocalUnknownOriginal',
          reason: 'unregistered',
        });
        await operation('error.log', {
          entry: {
            kind: 'error',
            workflow: 'WF-90',
            execution_id: 'local_contract_error',
            node: 'Workflow',
            message: 'workflow_failed',
          },
        });
        await operation('error.count', { workflow: 'WF-90', claimNotify: false });
        const closed = (
          await c.query(
            "select ops.foundation_gateway_admit($1::uuid,$2::uuid,'identity.read','{}'::jsonb,'close') as r",
            [foundationWindowId, randomUUID()],
          )
        ).rows[0].r;
        expect(foundationReceipt(closed, 'identity.read').state).toBe('closed');
        const denied = (
          await c.query(
            "select ops.foundation_gateway_admit($1::uuid,$2::uuid,'health.guard','{}'::jsonb) as r",
            [foundationWindowId, randomUUID()],
          )
        ).rows[0].r;
        expect(foundationReceipt(denied, 'health.guard').state).toBe('closed');
      } catch {
        // Do not let driver diagnostics or arbitrary result rows become test logs.
        throw Error('M03_LOCAL_SQL_CONTRACT_FAILED');
      } finally {
        await c.query('rollback').catch(() => {});
        await c.query('reset session authorization').catch(() => {});
        await c.end();
      }
    }, 30000);
  },
);
