type Row = Record<string, unknown>;
type Registry = {
  apify_run_id: string;
  actor_id: string;
  run_id: string;
  account_ids: [string];
  purpose: 'daily';
  processed_at: string | null;
};
type Terminal = {
  apifyRunId: string;
  parentRunId: string;
  accountId: string;
  actorId: 'aYG0l9s7dbB7j3gbS';
  wireStatus: string;
  status: string;
  datasetId: string | null;
  usageTotalUsd: number;
  finishedAt: string;
};
type SmokeItem = {
  platform: 'website_work_page';
  external_id: string;
  actor: string;
  item_type: 'project_page';
  url: string;
  published_at: null;
  title: string | null;
  caption: string;
  metrics: Row;
  payload: { url: string; markdown: string; metadata: { title: string | null } };
};
type AtomicPayload = {
  p_apify_run_id: string;
  p_status: string;
  p_dataset_id: string | null;
  p_usage_usd: number;
  p_groups: [{ account_id: string; normalizer_version: 'smoke_website_stub.v1'; items: SmokeItem[] }];
};
type Receipt = {
  updated: boolean;
  finished_now: boolean;
  apify_run_id: string;
  run_id: string;
  account_ids: [string];
  status: string;
  dataset_id: string | null;
  cost_usd: number;
  groups_sha256: string;
  normalizer_version: 'smoke_website_stub.v1';
  cost_keys: [string];
  items_seen: number;
  items_new: number;
  new_item_ids: string[];
  accounts_ok: number;
  accounts_failed: number;
  run_summary: {
    run_id: string;
    status: string;
    accounts_total: number;
    accounts_ok: number;
    accounts_failed: number;
    items_seen: number;
    items_new: number;
    cost_usd: number;
  };
};
type Settlement = {
  registry: Registry;
  first: Terminal;
  firstAtMs: number;
  startedAtMs: number;
  reads: number;
};

/**
 * Pure M03-only runtime. This factory has no imports/closure dependencies after
 * TypeScript erasure, so native Code2 embeds the exact tested implementation.
 * It performs no SQL, HTTP, timers, actor launch, audit or notification delivery.
 * App callers retain n8n-apify-contracts' Zod boundary; embedded callers receive the
 * same fixed-error structural checks, cross-tested against that boundary.
 */
