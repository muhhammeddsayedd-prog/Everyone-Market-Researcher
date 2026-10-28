import { describe, expect, it } from 'vitest';
import { runLinkedInCollector, type LinkedInGateway } from '../collectors/linkedin-run.mjs';

const runId = '50000000-0000-4000-8000-000000000001';
const a = (index = 1, platform = 'linkedin') => ({
  id: `70000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  competitor_id: `80000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  platform,
  handle: `fixture-${index}`,
  url: `https://www.linkedin.com/company/fixture-${index}/`,
  last_item_published_at: index === 1 ? '2026-10-24T10:00:00Z' : '2026-10-20T10:00:00Z',
});
const input = (kind: 'posts' | 'employees' = 'posts') => ({
  env: 'dev',
  kind,
  mode: kind === 'employees' ? 'weekly' : 'daily',
  executionId: 'local-synthetic-m05-1',
  limit: 2,
  account_ids: [a().id, a(2).id],
  results_limit: 20,
  max_actor_starts: 2,
});
function setup(kind: 'posts' | 'employees' = 'posts') {
  const calls: { operation: string; args: Record<string, unknown>; id?: string }[] = [];
  const record = (operation: string, args: Record<string, unknown>, id?: string) =>
    calls.push({ operation, args, id });
  let actor = 0;
  const gateway: LinkedInGateway = {
    start: async (args, id) => {
      record('start', args, id);
      return { run_id: runId };
    },
    claim: async (args, id) => {
      record('claim', args, id);
      return [
        a(1, kind === 'employees' ? 'linkedin_employees' : 'linkedin'),
        a(2, kind === 'employees' ? 'linkedin_employees' : 'linkedin'),
      ];
    },
    launch: async (args, id) => {
      record('launch', args, id);
      return {
        permit: true,
        replayed: false,
        launch_id: args.launch_id,
        descriptor: {
          billingModel: 'PPE',
          actorPath: String(args.actor_id).replace('/', '~'),
          build: '0.0.1',
          maxTotalChargeUsd: 1,
          maxItems: 20,
          memory: 1024,
          timeout: 600,
        },
      };
    },
    register: async (args, id) => {
      record('register', args, id);
      return { registered: true, run_id: runId, apify_run_id: args.apify_run_id };
    },
    close_registration: async (args, id) => {
      record('close_registration', args, id);
      return { registration_closed: true, state: 'awaiting_callbacks', finished_now: false, summary: null };
    },
    finish: async (args, id) => {
      record('finish', args, id);
      return {};
    },
  };
  const deps = {
    gateway,
    now: () => '2026-10-27T22:30:00Z',
    startActor: async (args: {
      actor_id: string;
      launch_id: string;
      input: Record<string, unknown>;
      descriptor: Record<string, unknown>;
    }): Promise<unknown> => {
      record('actor_start', args);
      return { statusCode: 201, body: { data: { id: `synthetic_actor_${++actor}` } } };
    },
  };
  return { calls, gateway, deps };
}

