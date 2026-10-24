import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { buildCredentialProbe } from './build-credential-probes.mjs';

const binding = () => ({
  runtimeVersion: '2.43.5',
  environment: 'dev',
  instanceUrl: 'https://muhhammedsayed.app.n8n.cloud',
  projectId: 'pHvQjDmjxVZ3KQLT',
  workflowRefs: {},
  tagRefs: {},
  credentials: {
    postgres: {
      id: 'SyntheticPostgres',
      name: 'Supabase Postgres · n8n_writer · dev',
      type: 'postgres',
      environment: 'dev',
      projectRef: 'zmotjsbzhzjvpelxvxlf',
    },
    apify: { id: 'SyntheticApify', name: 'Apify account', type: 'apifyApi', environment: 'dev' },
    openai: { id: 'SyntheticOpenAI', name: 'OpenAI account', type: 'openAiApi', environment: 'dev' },
    vimeo: { id: 'SyntheticVimeo', name: 'Vimeo Token', type: 'httpHeaderAuth', environment: 'dev' },
    youtube: {
      id: 'SyntheticYouTube',
      name: 'YouTube Data API key',
      type: 'httpHeaderAuth',
      environment: 'dev',
    },
  },
});
const named = (w, name) => w.nodes.find((n) => n.name === name);
function runCode(n, json) {
  return JSON.parse(
    JSON.stringify(
      runInNewContext(
        `(function(){${n.parameters.jsCode}\n})()`,
        { $input: { all: () => [{ json }] } },
        { timeout: 1000 },
      ),
    ),
  );
}

test('temporary probes are manual-only inactive workflows with no invented foundation IDs or credential copying', () => {
  for (const service of ['postgres', 'apify', 'openai', 'vimeo', 'youtube']) {
    const r = buildCredentialProbe(binding(), service),
      w = r.workflow;
    assert.equal(r.hostedAcceptance, false);
    assert.equal(r.foundationAcceptance, false);
    assert.equal(r.temporaryProbeException, true);
    assert.equal(w.active, false);
    assert.equal(w.settings.timezone, 'Africa/Cairo');
    assert.equal(w.settings.executionTimeout, 900);
    assert.equal('id' in w, false);
    assert.equal('errorWorkflow' in w.settings, false);
    assert.equal(w.nodes.filter((n) => n.type === 'n8n-nodes-base.manualTrigger').length, 1);
    assert.ok(!w.nodes.some((n) => /scheduleTrigger|webhook|executeWorkflow|errorTrigger/.test(n.type)));
    assert.deepEqual(runCode(named(w, 'Validate manual probe'), {}), [{ json: { env: 'dev' } }]);
    assert.throws(() => runCode(named(w, 'Validate manual probe'), { env: 'prod' }), /EMR_N8N_INPUT_INVALID/);
    assert.throws(
      () => runCode(named(w, 'Validate manual probe'), { token: 'SYNTHETIC_PRIVATE_MARKER' }),
      /EMR_N8N_INPUT_INVALID/,
    );
    const b = binding();
    delete b.credentials[service];
    assert.throws(() => buildCredentialProbe(b, service), /EMR_N8N_BINDING_MISSING/);
  }
});

test('Postgres probe verifies direct native role identity and classifies TLS/auth/native failure without echoing details', () => {
  const w = buildCredentialProbe(binding(), 'postgres').workflow;
  const pg = named(w, 'Read native identity'),
    check = named(w, 'Project safe result');
  assert.equal(pg.typeVersion, 2.7);
  assert.equal(
    pg.parameters.query,
    "select current_user as current_user, session_user as session_user, current_database() as database, current_setting('server_version_num')::integer as server_version_num;",
  );
  assert.equal(pg.onError, 'continueRegularOutput');
  assert.equal(pg.retryOnFail, false);
  assert.deepEqual(
    runCode(check, {
      current_user: 'n8n_writer',
      session_user: 'n8n_writer',
      database: 'postgres',
      server_version_num: 170011,
    }),
    [
      {
        json: {
          service: 'postgres',
          status: 'verified',
          authenticationVerified: true,
          identityVerified: true,
          readOnly: true,
          projectTargetVerified: false,
        },
      },
    ],
  );
  for (const [payload, classification] of [
    [{ error: 'self-signed certificate in certificate chain SYNTHETIC_PRIVATE_MARKER' }, 'tls_failed'],
    [
      { message: 'self-signed certificate in certificate chain SYNTHETIC_PRIVATE_MARKER', error: {} },
      'tls_failed',
    ],
    [{ error: 'password authentication failed SYNTHETIC_PRIVATE_MARKER' }, 'authentication_failed'],
    [
      {
        current_user: 'postgres',
        session_user: 'postgres',
        database: 'postgres',
        server_version_num: 170011,
      },
      'identity_rejected',
    ],
    [{ error: { message: 'some raw native exception SYNTHETIC_PRIVATE_MARKER' } }, 'native_failed'],
  ]) {
    const result = runCode(check, payload)[0].json;
    assert.equal(result.status, classification);
    assert.equal(result.authenticationVerified, false);
    assert.equal(result.identityVerified, false);
    assert.ok(!JSON.stringify(result).includes('SYNTHETIC_PRIVATE_MARKER'));
  }
});

