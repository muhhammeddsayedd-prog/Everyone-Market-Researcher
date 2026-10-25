import { readFileSync, lstatSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname, parse, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// The exact physical compiler file, this helper and the checked-in reference
// are public inputs pinned before the administrator password is decrypted.
const repo = fileURLToPath(new URL('../../', import.meta.url));
const compiler = resolve(
  repo,
  'node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js',
);
const ts = createRequire(import.meta.url)(compiler);
function propertyName(node) {
  return node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) ? node.name.text : '';
}
function shape(node) {
  // Grouping is already represented by the parsed child tree. The generator
  // and formatter may add/remove this transparent wrapper around the same type.
  if (ts.isParenthesizedTypeNode(node)) return shape(node.type);
  const scalar =
    ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node) ? node.text : null;
  if (ts.isPropertySignature(node))
    return ['property', propertyName(node), !!node.questionToken, node.type ? shape(node.type) : null];
  if (ts.isPropertyAssignment(node)) return ['assignment', propertyName(node), shape(node.initializer)];
  const children = [];
  ts.forEachChild(node, (child) => {
    children.push(shape(child));
  });
  if (ts.isTypeLiteralNode(node)) children.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return [node.kind, scalar, ...children];
}
export function verifyFoundationTypes(candidate, reference) {
  const parsed = [candidate, reference].map((source) =>
    ts.createSourceFile('db.types.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS),
  );
  if (parsed.some((source) => source.parseDiagnostics.length)) throw Error('FOUNDATION_TYPES_BLOCKED');
  const database = parsed[0].statements.find(
    (node) => ts.isTypeAliasDeclaration(node) && node.name.text === 'Database',
  );
  if (!database || !ts.isTypeLiteralNode(database.type)) throw Error('FOUNDATION_TYPES_BLOCKED');
  const schemas = new Map(database.type.members.map((node) => [propertyName(node), node.type]));
  if (
    schemas.size !== 4 ||
    ['app', 'api', 'ops', 'ingest'].some(
      (name) => !schemas.has(name) || !ts.isTypeLiteralNode(schemas.get(name)),
    )
  )
    throw Error('FOUNDATION_TYPES_BLOCKED');
  const sections = new Map(schemas.get('ops').members.map((node) => [propertyName(node), node.type]));
  const tables = new Set(sections.get('Tables')?.members?.map(propertyName));
  const functions = new Set(sections.get('Functions')?.members?.map(propertyName));
  if (
    [
      'apify_launch_approvals',
      'apify_launch_admissions',
      'foundation_gateway_rate_windows',
      'foundation_gateway_requests',
      'foundation_gateway_leases',
      'foundation_gateway_run_bindings',
    ].some((name) => !tables.has(name)) ||
    [
      'get_apify_launch',
      'authorize_apify_launch',
      'reconcile_apify_launch',
      'reject_apify_callback',
      'foundation_gateway_admit',
      'foundation_gateway_execute',
      'foundation_gateway_status',
      'foundation_gateway_read_context',
      'foundation_gateway_complete_read',
    ].some((name) => !functions.has(name))
  )
    throw Error('FOUNDATION_TYPES_BLOCKED');
  const astEquivalent = JSON.stringify(shape(parsed[0])) === JSON.stringify(shape(parsed[1]));
  if (!astEquivalent) throw Error('FOUNDATION_TYPES_BLOCKED');
  return Object.freeze({
    status: 'types_coverage_verified',
    schemas: 4,
    foundationTables: 6,
    foundationFunctions: 9,
    astEquivalent: true,
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    let candidateRelative = 'scripts/db/out/m03-foundation-hosted-db.types.ts';
    if (args.length !== 0) {
      if (
        args.length !== 2 ||
        args[0] !== 'Continuation' ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(args[1])
      )
        throw Error('blocked');
      candidateRelative = `scripts/db/out/m03-foundation-continuation-${args[1]}-db.types.ts`;
    }
    const physicalFile = (relative) => {
      const path = resolve(repo, relative);
      if (!path.startsWith(resolve(repo) + sep)) throw Error('blocked');
      const stat = lstatSync(path);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size < 1 || stat.size > 1048576)
        throw Error('blocked');
      for (let parent = dirname(path); ; parent = dirname(parent)) {
        const entry = lstatSync(parent);
        if (!entry.isDirectory() || entry.isSymbolicLink()) throw Error('blocked');
        if (parent === parse(parent).root) break;
      }
      return path;
    };
    const candidate = physicalFile(candidateRelative);
    process.stdout.write(
      JSON.stringify(
        verifyFoundationTypes(
          readFileSync(candidate, 'utf8'),
          readFileSync(physicalFile('packages/shared/src/db.types.ts'), 'utf8'),
        ),
      ) + '\n',
    );
  } catch {
    process.stdout.write('FOUNDATION_TYPES_BLOCKED\n');
    process.exitCode = 1;
  }
}
