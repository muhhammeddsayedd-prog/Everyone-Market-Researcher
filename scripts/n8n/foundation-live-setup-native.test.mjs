import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createFoundationLiveSetupCliTransport } from './foundation-live-setup-transport.mjs';
import { createFoundationSetupProjectDiagnostic } from './foundation-live-setup-diagnostic.mjs';

const cli = join(process.env.APPDATA ?? '', 'npm/node_modules/vercel/dist/index.js');
for (const mode of ['valid', 'missing_identity', 'expired'])
  test(
    'installed pinned CLI with synthetic isolated auth, mocked fetch and no network: ' + mode,
    { skip: !existsSync(cli) },
    async () => {
      const root = mkdtempSync(join(tmpdir(), 'emr-vercel-native-')),
        config = join(root, 'config');
      mkdirSync(config);
      writeFileSync(
        join(config, 'config.json'),
        JSON.stringify({ credStorage: 'file', telemetry: { enabled: false } }),
      );
      writeFileSync(
        join(config, 'auth.json'),
        JSON.stringify({
          token: 'SyntheticVercelReadOnly47',
          ...(mode === 'missing_identity' ? {} : { userId: 'user_SyntheticOnly' }),
          expiresAt: Math.floor(Date.now() / 1000) + (mode === 'expired' ? -1 : 3600),
        }),
      );
      writeFileSync(join(config, 'telemetry-device.json'), JSON.stringify({ id: 'synthetic-device' }));
      writeFileSync(
        join(config, 'telemetry-session.json'),
        JSON.stringify({
          id: 'synthetic-session',
          createdAt: Date.now() - 1000,
          lastSeenAt: Date.now() - 1000,
        }),
      );
      const storageFiles = ['config.json', 'auth.json', 'telemetry-device.json', 'telemetry-session.json'];
      const originalStorage = storageFiles.map((name) => readFileSync(join(config, name), 'utf8'));
      let diagnostic,
        stderr = '',
        admissions = 0;
      const rows = [];
      const transport = createFoundationLiveSetupCliTransport(
        {
          nodeExecutable: process.execPath,
          cliPath: resolve(cli),
          noRetryPreloadPath: fileURLToPath(new URL('./foundation-live-setup-no-retry.mjs', import.meta.url)),
          workingDirectory: root,
          now: Date.now,
          deadlineAt: Date.now() + 20000,
          authorizeRequest: (s) => diagnostic?.authorizeRequest(s) === true,
        },
        {
          spawn(executable, args, options) {
            assert.equal(args[0], '--import');
            const child = spawn(
              executable,
              [
                '--import',
                new URL('./fixtures/foundation-vercel-native-preload.mjs', import.meta.url).href,
                ...args.slice(2),
                '--global-config',
                config,
              ],
              {
                ...options,
                env: {
                  SystemRoot: process.env.SystemRoot ?? '',
                  WINDIR: process.env.WINDIR ?? '',
                  APPDATA: process.env.APPDATA,
                  LOCALAPPDATA: root,
                  USERPROFILE: root,
                  HOME: root,
                  TEMP: root,
                  TMP: root,
                  XDG_CONFIG_HOME: root,
                  XDG_DATA_HOME: root,
                  XDG_CACHE_HOME: root,
                  VERCEL_TELEMETRY_DISABLED: '1',
                  NO_UPDATE_NOTIFIER: '1',
                  EMR_FOUNDATION_SETUP_METHOD: options.env.EMR_FOUNDATION_SETUP_METHOD,
                  EMR_FOUNDATION_SETUP_PATH: options.env.EMR_FOUNDATION_SETUP_PATH,
                  EMR_SYNTHETIC_VERCEL: 'isolated-no-network',
                  EMR_SYNTHETIC_VERCEL_ROOT: root,
                },
              },
            );
            child.stderr.on('data', (bytes) => {
              if (stderr.length < 65536) stderr += bytes;
            });
            return child;
          },
        },
      );
      diagnostic = createFoundationSetupProjectDiagnostic({
        transport,
        admitAttempt() {
          admissions++;
        },
        durableAppend(row) {
          rows.push(row);
        },
        now: Date.now,
        deadlineAt: Date.now() + 20000,
      });
      try {
        const result = await diagnostic.run();
        if (mode === 'valid' && result.status !== 'project_contract_ready') {
          assert.fail(
            JSON.stringify({
              fixtureFacts: existsSync(join(root, 'synthetic-wire-facts.json'))
                ? JSON.parse(readFileSync(join(root, 'synthetic-wire-facts.json'), 'utf8'))
                : null,
              preloadBlocked: stderr.includes('FOUNDATION_LIVE_SETUP_NO_RETRY_BLOCKED'),
              networkOrFileBlocked: stderr.includes('SYNTHETIC_NETWORK_OR_FILE_DENIED'),
              typeError: stderr.includes('TypeError'),
              syntaxError: stderr.includes('SyntaxError'),
              propertyRedefinition: stderr.includes('Cannot redefine property'),
              readOnlyProperty: stderr.includes('read only property'),
              readOnlyTarget:
                ['request', 'get', 'fetch', 'connect', 'readFile', 'writeFile', 'appendFile', 'mkdir'].find(
                  (name) => stderr.includes("read only property '" + name + "'"),
                ) ?? null,
              invalidArgument: stderr.includes('ERR_INVALID_ARG_TYPE'),
              streamCallback: stderr.includes('callback'),
              publicCodeFrames: [...stderr.matchAll(/[\\/]([A-Za-z0-9_.-]+\.(?:mjs|js)):(\d+):(\d+)/g)]
                .slice(0, 8)
                .map((match) => ({ file: match[1], line: Number(match[2]) })),
            }),
          );
        }
        assert.equal(result.status, mode === 'valid' ? 'project_contract_ready' : 'transport_rejected');
        assert.equal(result.transport.stage, mode === 'valid' ? 'completed' : 'native_exit');
        assert.equal(result.transport.childClosed, true);
        assert.equal(result.transport.httpStatus, mode === 'valid' ? 200 : null);
        assert.equal(
          result.transport.code,
          mode === 'valid'
            ? 'unknown'
            : mode === 'expired'
              ? 'saved_auth_expired'
              : 'auxiliary_scope_refusal',
        );
        assert.equal(admissions, 1);
        assert.equal(rows.length, 2);
        assert.equal(JSON.stringify(result).includes('SYNTHETIC_RAW_DTO_MUST_STAY_PRIVATE'), false);
        const facts = JSON.parse(readFileSync(join(root, 'synthetic-wire-facts.json'), 'utf8'));
        assert.deepEqual(facts, {
          fetchCalls: mode === 'valid' ? 1 : 0,
          matchingAuthorization: mode === 'valid',
          blockedNetwork: 0,
          blockedFileAccess: 0,
          blockedFileKind: null,
          blockedKeyringLoads: 0,
        });
        assert.equal(transport.state().pendingRequests, 0);
        for (let i = 0; i < storageFiles.length; i++)
          assert.equal(
            readFileSync(join(config, storageFiles[i]), 'utf8') === originalStorage[i],
            true,
            'synthetic storage remains byte-identical: ' + storageFiles[i],
          );
      } finally {
        transport.close();
        assert.equal(transport.state().pendingRequests, 0);
        rmSync(root, { recursive: true, force: true });
      }
    },
  );