test('provider probes use existing typed credentials, exact GET metadata URLs, TLS and no redirects/body/retries', () => {
  const urls = {
    apify: 'https://api.apify.com/v2/users/me/limits',
    openai: 'https://api.openai.com/v1/models',
    vimeo: 'https://api.vimeo.com/users/everyonefilms?fields=uri',
    youtube:
      'https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=%40AflamProductions&fields=kind,items(id)',
  };
  for (const service of Object.keys(urls)) {
    const w = buildCredentialProbe(binding(), service).workflow,
      n = named(w, 'Read provider metadata'),
      c = binding().credentials[service];
    assert.equal(n.typeVersion, 4.5);
    assert.equal(n.parameters.method, 'GET');
    assert.equal(n.parameters.url, urls[service]);
    assert.deepEqual(n.credentials, { [c.type]: { id: c.id, name: c.name } });
    assert.equal(
      n.parameters.authentication,
      ['apify', 'openai'].includes(service) ? 'predefinedCredentialType' : 'genericCredentialType',
    );
    assert.equal(n.parameters.options.timeout, 60000);
    assert.equal(n.parameters.options.allowUnauthorizedCerts, false);
    assert.equal(n.parameters.options.redirect.redirect.followRedirects, false);
    assert.equal(n.parameters.options.sendCredentialsOnCrossOriginRedirect, false);
    assert.equal(n.parameters.sendBody, false);
    assert.equal(n.retryOnFail, false);
    assert.equal('bodyParameters' in n.parameters, false);
    assert.ok(!JSON.stringify(n.parameters).includes('$credentials'));
    assert.equal(new URL(n.parameters.url).searchParams.has('token'), false);
    assert.equal(new URL(n.parameters.url).searchParams.has('key'), false);
  }
});

test('metadata projections emit fixed receipts only and classify rejected responses without raw provider data', () => {
  const bodies = {
    apify: {
      data: {
        monthlyUsageCycle: { startAt: '2026-10-01T00:00:00Z', endAt: '2026-11-01T00:00:00Z' },
        limits: { maxMonthlyUsageUsd: 300 },
        current: { monthlyUsageUsd: 12 },
      },
    },
    openai: { object: 'list', data: [{ id: 'synthetic-model', owned_by: 'SYNTHETIC_PRIVATE_MARKER' }] },
    vimeo: { uri: '/users/syntheticPublicUser' },
    youtube: { kind: 'youtube#channelListResponse', items: [{ id: 'SyntheticChannel' }] },
  };
  for (const service of Object.keys(bodies)) {
    const check = named(buildCredentialProbe(binding(), service).workflow, 'Project safe result');
    const result = runCode(check, {
      statusCode: 200,
      body: bodies[service],
      headers: { 'synthetic-private': 'SYNTHETIC_PRIVATE_MARKER' },
    })[0].json;
    assert.deepEqual(result, {
      service,
      status: 'verified',
      authenticationVerified: true,
      metadataSchemaVerified: true,
      readOnly: true,
      actorStarted: false,
      inferencePerformed: false,
      budgetCapVerified: false,
    });
    assert.ok(!JSON.stringify(result).includes('SYNTHETIC_PRIVATE_MARKER'));
    for (const statusCode of [301, 401, 403, 429, 500]) {
      const failed = runCode(check, {
        statusCode,
        body: { error: { message: 'SYNTHETIC_PRIVATE_MARKER' } },
      })[0].json;
      assert.equal(failed.authenticationVerified, false);
      assert.equal(failed.metadataSchemaVerified, false);
      assert.ok(!JSON.stringify(failed).includes('SYNTHETIC_PRIVATE_MARKER'));
    }
    const tls = runCode(check, {
      error: { message: 'self-signed certificate chain SYNTHETIC_PRIVATE_MARKER' },
    })[0].json;
    assert.equal(tls.status, 'tls_failed');
    assert.equal(tls.authenticationVerified, false);
  }
});
