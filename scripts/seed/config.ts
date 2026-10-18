import type { Options } from 'postgres';

export const seedTargets = {
  dev: { ref: 'zmotjsbzhzjvpelxvxlf', host: 'aws-1-eu-central-1.pooler.supabase.com' },
  prod: { ref: 'hkiafqrcxaafdbcvjlzv', host: 'aws-1-eu-central-1.pooler.supabase.com' },
} as const;
export type SeedTarget = keyof typeof seedTargets;
export type SeedAction =
  'plan' | 'seed' | 'probe' | 'resolve' | 'websites' | 'logos' | 'report' | 'accept-dev';
export class SeedRuntimeError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'SeedRuntimeError';
  }
}
function reject(code: string): never {
  throw new SeedRuntimeError(code);
}

/** Arguments are non-secret switches only. Never echo rejected input. */
export function parseCommand(args: string[]): { action: SeedAction; target: SeedTarget; apply: boolean } {
  const actions: SeedAction[] = [
    'plan',
    'seed',
    'probe',
    'resolve',
    'websites',
    'logos',
    'report',
    'accept-dev',
  ];
  const action = (args[0] ?? 'plan') as SeedAction;
  if (!actions.includes(action)) return reject('M02_COMMAND_REJECTED');
  let target: SeedTarget = 'dev';
  let targetSeen = false;
  let apply = false;
  for (let index = 1; index < args.length; index++) {
    if (args[index] === '--target' && !targetSeen) {
      const value = args[++index];
      if (value !== 'dev' && value !== 'prod') return reject('M02_COMMAND_REJECTED');
      target = value;
      targetSeen = true;
    } else if (args[index] === '--apply' && !apply) apply = true;
    else return reject('M02_COMMAND_REJECTED');
  }
  const writes = ['seed', 'resolve', 'websites', 'logos', 'accept-dev'].includes(action);
  if (writes !== apply) return reject('M02_EXPLICIT_APPLY_REQUIRED');
  // M01's approved production baseline does not authorize M02's production seed.
  if (target === 'prod') return reject('M02_PRODUCTION_NOT_APPROVED');
  return { action, target, apply };
}

/** Password is passed only in the owner's bounded child environment, never in this URI. */
export function databaseConfig(target: SeedTarget, env: Record<string, string | undefined>, ca?: string) {
  if (target !== 'dev') return reject('M02_PRODUCTION_NOT_APPROVED');
  const selected = seedTargets[target];
  if (!env.SEED_DATABASE_URL) return reject('M02_DATABASE_URL_NOT_PRESENT');
  let url: URL;
  try {
    url = new URL(env.SEED_DATABASE_URL);
  } catch {
    return reject('M02_DATABASE_TARGET_REJECTED');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.hostname !== selected.host ||
    url.port !== '5432' ||
    url.username !== `postgres.${selected.ref}` ||
    url.password ||
    url.pathname !== '/postgres' ||
    url.hash ||
    url.searchParams.getAll('sslmode').length !== 1 ||
    url.searchParams.get('sslmode') !== 'require' ||
    [...url.searchParams.keys()].some((key) => key !== 'sslmode')
  ) {
    return reject('M02_DATABASE_TARGET_REJECTED');
  }
  if (!env.PGPASSWORD) return reject('M02_PASSWORD_NOT_PRESENT');
  if (!ca) return reject('M02_PUBLIC_CA_NOT_PRESENT');
  const options: Options<Record<string, never>> = {
    host: selected.host,
    port: 5432,
    username: `postgres.${selected.ref}`,
    database: 'postgres',
    password: env.PGPASSWORD,
    ssl: { ca, rejectUnauthorized: true, servername: selected.host, minVersion: 'TLSv1.2' },
    max: 1,
    prepare: false,
    connect_timeout: 15,
    idle_timeout: 10,
    max_lifetime: 1_800,
    connection: { application_name: 'emr-m02-owner-seed', statement_timeout: 30_000, lock_timeout: 5_000 },
    onnotice: () => {},
    debug: false,
  };
  return { target: `supabase:${selected.ref}:postgres`, ref: selected.ref, options };
}
