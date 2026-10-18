import { createSessionState, type Identity } from './sessions';

const IDENTITIES: Identity[] = ['member', 'admin', 'disabled', 'outsider'];

export default async function globalSetup() {
  for (const identity of IDENTITIES) await createSessionState(identity);
}
