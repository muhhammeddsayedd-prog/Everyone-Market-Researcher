export const VIMEO_FIELDS: string;
export type VimeoRequest = { method: 'GET'; url: string };
export type VimeoCollectorResult = {
  status: 'success' | 'failed';
  error: string | null;
  normalizedItems: Record<string, unknown>[];
  apiRequestCount: number;
  backfillDone: boolean;
  cursor: { endpoint: string; resourcePath: string; page: number } | null;
  fallback: { actor: string | null; blocked: true; reason: string; coverage: string } | null;
  resolvedExternalId: string | null;
  complete?: boolean;
};
export function vimeoEndpoint(account: Record<string, unknown>): {
  kind: string;
  resourcePath: string | null;
  externalId: string | null;
  resolvePath: string | null;
};
export function collectVimeoAccount(
  account: Record<string, unknown>,
  config: Record<string, unknown>,
  deps: { request: (request: VimeoRequest) => Promise<unknown>; wait: (ms: number) => Promise<void> },
): Promise<VimeoCollectorResult>;