describe('LinkedIn asynchronous dispatch through fixed ports — local simulation only', () => {
  it('registers every actual date bucket then closes registration; dispatch never claims callback completion', async () => {
    const t = setup();
    expect(await runLinkedInCollector(input(), t.deps)).toMatchObject({
      state: 'awaiting_callbacks',
      actor_starts: 2,
      actor_run_ids: ['synthetic_actor_1', 'synthetic_actor_2'],
      registration_closed: true,
    });
    expect(t.calls.map((call) => call.operation)).toEqual([
      'start',
      'claim',
      'launch',
      'actor_start',
      'register',
      'launch',
      'actor_start',
      'register',
      'close_registration',
    ]);
    expect(t.calls.some((call) => ['finish', 'ingest', 'cost'].includes(call.operation))).toBe(false);
    const launch = t.calls.find((call) => call.operation === 'launch');
    expect(launch?.args).toMatchObject({
      pass: 'primary',
      actor_input: { scrapeReactions: false, scrapeComments: false, includeReposts: true, maxPosts: 20 },
    });
  });
  it('pins employee snapshot date to capture Cairo date and sends only Short finite INPUT', async () => {
    const t = setup('employees');
    expect(await runLinkedInCollector(input('employees'), t.deps)).toMatchObject({
      state: 'awaiting_callbacks',
      actor_starts: 2,
    });
    for (const launch of t.calls.filter((call) => call.operation === 'launch'))
      expect(launch.args).toMatchObject({
        pass: 'primary',
        snapshot_date: '2026-10-28',
        actor_input: {
          profileScraperMode: 'Short ($4 per 1k)',
          maxItems: 20,
          maxItemsPerCompany: 20,
          companyBatchMode: 'one_by_one',
        },
      });
    expect(JSON.stringify(t.calls)).not.toMatch(/initialCookies|session|email|photo|save_snapshot|ingest/);
  });
  it('reports the actual completed run status when callbacks settled before registration closed', async () => {
    for (const status of ['success', 'partial', 'failed']) {
      const t = setup();
      t.gateway.close_registration = async () => ({
        registration_closed: true,
        state: 'completed',
        finished_now: true,
        summary: { run_id: runId, status },
      });
      expect(await runLinkedInCollector(input(), t.deps)).toMatchObject({
        state: 'completed',
        status,
        run_id: runId,
        actor_starts: 2,
        registration_closed: true,
      });
      expect(t.calls.some((call) => call.operation === 'finish')).toBe(false);
    }
  });
  it('reconciles malformed or foreign close receipts without fabricating completion or calling finish', async () => {
    for (const closed of [
      { registration_closed: true },
      { registration_closed: true, state: 'awaiting_callbacks', finished_now: true, summary: null },
      {
        registration_closed: true,
        state: 'awaiting_callbacks',
        finished_now: false,
        summary: { run_id: runId, status: 'success' },
      },
      {
        registration_closed: true,
        state: 'completed',
        finished_now: false,
        summary: { run_id: runId, status: 'success' },
      },
      { registration_closed: true, state: 'completed', finished_now: true, summary: null },
      {
        registration_closed: true,
        state: 'completed',
        finished_now: true,
        summary: { run_id: a().id, status: 'success' },
      },
      {
        registration_closed: true,
        state: 'completed',
        finished_now: true,
        summary: { run_id: runId, status: 'running' },
      },
      {
        registration_closed: false,
        state: 'completed',
        finished_now: true,
        summary: { run_id: runId, status: 'success' },
      },
    ]) {
      const t = setup();
      t.gateway.close_registration = async () => closed;
      expect(await runLinkedInCollector(input(), t.deps)).toMatchObject({
        state: 'reconciliation_required',
        stage: 'close_registration',
        actor_starts: 2,
      });
      expect(t.calls.some((call) => call.operation === 'finish')).toBe(false);
    }
  });
  it('rejects production, hidden input knobs, incorrect selector and unbounded requests before gateway calls', async () => {
    for (const changed of [
      { env: 'prod' },
      { cookies: [] },
      { results_limit: 0 },
      { account_ids: [a().id, a().id] },
      { max_actor_starts: 0 },
    ]) {
      const t = setup();
      await expect(runLinkedInCollector({ ...input(), ...changed }, t.deps)).rejects.toThrow(
        /invalid_run_input/,
      );
      expect(t.calls).toEqual([]);
    }
  });
  it('will not use an exhausted or replayed permit, unsafe descriptor, or altered claimed account', async () => {
    for (const mode of ['replayed', 'denied', 'wrong-build', 'wrong-account', 'wrong-billing']) {
      const t = setup();
      if (mode === 'wrong-account') t.gateway.claim = async () => [a(), a(3)];
      else
        t.gateway.launch = async (args) => ({
          permit: mode !== 'denied',
          replayed: mode === 'replayed',
          launch_id: args.launch_id,
          descriptor: {
            billingModel: mode === 'wrong-billing' ? 'PPU' : 'PPE',
            actorPath: 'harvestapi~linkedin-company-posts',
            build: mode === 'wrong-build' ? 'latest' : '0.0.1',
            maxTotalChargeUsd: 1,
            maxItems: 20,
            memory: 1024,
            timeout: 600,
          },
        });
      expect(await runLinkedInCollector(input(), t.deps)).toMatchObject({
        state: 'reconciliation_required',
        actor_starts: 0,
      });
      expect(t.calls.some((call) => call.operation === 'actor_start')).toBe(false);
    }
  });
  it('leaves ambiguous actor POST outcomes for reconciliation without registration closure/retry/release', async () => {
    const t = setup();
    let starts = 0;
    t.deps.startActor = async () => {
      starts++;
      throw Error('synthetic secret-bearing transport diagnostic');
    };
    const result = await runLinkedInCollector(input(), t.deps);
    expect(result).toMatchObject({
      state: 'reconciliation_required',
      stage: 'actor_start',
      uncertain_start: true,
    });
    expect(starts).toBe(1);
    expect(JSON.stringify(result)).not.toContain('diagnostic');
    expect(
      t.calls.some((call) => ['register', 'close_registration', 'finish'].includes(call.operation)),
    ).toBe(false);
  });
  it('does not retry a successful start whose registration receipt was lost, or start the next batch', async () => {
    const t = setup();
    t.gateway.register = async () => {
      throw Error('lost receipt');
    };
    expect(await runLinkedInCollector(input(), t.deps)).toMatchObject({
      state: 'reconciliation_required',
      stage: 'register',
      actor_starts: 1,
      uncertain_start: false,
    });
    expect(t.calls.filter((call) => call.operation === 'actor_start')).toHaveLength(1);
    expect(t.calls.some((call) => call.operation === 'close_registration')).toBe(false);
  });
  it('requires enough starts for the whole claimed plan before any paid dispatch', async () => {
    const t = setup();
    expect(await runLinkedInCollector({ ...input(), max_actor_starts: 1 }, t.deps)).toMatchObject({
      state: 'reconciliation_required',
      stage: 'plan',
      actor_starts: 0,
    });
    expect(t.calls.some((call) => ['launch', 'actor_start', 'finish'].includes(call.operation))).toBe(false);
  });
});
