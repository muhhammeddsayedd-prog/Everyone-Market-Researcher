import { writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { SeedRuntimeError, type SeedAction } from './config';
import { admitYouTubeContinuation } from './youtube-continuation';

export const approvedOriginalRunId = 'e6a7e79c-4d48-45ef-9139-cd83db362f43' as const;
export const providerBudgetEvidencePaths = {
  readbackEvidence: 'milestones/M02-seed-data/evidence/dev-reconciliation-20261018.json',
  originalReceiptArchive: 'milestones/M02-seed-data/evidence/dev-main-batch-receipt-20261018.json',
} as const;
const projectRef = 'zmotjsbzhzjvpelxvxlf' as const;
const target = `supabase:${projectRef}:postgres` as const;
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z.iso.datetime({ offset: true });
const commonFields = {
  version: z.literal(1),
  projectRef: z.literal(projectRef),
  target: z.literal(target),
  sourceSha256: digest,
  runId: z.string().uuid(),
  startedAt: timestamp,
  initialBudgetConsumed: z.literal(true),
};
export const initialProviderAdmissionSchema = z.strictObject({
  ...commonFields,
  action: z.enum(['accept-dev', 'probe']),
  outcome: z.literal('consumed'),
});
/** A reconciled failed original run, not an unproven initial admission. Paths are fixed source constants. */
export const recoveredProviderAdmissionSchema = z
  .strictObject({
    ...commonFields,
    action: z.literal('accept-dev'),
    runId: z.literal(approvedOriginalRunId),
    outcome: z.literal('recovered'),
    originalOutcome: z.literal('unreconciled'),
    originalNativeExitCode: z.literal(1),
    originalNativeCompletion: z.literal('failed'),
    recoveredAt: timestamp,
    readbackEvidence: z.literal(providerBudgetEvidencePaths.readbackEvidence),
    readbackEvidenceSha256: digest,
    originalReceiptArchive: z.literal(providerBudgetEvidencePaths.originalReceiptArchive),
    originalReceiptArchiveSha256: digest,
  })
  .refine((record) => Date.parse(record.recoveredAt) >= Date.parse(record.startedAt));
export type InitialProviderAdmission = z.infer<typeof initialProviderAdmissionSchema>;
export type RecoveredProviderAdmission = z.infer<typeof recoveredProviderAdmissionSchema>;
export interface ProviderBudgetContext {
  projectRef: string;
  target: string;
  sourceSha256: string;
  /** Capture existence at CLI entry, before the current run creates any manifest. */
  seedManifestPresent: boolean;
  initialAdmission: unknown;
  originalRunId?: string;
  /** Caller hashes these two fixed evidence paths; never resolves paths supplied by a record. */
  recoveryProof?: { readbackEvidenceSha256: string; originalReceiptArchiveSha256: string };
}
type BudgetMode = 'plan' | 'report' | 'initial_provider' | 'initial_non_provider' | 'youtube_continuation';
const contextSchema = z.strictObject({
  projectRef: z.literal(projectRef),
  target: z.literal(target),
  sourceSha256: digest,
  seedManifestPresent: z.boolean(),
  initialAdmission: z.unknown().optional(),
  originalRunId: z.string().optional(),
  recoveryProof: z
    .strictObject({ readbackEvidenceSha256: digest, originalReceiptArchiveSha256: digest })
    .optional(),
});
function reject(code: string): never {
  throw new SeedRuntimeError(code);
}

/** Independent of the global write lock: releasing it cannot restore a spent provider budget. */
export function assertProviderBudgetAction(action: SeedAction, context: ProviderBudgetContext): BudgetMode {
  const parsed = contextSchema.safeParse(context);
  if (!parsed.success) return reject('M02_PROVIDER_CONTEXT_REJECTED');
  const current = parsed.data;
  if (action === 'plan' || action === 'report') return action;
  if (action === 'resolve') {
    if (current.initialAdmission === undefined) return reject('M02_PROVIDER_ORIGINAL_ADMISSION_REQUIRED');
    if (current.originalRunId !== approvedOriginalRunId || !current.recoveryProof)
      return reject('M02_PROVIDER_RECOVERY_PROOF_REQUIRED');
    const recovered = recoveredProviderAdmissionSchema.safeParse(current.initialAdmission);
    if (
      !recovered.success ||
      recovered.data.sourceSha256 !== current.sourceSha256 ||
      recovered.data.readbackEvidenceSha256 !== current.recoveryProof.readbackEvidenceSha256 ||
      recovered.data.originalReceiptArchiveSha256 !== current.recoveryProof.originalReceiptArchiveSha256
    )
      return reject('M02_PROVIDER_RECOVERY_RECORD_REJECTED');
    return 'youtube_continuation';
  }
  // Even a malformed or empty existing record prevents replay. Read-only report remains available.
  if (current.initialAdmission !== undefined) return reject('M02_INITIAL_PROVIDER_BUDGET_ALREADY_CONSUMED');
  if (current.seedManifestPresent) return reject('M02_PROVIDER_REPLAY_REQUIRES_REVIEW');
  if (action === 'accept-dev' || action === 'probe') return 'initial_provider';
  if (action === 'seed' || action === 'websites' || action === 'logos') return 'initial_non_provider';
  return reject('M02_PROVIDER_ACTION_REJECTED');
}

export interface ProviderBudgetAdmissionOptions {
  initialAdmissionPath: string;
  continuationAdmissionPath: string;
  runId?: string;
  startedAt?: string;
}
export interface ProviderBudgetAdmissionIO {
  createExclusive: (path: string, record: InitialProviderAdmission) => Promise<void>;
  admitContinuation: (path: string, sourceSha256: string) => Promise<void>;
}
const admissionIO: ProviderBudgetAdmissionIO = {
  createExclusive: (path, record) =>
    writeFile(path, JSON.stringify(record) + '\n', { flag: 'wx', mode: 0o600 }),
  admitContinuation: admitYouTubeContinuation,
};

/** Admission records are never removed on success/failure; another live budget needs a reviewed packet. */
export async function admitProviderBudgetAction(
  action: SeedAction,
  context: ProviderBudgetContext,
  options: ProviderBudgetAdmissionOptions,
  io: ProviderBudgetAdmissionIO = admissionIO,
): Promise<{ mode: BudgetMode; youtubeMaxAttempts?: 1 | 4 }> {
  const mode = assertProviderBudgetAction(action, context);
  if (mode === 'initial_provider') {
    const record = initialProviderAdmissionSchema.safeParse({
      version: 1,
      projectRef: context.projectRef,
      target: context.target,
      sourceSha256: context.sourceSha256,
      runId: options.runId,
      startedAt: options.startedAt ?? new Date().toISOString(),
      initialBudgetConsumed: true,
      action,
      outcome: 'consumed',
    });
    if (!record.success) return reject('M02_INITIAL_PROVIDER_RECORD_INVALID');
    try {
      await io.createExclusive(options.initialAdmissionPath, record.data);
    } catch {
      return reject('M02_INITIAL_PROVIDER_ADMISSION_FAILED');
    }
    return { mode, youtubeMaxAttempts: 4 };
  }
  if (mode === 'youtube_continuation') {
    try {
      await io.admitContinuation(options.continuationAdmissionPath, context.sourceSha256);
    } catch {
      return reject('M02_YOUTUBE_CONTINUATION_ADMISSION_FAILED');
    }
    return { mode, youtubeMaxAttempts: 1 };
  }
  return { mode };
}
