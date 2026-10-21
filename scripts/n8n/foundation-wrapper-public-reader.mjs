// Input is only the sealed PowerShell wrapper's already-projected stdout.
// This reader neither launches a process nor authorizes a command/window.
const fail = () => {
  throw Error('M03_PUBLIC_SUPERVISOR_PROTOCOL_BLOCKED');
};
const kinds = new Set([
  'm03_acceptance_transport_ready',
  'm03_acceptance_ready',
  'm03_acceptance_result',
  'm03_acceptance_closed',
  'mcp_port_request',
  'm03_acceptance_wrapper_closed',
]);
const wrapperKeys = [
  'kind',
  'childClosed',
  'credentialChildrenClosed',
  'emergencyShutdown',
  'nativeExit',
  'handoffsDeleted',
  'bypassHandoffDeleted',
  'pendingMachinePreserved',
  'privateRead',
  'code',
];
export function createFoundationWrapperPublicReader({ acknowledge = () => {} } = {}) {
  if (typeof acknowledge !== 'function') fail();
  let buffer = '',
    bytes = 0,
    blocked = false,
    acknowledged = false,
    wrapper = null;
  const frames = [];
  return Object.freeze({
    push(chunk) {
      if (blocked || typeof chunk !== 'string') fail();
      try {
        bytes += Buffer.byteLength(chunk, 'utf8');
        if (bytes > 2097152) fail();
        buffer += chunk;
        while (buffer.includes('\n')) {
          const at = buffer.indexOf('\n');
          const line = buffer.slice(0, at).replace(/\r$/, '');
          buffer = buffer.slice(at + 1);
          if (Buffer.byteLength(line, 'utf8') > 65536) fail();
          if (!line) continue;
          const frame = JSON.parse(line);
          if (wrapper || !frame || Array.isArray(frame) || !kinds.has(frame.kind)) fail();
          if (frame.kind === 'm03_acceptance_transport_ready') {
            if (
              acknowledged ||
              Object.keys(frame).length !== 4 ||
              typeof frame.nonce !== 'string' ||
              !/^[a-f0-9]{32}$/.test(frame.nonce) ||
              frame.privateRead !== false ||
              frame.networkRequests !== 0
            )
              fail();
            acknowledged = true;
            acknowledge({ kind: 'm03_acceptance_transport_ack', nonce: frame.nonce });
          }
          if (frame.kind === 'm03_acceptance_wrapper_closed') {
            if (
              Object.keys(frame).length !== wrapperKeys.length ||
              !wrapperKeys.every((key) => Object.hasOwn(frame, key)) ||
              !wrapperKeys
                .filter((key) => !['kind', 'nativeExit', 'code'].includes(key))
                .every((key) => typeof frame[key] === 'boolean') ||
              !(
                frame.nativeExit === null ||
                (Number.isInteger(frame.nativeExit) &&
                  frame.nativeExit >= -2147483648 &&
                  frame.nativeExit <= 2147483647)
              ) ||
              ![
                'M03_ACCEPTANCE_BLOCKED',
                'M03_ACCEPTANCE_CHILD_CLOSED',
                'M03_ACCEPTANCE_EMERGENCY_RESIDUAL',
              ].includes(frame.code)
            )
              fail();
            wrapper = Object.freeze(frame);
          }
          frames.push(Object.freeze(frame));
        }
        if (Buffer.byteLength(buffer, 'utf8') > 65536) fail();
      } catch {
        blocked = true;
        buffer = '';
        fail();
      }
    },
    drain: () => frames.splice(0),
    state: () =>
      Object.freeze({ blocked, acknowledged, wrapperReceipt: wrapper, partialLine: buffer.length !== 0 }),
  });
}