export function createApifyRecoveryRuntime() {
  const fail = (code: string): never => {
    throw new Error(code);
  };
  const object = (value: unknown, code: string): Row => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(code);
    return value as Row;
  };
  const keys = (value: Row, expected: string[], code: string) => {
    if (
      Object.keys(value).length !== expected.length ||
      Object.keys(value).some((k) => !expected.includes(k))
    )
      fail(code);
  };
  const id = (value: unknown): value is string =>
    typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
  const uuid = (value: unknown): value is string =>
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const time = (value: unknown): value is string => {
    if (typeof value !== 'string') return false;
    const match = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d+)?(?:Z|([+-])(\d\d):(\d\d))$/.exec(
      value,
    );
    if (!match) return false;
    const year = Number(match[1]),
      month = Number(match[2]),
      day = Number(match[3]);
    const days = [
      31,
      year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
      31,
      30,
      31,
      30,
      31,
      31,
      30,
      31,
      30,
      31,
    ];
    return (
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= days[month - 1]! &&
      Number(match[4]) <= 23 &&
      Number(match[5]) <= 59 &&
      Number(match[6]) <= 59 &&
      (!match[7] || (Number(match[8]) <= 23 && Number(match[9]) <= 59)) &&
      Number.isFinite(Date.parse(value))
    );
  };
  const cost = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 999999.999999;
  const clock = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
  const sqlStatuses = ['SUCCEEDED', 'FAILED', 'TIMED_OUT', 'ABORTED'];
  const wireStatuses = ['SUCCEEDED', 'FAILED', 'TIMED-OUT', 'ABORTED'];
  const url = 'https://everyone.film/about-everyone';
  const version = 'smoke_website_stub.v1' as const;
  const stableKey = (r: Registry) => `apify:${r.apify_run_id}:${r.account_ids[0]}`;
  // Decimal JSON number -> PostgreSQL numeric(12,6), positive ties away from 0.
  // toFixed() uses binary float rounding and is not equivalent at half-micros.
  const sqlCost = (value: number) => {
    const [mantissa = '', exp = '0'] = String(value).toLowerCase().split('e');
    const [whole = '', fraction = ''] = mantissa.split('.');
    let units = BigInt(whole + fraction);
    const shift = Number(exp) - fraction.length + 6;
    if (shift >= 0) units *= 10n ** BigInt(shift);
    else {
      const divisor = 10n ** BigInt(-shift);
      units = (units + divisor / 2n) / divisor;
    }
    return Number(units) / 1e6;
  };
  function registry(raw: unknown, expectedId: unknown): Registry {
    const code = 'EMR_APIFY_REGISTRY_INVALID';
    const r = object(raw, code);
    if (
      !id(expectedId) ||
      r.apify_run_id !== expectedId ||
      !['apify/website-content-crawler', 'aYG0l9s7dbB7j3gbS'].includes(r.actor_id as string) ||
      !uuid(r.run_id) ||
      !Array.isArray(r.account_ids) ||
      r.account_ids.length !== 1 ||
      !uuid(r.account_ids[0]) ||
      r.purpose !== 'daily' ||
      !(r.processed_at === null || time(r.processed_at))
    )
      fail(code);
    return {
      apify_run_id: expectedId as string,
      actor_id: r.actor_id as string,
      run_id: r.run_id as string,
      account_ids: [(r.account_ids as string[])[0]!],
      purpose: 'daily',
      processed_at: r.processed_at as string | null,
    };
  }
  function projectTerminal(body: unknown, rawRegistry: unknown): Terminal {
    const r = object(rawRegistry, 'EMR_APIFY_REGISTRY_INVALID');
    const registered = registry(r, r.apify_run_id);
    const code = 'EMR_APIFY_TRUSTED_RUN_INVALID';
    const d = object(object(body, code).data, code);
    if (
      d.id !== registered.apify_run_id ||
      d.actId !== 'aYG0l9s7dbB7j3gbS' ||
      !wireStatuses.includes(d.status as string) ||
      !cost(d.usageTotalUsd) ||
      !time(d.finishedAt) ||
      !(d.defaultDatasetId === null || d.defaultDatasetId === undefined || id(d.defaultDatasetId)) ||
      (d.status === 'SUCCEEDED' && !id(d.defaultDatasetId))
    )
      fail(code);
    return {
      apifyRunId: registered.apify_run_id,
      parentRunId: registered.run_id,
      accountId: registered.account_ids[0],
      actorId: 'aYG0l9s7dbB7j3gbS',
      wireStatus: d.status as string,
      status: d.status === 'TIMED-OUT' ? 'TIMED_OUT' : (d.status as string),
      datasetId: (d.defaultDatasetId ?? null) as string | null,
      usageTotalUsd: d.usageTotalUsd as number,
      finishedAt: d.finishedAt as string,
    };
  }
  function terminal(raw: unknown): Terminal {
    const code = 'EMR_APIFY_COST_NOT_SETTLED',
      t = object(raw, code);
    keys(
      t,
      [
        'apifyRunId',
        'parentRunId',
        'accountId',
        'actorId',
        'wireStatus',
        'status',
        'datasetId',
        'usageTotalUsd',
        'finishedAt',
      ],
      code,
    );
    if (
      !id(t.apifyRunId) ||
      !uuid(t.parentRunId) ||
      !uuid(t.accountId) ||
      t.actorId !== 'aYG0l9s7dbB7j3gbS' ||
      !wireStatuses.includes(t.wireStatus as string) ||
      t.status !== (t.wireStatus === 'TIMED-OUT' ? 'TIMED_OUT' : t.wireStatus) ||
      !(t.datasetId === null || id(t.datasetId)) ||
      (t.status === 'SUCCEEDED' && !id(t.datasetId)) ||
      !cost(t.usageTotalUsd) ||
      !time(t.finishedAt)
    )
      fail(code);
    return { ...t } as Terminal;
  }
  function settle(first: unknown, second: unknown, elapsedMs: unknown): Terminal {
    const a = terminal(first),
      b = terminal(second);
    if (
      !Number.isSafeInteger(elapsedMs) ||
      (elapsedMs as number) < 10000 ||
      (elapsedMs as number) > 180000 ||
      Object.keys(a).some((k) => a[k as keyof Terminal] !== b[k as keyof Terminal])
    )
      fail('EMR_APIFY_COST_NOT_SETTLED');
    return b;
  }
  function beginSettlement(body: unknown, rawRegistry: unknown, nowMs: unknown): Settlement {
    if (!clock(nowMs)) fail('EMR_APIFY_SETTLEMENT_CLOCK_INVALID');
    const r = object(rawRegistry, 'EMR_APIFY_REGISTRY_INVALID');
    return {
      registry: registry(r, r.apify_run_id),
      first: projectTerminal(body, r),
      firstAtMs: nowMs as number,
      startedAtMs: nowMs as number,
      reads: 1,
    };
  }
  function advanceSettlement(rawState: unknown, body: unknown, nowMs: unknown) {
    const code = 'EMR_APIFY_SETTLEMENT_EXHAUSTED',
      state = object(rawState, code);
    keys(state, ['registry', 'first', 'firstAtMs', 'startedAtMs', 'reads'], code);
    const r = object(state.registry, code),
      registered = registry(r, r.apify_run_id),
      first = terminal(state.first);
    if (
      !clock(nowMs) ||
      !clock(state.startedAtMs) ||
      !clock(state.firstAtMs) ||
      (nowMs as number) < (state.firstAtMs as number) ||
      (state.firstAtMs as number) < (state.startedAtMs as number) ||
      (nowMs as number) - (state.startedAtMs as number) > 180000 ||
      !Number.isInteger(state.reads) ||
      (state.reads as number) < 1 ||
      (state.reads as number) >= 4
    )
      fail(code);
    const current = {
      registry: registered,
      first,
      firstAtMs: state.firstAtMs as number,
      startedAtMs: state.startedAtMs as number,
      reads: state.reads as number,
    };
    const elapsed = (nowMs as number) - current.firstAtMs;
    // A supplied body is an actual observation, not a free timer tick. Reject
    // an early reread instead of silently permitting uncounted HTTP reads.
    if (elapsed < 10000) fail('EMR_APIFY_COST_NOT_SETTLED');
    const next = projectTerminal(body, registered);
    if (
      Object.keys(first).some(
        (k) => k !== 'usageTotalUsd' && first[k as keyof Terminal] !== next[k as keyof Terminal],
      )
    )
      fail('EMR_APIFY_SETTLEMENT_IDENTITY_CHANGED');
    if (first.usageTotalUsd === next.usageTotalUsd)
      return { action: 'settled' as const, terminal: settle(first, next, elapsed), reads: current.reads + 1 };
    return {
      action: 'wait' as const,
      waitMs: 10000,
      state: { ...current, first: next, firstAtMs: nowMs as number, reads: current.reads + 1 },
    };
  }
  function validItem(raw: unknown): SmokeItem {
    const code = 'EMR_APIFY_GROUP_INVALID',
      i = object(raw, code);
    keys(
      i,
      [
        'platform',
        'external_id',
        'actor',
        'item_type',
        'url',
        'published_at',
        'title',
        'caption',
        'metrics',
        'payload',
      ],
      code,
    );
    const p = object(i.payload, code),
      meta = object(p.metadata, code),
      metrics = object(i.metrics, code);
    keys(p, ['url', 'markdown', 'metadata'], code);
    keys(meta, ['title'], code);
    keys(metrics, [], code);
    const text = (v: unknown, n: number) =>
      typeof v === 'string' &&
      !v.includes('\u0000') &&
      Array.from(v).length <= n &&
      Array.from(v).every((c) => c.length === 2 || !/[\uD800-\uDFFF]/.test(c));
    if (
      i.platform !== 'website_work_page' ||
      i.external_id !== 'e4d69e3fb0d821183258d75248f9df24' ||
      i.actor !== 'apify/website-content-crawler' ||
      i.item_type !== 'project_page' ||
      i.url !== url ||
      i.published_at !== null ||
      !(i.title === null || text(i.title, 2000)) ||
      !text(i.caption, 8000) ||
      p.url !== url ||
      p.markdown !== i.caption ||
      meta.title !== i.title
    )
      fail(code);
    return {
      platform: 'website_work_page',
      external_id: i.external_id as string,
      actor: 'apify/website-content-crawler',
      item_type: 'project_page',
      url,
      published_at: null,
      title: i.title as string | null,
      caption: i.caption as string,
      metrics: {},
      payload: { url, markdown: i.caption as string, metadata: { title: i.title as string | null } },
    };
  }
  function makeAtomicPayload(rawRegistry: unknown, rawTerminal: unknown, items: unknown): AtomicPayload {
    const raw = object(rawRegistry, 'EMR_APIFY_REGISTRY_INVALID'),
      r = registry(raw, raw.apify_run_id),
      t = terminal(rawTerminal);
    if (
      r.processed_at !== null ||
      t.apifyRunId !== r.apify_run_id ||
      t.parentRunId !== r.run_id ||
      t.accountId !== r.account_ids[0]
    )
      fail('EMR_APIFY_REGISTRY_INVALID');
    if (!Array.isArray(items) || items.length !== (t.status === 'SUCCEEDED' ? 1 : 0))
      fail('EMR_APIFY_GROUP_INVALID');
    return {
      p_apify_run_id: r.apify_run_id,
      p_status: t.status,
      p_dataset_id: t.datasetId,
      p_usage_usd: t.usageTotalUsd,
      p_groups: [
        {
          account_id: r.account_ids[0],
          normalizer_version: version,
          items: (items as unknown[]).map(validItem),
        },
      ],
    };
  }
  function atomicPayload(value: unknown): AtomicPayload {
    const code = 'EMR_APIFY_GROUP_INVALID',
      p = object(value, code);
    keys(p, ['p_apify_run_id', 'p_status', 'p_dataset_id', 'p_usage_usd', 'p_groups'], code);
    if (
      !id(p.p_apify_run_id) ||
      !sqlStatuses.includes(p.p_status as string) ||
      !(p.p_dataset_id === null || id(p.p_dataset_id)) ||
      !cost(p.p_usage_usd) ||
      (p.p_status === 'SUCCEEDED' && !id(p.p_dataset_id)) ||
      !Array.isArray(p.p_groups) ||
      p.p_groups.length !== 1
    )
      fail(code);
    const g = object((p.p_groups as unknown[])[0], code);
    keys(g, ['account_id', 'normalizer_version', 'items'], code);
    if (
      !uuid(g.account_id) ||
      g.normalizer_version !== version ||
      !Array.isArray(g.items) ||
      g.items.length !== (p.p_status === 'SUCCEEDED' ? 1 : 0)
    )
      fail(code);
    return {
      p_apify_run_id: p.p_apify_run_id as string,
      p_status: p.p_status as string,
      p_dataset_id: p.p_dataset_id as string | null,
      p_usage_usd: p.p_usage_usd as number,
      p_groups: [
        {
          account_id: g.account_id as string,
          normalizer_version: version,
          items: (g.items as unknown[]).map(validItem),
        },
      ],
    };
  }
  function validateReceipt(value: unknown, rawRegistry: unknown, expectedPayload?: unknown): Receipt {
    const code = 'EMR_APIFY_RECEIPT_INVALID',
      r0 = object(rawRegistry, code),
      r = registry(r0, r0.apify_run_id),
      v = object(value, code);
    keys(
      v,
      [
        'updated',
        'finished_now',
        'apify_run_id',
        'run_id',
        'account_ids',
        'status',
        'dataset_id',
        'cost_usd',
        'groups_sha256',
        'normalizer_version',
        'cost_keys',
        'items_seen',
        'items_new',
        'new_item_ids',
        'accounts_ok',
        'accounts_failed',
        'run_summary',
      ],
      code,
    );
    const summary = object(v.run_summary, code);
    keys(
      summary,
      [
        'run_id',
        'status',
        'accounts_total',
        'accounts_ok',
        'accounts_failed',
        'items_seen',
        'items_new',
        'cost_usd',
      ],
      code,
    );
    const success = v.status === 'SUCCEEDED',
      seen = success ? 1 : 0;
    if (
      typeof v.updated !== 'boolean' ||
      v.finished_now !== v.updated ||
      v.apify_run_id !== r.apify_run_id ||
      v.run_id !== r.run_id ||
      !Array.isArray(v.account_ids) ||
      v.account_ids.length !== 1 ||
      v.account_ids[0] !== r.account_ids[0] ||
      !sqlStatuses.includes(v.status as string) ||
      !(v.dataset_id === null || id(v.dataset_id)) ||
      (success && !id(v.dataset_id)) ||
      !cost(v.cost_usd) ||
      sqlCost(v.cost_usd as number) !== v.cost_usd ||
      typeof v.groups_sha256 !== 'string' ||
      !/^[0-9a-f]{64}$/.test(v.groups_sha256) ||
      v.normalizer_version !== version ||
      !Array.isArray(v.cost_keys) ||
      v.cost_keys.length !== 1 ||
      v.cost_keys[0] !== stableKey(r) ||
      v.items_seen !== seen ||
      !Number.isInteger(v.items_new) ||
      (v.items_new as number) < 0 ||
      (v.items_new as number) > seen ||
      !Array.isArray(v.new_item_ids) ||
      v.new_item_ids.length !== v.items_new ||
      v.new_item_ids.some((x) => !uuid(x)) ||
      v.accounts_ok !== (success ? 1 : 0) ||
      v.accounts_failed !== (success ? 0 : 1) ||
      summary.run_id !== r.run_id ||
      summary.status !== (success ? 'success' : 'partial') ||
      summary.accounts_total !== 1 ||
      summary.accounts_ok !== v.accounts_ok ||
      summary.accounts_failed !== v.accounts_failed ||
      summary.items_seen !== v.items_seen ||
      summary.items_new !== v.items_new ||
      summary.cost_usd !== v.cost_usd
    )
      fail(code);
    if (expectedPayload !== undefined) {
      const p = atomicPayload(expectedPayload);
      if (
        p.p_apify_run_id !== r.apify_run_id ||
        p.p_groups[0].account_id !== r.account_ids[0] ||
        p.p_status !== v.status ||
        p.p_dataset_id !== v.dataset_id ||
        sqlCost(p.p_usage_usd) !== v.cost_usd
      )
        fail(code);
    }
    // This digest comes from PostgreSQL's JSONB canonical text. Never invent a
    // JSON.stringify hash: durable readback must retain this exact SQL receipt.
    return JSON.parse(JSON.stringify(v)) as Receipt;
  }
  function savedReplay(rawRegistry: unknown, expectedId: unknown): Receipt | null {
    const r = registry(rawRegistry, expectedId),
      raw = object(rawRegistry, 'EMR_APIFY_REGISTRY_INVALID');
    if (r.processed_at === null) {
      if (raw.processing_result !== undefined && raw.processing_result !== null)
        fail('EMR_APIFY_RECEIPT_NOT_DURABLE');
      return null;
    }
    const receipt = validateReceipt(raw.processing_result, r);
    if (
      !receipt.updated ||
      raw.status !== receipt.status ||
      raw.dataset_id !== receipt.dataset_id ||
      raw.usage_usd !== receipt.cost_usd
    )
      fail('EMR_APIFY_RECEIPT_INVALID');
    return { ...receipt, updated: false, finished_now: false };
  }
  function callbackLookup(rawRegistry: unknown, expectedId: unknown) {
    if (!id(expectedId)) fail('EMR_APIFY_NOTIFICATION_INVALID');
    if (rawRegistry === null)
      return { action: 'blocked' as const, reason: 'unknown_callback_audit_unavailable' as const };
    const replay = savedReplay(rawRegistry, expectedId);
    if (replay) return { action: 'saved_receipt' as const, receipt: replay };
    return {
      action: 'read_authenticated_run' as const,
      apify_run_id: expectedId,
      url: `https://api.apify.com/v2/actor-runs/${expectedId}?waitForFinish=0`,
      automaticRetry: false,
    };
  }
  function reconcileAtomic(rawRegistry: unknown, expectedPayload: unknown, observedReceipt?: unknown) {
    const p = atomicPayload(expectedPayload),
      r = registry(rawRegistry, p.p_apify_run_id);
    if (p.p_groups[0].account_id !== r.account_ids[0]) fail('EMR_APIFY_REGISTRY_INVALID');
    const replay = savedReplay(rawRegistry, p.p_apify_run_id);
    if (!replay) {
      if (observedReceipt !== undefined) fail('EMR_APIFY_RECEIPT_NOT_DURABLE');
      return { action: 'retry_same_atomic' as const, payload: p, automaticRetry: false };
    }
    validateReceipt(replay, r, p);
    if (observedReceipt === undefined)
      // The saved SQL receipt is authoritative for the original run, but its
      // digest alone cannot prove which attempted groups produced it. Recover
      // that saved result without dispatch or a client-side equality claim.
      return {
        action: 'complete' as const,
        receipt: replay,
        dispatchEligible: false,
        payloadEqualityVerified: false,
      };
    const fresh = validateReceipt(observedReceipt, r, p);
    const comparable = (v: Receipt) => JSON.stringify({ ...v, updated: false, finished_now: false });
    // validateReceipt projects a fixed key set below, so property order from a
    // Postgres driver is immaterial to the comparison.
    const canonical = (v: unknown): string =>
      Array.isArray(v)
        ? `[${v.map(canonical).join(',')}]`
        : v && typeof v === 'object'
          ? `{${Object.keys(v)
              .sort()
              .map((k) => `${JSON.stringify(k)}:${canonical((v as Row)[k])}`)
              .join(',')}}`
          : JSON.stringify(v);
    if (canonical(JSON.parse(comparable(fresh))) !== canonical(JSON.parse(comparable(replay))))
      fail('EMR_APIFY_RECEIPT_CHANGED');
    return {
      action: 'complete' as const,
      receipt: fresh,
      dispatchEligible: fresh.finished_now,
      payloadEqualityVerified: true,
    };
  }
  function pendingFinish(pending: unknown, rawReceipt: unknown) {
    if (!Number.isSafeInteger(pending) || (pending as number) < 0) fail('EMR_APIFY_PENDING_INVALID');
    const raw = object(rawReceipt, 'EMR_APIFY_RECEIPT_INVALID');
    const r = {
      apify_run_id: raw.apify_run_id,
      actor_id: 'apify/website-content-crawler',
      run_id: raw.run_id,
      account_ids: raw.account_ids,
      purpose: 'daily',
      processed_at: null,
    };
    const receipt = validateReceipt(raw, r);
    if (pending !== 0) return { action: 'wait_pending' as const };
    if (!receipt.finished_now) return { action: 'duplicate_no_dispatch' as const };
    // SQL already finishes the parent in the same atomic transaction. This is
    // downstream eligibility, not a second finish_run or exactly-once delivery.
    return {
      action: 'downstream_eligible' as const,
      run_id: receipt.run_id,
      new_item_ids: receipt.new_item_ids,
      externalDeliveryExactlyOnce: false,
    };
  }
  function registrationRecovery(originalRunId: unknown, expectedContext: unknown, rawRegistry: unknown) {
    const code = 'EMR_APIFY_REGISTRATION_CHANGED',
      c = object(expectedContext, code);
    keys(c, ['run_id', 'account_ids', 'actor_id', 'purpose'], code);
    const expected = registry(
      { ...c, apify_run_id: originalRunId ?? 'NoOriginalRun', processed_at: null },
      originalRunId ?? 'NoOriginalRun',
    );
    if (originalRunId === null)
      return { action: 'blocked' as const, reason: 'ambiguous_actor_launch_no_retry' as const };
    if (!id(originalRunId)) fail(code);
    if (rawRegistry === null)
      return {
        action: 'register_same_original' as const,
        params: [originalRunId, expected.actor_id, expected.run_id, expected.account_ids, expected.purpose],
        automaticRetry: false,
      };
    const actual = registry(rawRegistry, originalRunId);
    if (
      actual.run_id !== expected.run_id ||
      actual.account_ids[0] !== expected.account_ids[0] ||
      actual.actor_id !== expected.actor_id ||
      actual.purpose !== expected.purpose
    )
      fail(code);
    // Called by the collector after successful/reconciled registration. The
    // rejected unknown webhook is never treated as trusted registration data.
    return {
      action: 'process_registered' as const,
      apify_run_id: originalRunId,
      source: 'collector_recovery' as const,
    };
  }
  return {
    registry,
    savedReplay,
    projectTerminal,
    settle,
    beginSettlement,
    advanceSettlement,
    makeAtomicPayload,
    validateReceipt,
    callbackLookup,
    reconcileAtomic,
    pendingFinish,
    registrationRecovery,
  };
}
