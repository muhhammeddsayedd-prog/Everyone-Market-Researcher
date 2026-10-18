import { describe, expect, it, vi } from 'vitest';
import {
  admitProviderBudgetAction,
  assertProviderBudgetAction,
  approvedOriginalRunId,
  type ProviderBudgetContext,
} from './provider-budget';

const source = 'a'.repeat(64);
const proof = { readbackEvidenceSha256: 'b'.repeat(64), originalReceiptArchiveSha256: 'c'.repeat(64) };
const recovery = {
  version: 1,
  projectRef: 'zmotjsbzhzjvpelxvxlf',
  target: 'supabase:zmotjsbzhzjvpelxvxlf:postgres',
  action: 'accept-dev',
  sourceSha256: source,
  runId: 'e6a7e79c-4d48-45ef-9139-cd83db362f43',
  startedAt: '2026-10-18T01:12:06.577Z',
  outcome: 'recovered',
  originalOutcome: 'unreconciled',
  initialBudgetConsumed: true,
  originalNativeExitCode: 1,
  originalNativeCompletion: 'failed',
  recoveredAt: '2026-10-18T02:00:00Z',
  readbackEvidence: 'milestones/M02-seed-data/evidence/dev-reconciliation-20261018.json',
  readbackEvidenceSha256: proof.readbackEvidenceSha256,
  originalReceiptArchive: 'milestones/M02-seed-data/evidence/dev-main-batch-receipt-20261018.json',
  originalReceiptArchiveSha256: proof.originalReceiptArchiveSha256,
};
const fresh = (): ProviderBudgetContext => ({
  projectRef: 'zmotjsbzhzjvpelxvxlf',
  target: 'supabase:zmotjsbzhzjvpelxvxlf:postgres',
  sourceSha256: source,
  seedManifestPresent: false,
  initialAdmission: undefined,
});
const continued = (): ProviderBudgetContext => ({
  ...fresh(),
  seedManifestPresent: true,
  initialAdmission: recovery,
  originalRunId: approvedOriginalRunId,
  recoveryProof: proof,
});
const paths = {
  initialAdmissionPath: 'NOT_A_REAL_MARKER_INITIAL',
  continuationAdmissionPath: 'NOT_A_REAL_MARKER_CONTINUATION',
  runId: '11111111-1111-4111-8111-111111111111',
  startedAt: '2026-10-18T01:00:00Z',
};

