// Deterministic local blueprints only. This build never connects to n8n, reads
// a credential, imports a workflow or grants live execution authority.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  buildNativeCollector,
  buildNativeCallback,
  buildNativeOrchestrator,
  buildNativeErrorHandler,
} from './build-native-collectors.mjs';

export function generateCollectorBlueprints() {
  const bindings = JSON.parse(
    readFileSync(new URL('../foundation/bindings.dev.json', import.meta.url), 'utf8'),
  );
  const selection = JSON.parse(readFileSync(new URL('./selection.dev.json', import.meta.url), 'utf8'));
  const transport = {
    audience: 'https://everyone-market-researcher-m04-binding-pending.vercel.app',
    credential: { id: 'EmrM03Machine19', name: 'M03 foundation machine [dev]', type: 'httpCustomAuth' },
  };
  return [
    buildNativeOrchestrator(bindings, transport, selection),
    buildNativeCollector(bindings, transport, 'vimeo'),
    buildNativeCollector(bindings, transport, 'instagram'),
    buildNativeCallback(bindings, transport),
    buildNativeErrorHandler(bindings, transport),
  ];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const directory = new URL('./blueprints/', import.meta.url);
  mkdirSync(directory, { recursive: true });
  for (const graph of generateCollectorBlueprints()) {
    writeFileSync(new URL(graph.key + '.json', directory), JSON.stringify(graph, null, 2) + '\n');
    process.stdout.write(graph.key + ' local blueprint generated; hostedAcceptance=false\n');
  }
}
