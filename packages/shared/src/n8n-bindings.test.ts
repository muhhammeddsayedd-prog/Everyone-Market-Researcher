import { describe, expect, it } from 'vitest';
import {
  parseN8nBindings,
  parseCollectorStubInput,
  parseHealthInput,
  httpCredentialBinding,
} from './n8n-bindings';

const fixture = () => ({
  runtimeVersion: '2.43.5',
  environment: 'dev',
  instanceUrl: 'https://muhhammedsayed.app.n8n.cloud',
  projectId: 'pHvQjDmjxVZ3KQLT',
  workflowRefs: { 'WF-90': { id: 'SyntheticWf90Id', name: 'WF-90 · Error handler [dev]' } },
  tagRefs: { 'env:dev': { id: 'SyntheticDevTag', name: 'env:dev' } },
});

describe('M03 logical native credential compatibility', () => {
  const providers = () => ({
    apify: { id: 'SyntheticApify', name: 'Apify account', type: 'apifyApi', environment: 'dev' },
    openai: { id: 'SyntheticOpenAI', name: 'Existing OpenAI account', type: 'openAiApi', environment: 'dev' },
    vimeo: { id: 'SyntheticVimeo', name: 'Vimeo Token', type: 'httpHeaderAuth', environment: 'dev' },
    youtube: {
      id: 'SyntheticYouTube',
      name: 'YouTube Data API key',
      type: 'httpHeaderAuth',
      environment: 'dev',
    },
  });
  it('preserves actual native types and display names rather than requiring a replacement Header Auth credential', () => {
    const b = { ...fixture(), credentials: providers() };
    expect(parseN8nBindings(b).credentials?.apify?.name).toBe('Apify account');
    for (const service of ['apify', 'openai'] as const) {
      const p = providers()[service],
        auth = httpCredentialBinding(b, service);
      expect(auth.parameters).toEqual({
        authentication: 'predefinedCredentialType',
        nodeCredentialType: p.type,
      });
      expect(auth.credentials).toEqual({ [p.type]: { id: p.id, name: p.name } });
      expect('httpHeaderAuth' in auth.credentials).toBe(false);
    }
    for (const service of ['vimeo', 'youtube'] as const)
      expect(httpCredentialBinding(b, service).parameters).toEqual({
        authentication: 'genericCredentialType',
        genericAuthType: 'httpHeaderAuth',
      });
  });
  it('rejects type mismatches, secret-bearing properties and duplicate logical credential IDs', () => {
    for (const service of ['apify', 'openai', 'vimeo', 'youtube'] as const) {
      const p = providers();
      expect(() =>
        parseN8nBindings({
          ...fixture(),
          credentials: { ...p, [service]: { ...p[service], type: 'httpQueryAuth' } },
        }),
      ).toThrow(/^EMR_N8N_BINDINGS_INVALID$/);
      expect(() =>
        parseN8nBindings({
          ...fixture(),
          credentials: { ...p, [service]: { ...p[service], apiKey: 'SYNTHETIC_PRIVATE_MARKER' } },
        }),
      ).toThrow(/^EMR_N8N_BINDINGS_INVALID$/);
    }
    const p = providers();
    expect(() =>
      parseN8nBindings({ ...fixture(), credentials: { ...p, youtube: { ...p.youtube, id: p.vimeo.id } } }),
    ).toThrow(/^EMR_N8N_BINDINGS_INVALID$/);
    expect(() => httpCredentialBinding(fixture(), 'apify')).toThrow(/^EMR_N8N_BINDING_MISSING$/);
  });
});

describe('M03 non-secret dev binding manifest boundary', () => {
  it('accepts the explicitly synthetic local fixture', () => {
    expect(parseN8nBindings(fixture()).environment).toBe('dev');
  });

  it.each([
    { environment: 'prod' },
    { runtimeVersion: '2.36.8' },
    { instanceUrl: 'https://another.app.n8n.cloud' },
    { projectId: 'another-project' },
    { password: 'SYNTHETIC_PRIVATE_MARKER' },
    { workflowRefs: { 'WF-14': { id: 'SyntheticRemoved', name: 'Removed workflow' } } },
    { workflowRefs: { 'WF-90': { id: 'SyntheticWf90Id', name: 'WF-90 · Error handler [prod]' } } },
    { tagRefs: { 'env:prod': { id: 'SyntheticProdTag', name: 'env:prod' } } },
    { tagRefs: { 'env:dev': { id: 'SyntheticDevTag', name: 'env:prod' } } },
    { credentials: { postgres: { id: 'SyntheticPgId', name: 'postgres administrator' } } },
    {
      credentials: {
        postgres: {
          id: 'SyntheticPgId',
          name: 'Supabase Postgres · n8n_writer · dev',
          type: 'postgres',
          environment: 'dev',
          projectRef: 'hkiafqrcxaafdbcvjlzv',
        },
      },
    },
  ])('rejects wrong targets and secret/unknown properties without echoing values', (change) => {
    expect(() => parseN8nBindings({ ...fixture(), ...change })).toThrow(/^EMR_N8N_BINDINGS_INVALID$/);
  });

  it('rejects duplicate workflow IDs under different canonical names', () => {
    expect(() =>
      parseN8nBindings({
        ...fixture(),
        workflowRefs: {
          'WF-90': { id: 'SyntheticSameId', name: 'WF-90 · Error handler [dev]' },
          'WF-30': { id: 'SyntheticSameId', name: 'WF-30 · AI extractor [dev]' },
        },
      }),
    ).toThrow(/^EMR_N8N_BINDINGS_INVALID$/);
  });

  it('keeps WF70 tags and WF80 kind instead of silently discarding caller input', () => {
    expect(parseCollectorStubInput('WF-70', { tags: ['feed', 'stats'] })).toMatchObject({
      tags: ['feed', 'stats'],
      env: 'dev',
    });
    expect(parseCollectorStubInput('WF-80', { kind: 'budget' })).toMatchObject({
      kind: 'budget',
      env: 'dev',
    });
    expect(() => parseCollectorStubInput('WF-80', { kind: 'unknown' })).toThrow('EMR_N8N_INPUT_INVALID');
    expect(() => parseCollectorStubInput('WF-70', { tags: ['Authorization: synthetic'] })).toThrow(
      'EMR_N8N_INPUT_INVALID',
    );
    expect(() => parseCollectorStubInput('WF-11', { tags: ['feed'] })).toThrow('EMR_N8N_INPUT_INVALID');
  });

  it('accepts the health standard dispatch fields and rejects unsupported modes or extra properties', () => {
    expect(parseHealthInput({ mode: 'daily', limit: null, result_type: null, env: 'dev' })).toEqual({
      mode: 'daily',
      limit: null,
      result_type: null,
      env: 'dev',
    });
    expect(() => parseHealthInput({ mode: 'backfill' })).toThrow('EMR_N8N_INPUT_INVALID');
    expect(() => parseHealthInput({ env: 'prod' })).toThrow('EMR_N8N_INPUT_INVALID');
    expect(() => parseHealthInput({ raw_error: 'SYNTHETIC_PRIVATE_MARKER' })).toThrow(
      'EMR_N8N_INPUT_INVALID',
    );
  });
});
