// Private values enter only a future reviewed bounded child. No credential read,
// network, storage, token generation, hashing or logging occurs in this builder.
const checked = new WeakMap();
const fail = () => {
  throw Error('FOUNDATION_RUNTIME_MACHINE_BLOCKED');
};
function host(audience) {
  if (
    typeof audience !== 'string' ||
    !/^https:\/\/everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(audience)
  )
    fail();
  return new URL(audience).hostname;
}
export function prepareFoundationRuntimeMachinePatch(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some(
      (k) => !['audience', 'restore', 'machineToken', 'protectionBypass'].includes(k),
    ) ||
    typeof input.restore !== 'boolean' ||
    typeof input.machineToken !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(input.machineToken) ||
    (input.restore
      ? Object.hasOwn(input, 'protectionBypass')
      : typeof input.protectionBypass !== 'string' ||
        !/^[A-Za-z0-9_-]{16,1024}$/.test(input.protectionBypass))
  )
    fail();
  const allowedDomains = host(input.audience);
  const headers = { Authorization: 'Bearer ' + input.machineToken };
  if (!input.restore) headers['x-vercel-protection-bypass'] = input.protectionBypass;
  const patch = Object.freeze({
    isPartialData: true,
    data: Object.freeze({
      allowedHttpRequestDomains: 'domains',
      allowedDomains,
      json: JSON.stringify({ headers }),
    }),
  });
  checked.set(patch, Object.freeze({ audience: input.audience, restore: input.restore }));
  return patch;
}
export function assertFoundationRuntimeMachinePatch(patch, { audience, restore }) {
  const known = checked.get(patch);
  if (
    !known ||
    known.audience !== audience ||
    known.restore !== restore ||
    patch.isPartialData !== true ||
    patch.data.allowedHttpRequestDomains !== 'domains' ||
    patch.data.allowedDomains !== host(audience)
  )
    fail();
  return patch;
}
