import { assertFoundationLiveSetupTransport } from './foundation-live-setup-transport.mjs';

const path = '/v9/projects/prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu?teamId=team_gboXPxTevpCOZuaA8eY9PmR1';
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const fail = () => {
  throw Error('FOUNDATION_SETUP_DIAGNOSTIC_BLOCKED');
};
export function projectFoundationSetupPredicates(dto) {
  const bypass = dto?.protectionBypass ?? {};
  return Object.freeze({
    object: object(dto),
    projectId: dto?.id === 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
    teamId: dto?.accountId === 'team_gboXPxTevpCOZuaA8eY9PmR1',
    rootDirectory: dto?.rootDirectory === 'apps/web',
    nodeVersion: dto?.nodeVersion === '24.x',
    framework: dto?.framework === 'nextjs',
    githubType: dto?.link?.type === 'github',
    githubOrg: dto?.link?.org === 'muhhammeddsayedd-prog',
    githubRepo: dto?.link?.repo === 'Everyone-Market-Researcher',
    deploymentProtection: dto?.ssoProtection?.deploymentType === 'all_except_custom_domains',
    bypassObject: object(bypass),
    bypassEmpty: object(bypass) && Object.keys(bypass).length === 0,
  });
}

// Construction/import grants no authority and starts no clock. A future owner
// must supply an already-authorized, durable aggregate admission/journal port.
// This consumer cannot read handoffs, mutate Vercel, renew a window or retry.
export function createFoundationSetupProjectDiagnostic({
  transport,
  admitAttempt,
  durableAppend,
  now,
  deadlineAt,
}) {
  assertFoundationLiveSetupTransport(transport);
  if (
    typeof admitAttempt !== 'function' ||
    typeof durableAppend !== 'function' ||
    typeof now !== 'function' ||
    !Number.isSafeInteger(deadlineAt) ||
    deadlineAt <= now() ||
    typeof transport.diagnostics !== 'function'
  )
    fail();
  let used = false,
    current = null;
  const append = (row) => {
    if (durableAppend(Object.freeze(row)) !== undefined) fail();
  };
  return Object.freeze({
    authorizeRequest: (spec) => spec === current,
    async run() {
      if (used || now() >= deadlineAt) fail();
      used = true;
      if (admitAttempt(Object.freeze({ host: 'api.vercel.com', method: 'GET', path })) !== undefined) fail();
      append({ event: 'setup_project_diagnostic_intent', method: 'GET', at: now() });
      current = {
        method: 'GET',
        path,
        signal: AbortSignal.timeout(Math.max(1, Math.min(20000, deadlineAt - now()))),
      };
      let response,
        predicates = null,
        status = 'transport_rejected';
      try {
        response = await transport.request(current);
        if (response?.closed !== true || !Number.isInteger(response.status)) fail();
        status = 'project_http_rejected';
        if (response.status === 200) {
          predicates = projectFoundationSetupPredicates(response.data);
          status = Object.values(predicates).every((v) => v === true)
            ? 'project_contract_ready'
            : 'project_contract_rejected';
        }
      } catch {
        /* Only the bounded technical transport projection may escape. */
      } finally {
        current = null;
        response = null;
      }
      const receipt = Object.freeze({
        event: 'setup_project_diagnostic_result',
        status,
        at: now(),
        transport: transport.diagnostics(),
        predicates,
      });
      append(receipt);
      return receipt;
    },
    close: () => transport.close(),
  });
}