describe('independent durable provider budget admission', () => {
  it.each(['accept-dev', 'probe'] as const)(
    'permits a fresh %s only before seed ownership/admission exists',
    (action) => {
      expect(assertProviderBudgetAction(action, fresh())).toBe('initial_provider');
      expect(() => assertProviderBudgetAction(action, { ...fresh(), seedManifestPresent: true })).toThrow(
        'M02_PROVIDER_REPLAY_REQUIRES_REVIEW',
      );
      expect(() => assertProviderBudgetAction(action, { ...fresh(), initialAdmission: recovery })).toThrow(
        'M02_INITIAL_PROVIDER_BUDGET_ALREADY_CONSUMED',
      );
    },
  );

  it.each(['seed', 'websites', 'logos'] as const)(
    'blocks %s replay even if the admission was accidentally lost',
    (action) => {
      expect(() => assertProviderBudgetAction(action, continued())).toThrow(
        'M02_INITIAL_PROVIDER_BUDGET_ALREADY_CONSUMED',
      );
      expect(() => assertProviderBudgetAction(action, { ...fresh(), seedManifestPresent: true })).toThrow(
        'M02_PROVIDER_REPLAY_REQUIRES_REVIEW',
      );
    },
  );

  it('leaves read-only report and local plan available during recovery', () => {
    expect(assertProviderBudgetAction('report', continued())).toBe('report');
    expect(assertProviderBudgetAction('plan', continued())).toBe('plan');
    expect(
      assertProviderBudgetAction('report', { ...continued(), initialAdmission: { malformed: true } }),
    ).toBe('report');
  });

  it('requires the fixed actual original run and separately verified recovery hashes for resolve', () => {
    expect(assertProviderBudgetAction('resolve', continued())).toBe('youtube_continuation');
    expect(() => assertProviderBudgetAction('resolve', fresh())).toThrow(
      'M02_PROVIDER_ORIGINAL_ADMISSION_REQUIRED',
    );
    expect(() => assertProviderBudgetAction('resolve', { ...continued(), originalRunId: undefined })).toThrow(
      'M02_PROVIDER_RECOVERY_PROOF_REQUIRED',
    );
    expect(() => assertProviderBudgetAction('resolve', { ...continued(), recoveryProof: undefined })).toThrow(
      'M02_PROVIDER_RECOVERY_PROOF_REQUIRED',
    );
  });

  it.each([
    { sourceSha256: 'd'.repeat(64) },
    { projectRef: 'hkiafqrcxaafdbcvjlzv' },
    { target: 'supabase:other:postgres' },
    { runId: '22222222-2222-4222-8222-222222222222' },
    { originalNativeExitCode: 0 },
    { originalNativeCompletion: 'success' },
    { outcome: 'consumed' },
    { initialBudgetConsumed: false },
    { readbackEvidence: '../private.json' },
    { readbackEvidenceSha256: 'd'.repeat(64) },
    { originalReceiptArchiveSha256: 'd'.repeat(64) },
    { recoveredAt: '2026-10-17T00:00:00Z' },
    { unexpectedField: 'RAW_VALUE_NEVER_ECHOED' },
  ])('fails closed for mismatched or malformed recovery records', (patch) => {
    expect(() =>
      assertProviderBudgetAction('resolve', { ...continued(), initialAdmission: { ...recovery, ...patch } }),
    ).toThrow('M02_PROVIDER_RECOVERY_RECORD_REJECTED');
  });

  it('a consumed first admission cannot pretend to be a reconciled continuation', async () => {
    let initialRecord: unknown;
    await admitProviderBudgetAction('accept-dev', fresh(), paths, {
      createExclusive: async (_path, record) => {
        initialRecord = record;
      },
      admitContinuation: async () => {
        throw new Error('must not call');
      },
    });
    expect(initialRecord).toMatchObject({ outcome: 'consumed', initialBudgetConsumed: true });
    expect(() =>
      assertProviderBudgetAction('resolve', { ...continued(), initialAdmission: initialRecord }),
    ).toThrow('M02_PROVIDER_RECOVERY_RECORD_REJECTED');
    expect(() =>
      assertProviderBudgetAction('probe', { ...fresh(), initialAdmission: initialRecord }),
    ).toThrow('M02_INITIAL_PROVIDER_BUDGET_ALREADY_CONSUMED');
  });

  it('reserves a fresh initial provider admission exclusively before returning provider permission', async () => {
    let exists = false;
    const createExclusive = vi.fn(async () => {
      if (exists) throw new Error('private filesystem error never echoed');
      exists = true;
    });
    const results = await Promise.allSettled([
      admitProviderBudgetAction('accept-dev', fresh(), paths, {
        createExclusive,
        admitContinuation: async () => {},
      }),
      admitProviderBudgetAction('probe', fresh(), paths, {
        createExclusive,
        admitContinuation: async () => {},
      }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const failure = results.find((result) => result.status === 'rejected');
    expect(failure?.status === 'rejected' && failure.reason.message).toBe(
      'M02_INITIAL_PROVIDER_ADMISSION_FAILED',
    );
    expect(createExclusive).toHaveBeenCalledTimes(2);
  });

  it('a valid continuation must acquire its separate one-shot marker and returns a one-attempt budget', async () => {
    const admitContinuation = vi.fn(async () => {});
    const createExclusive = vi.fn(async () => {});
    expect(
      await admitProviderBudgetAction('resolve', continued(), paths, { createExclusive, admitContinuation }),
    ).toEqual({ mode: 'youtube_continuation', youtubeMaxAttempts: 1 });
    expect(admitContinuation).toHaveBeenCalledExactlyOnceWith(paths.continuationAdmissionPath, source);
    expect(createExclusive).not.toHaveBeenCalled();
  });

  it('a missing recovery record rejects before any admission writer or continuation can run', async () => {
    const createExclusive = vi.fn(async () => {});
    const admitContinuation = vi.fn(async () => {});
    await expect(
      admitProviderBudgetAction('resolve', fresh(), paths, { createExclusive, admitContinuation }),
    ).rejects.toThrow('M02_PROVIDER_ORIGINAL_ADMISSION_REQUIRED');
    expect(createExclusive).not.toHaveBeenCalled();
    expect(admitContinuation).not.toHaveBeenCalled();
  });
});
