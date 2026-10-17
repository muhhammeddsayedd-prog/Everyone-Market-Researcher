"""Validate this installation without running imported helpers or provider calls.

Default: offline hashes, local references, policies and credential-pattern checks.
--discovery additionally uses only initialize + skills/list on local Codex stdio.
--setup-boundaries audits the original setup-only preservation snapshot. Use it
for the installation receipt, not as a blocker for later authorized development.
"""
from pathlib import Path
from collections import Counter
import argparse
import hashlib
import json
import queue
import re
import subprocess
import threading
import time
import urllib.parse

ROOT = Path(__file__).resolve().parents[1]
RECEIPTS = ROOT / '.agents/skill-receipts'
SKILLS = ROOT / '.agents/skills'
EXPLICIT = {'spec-driven-development', 'constraint-driven-development', 'vercel-optimize'}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def discover():
    process = subprocess.Popen(['codex', 'app-server', '--stdio'], cwd=ROOT,
                               stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                               stderr=subprocess.DEVNULL, text=True, encoding='utf-8')
    output = queue.Queue()

    def reader():
        for line in process.stdout:
            output.put(line)

    threading.Thread(target=reader, daemon=True).start()

    def request(identifier, method, params):
        process.stdin.write(json.dumps({'id': identifier, 'method': method, 'params': params}) + '\n')
        process.stdin.flush()
        deadline = time.monotonic() + 25
        while time.monotonic() < deadline:
            try:
                message = json.loads(output.get(timeout=1))
            except queue.Empty:
                continue
            if message.get('id') == identifier:
                if 'error' in message:
                    raise RuntimeError(f'Local {method} returned an error')
                return message['result']
        raise TimeoutError('Local discovery timed out')

    try:
        request(1, 'initialize', {'clientInfo': {'name': 'emr-skill-validation', 'version': '1.0.0'},
                                  'capabilities': {'experimentalApi': True}})
        process.stdin.write('{"method":"initialized","params":{}}\n')
        process.stdin.flush()
        result = request(2, 'skills/list', {'cwds': [str(ROOT)], 'forceReload': True})
        entry = next(item for item in result['data'] if Path(item['cwd']) == ROOT)
        local = [s for s in entry['skills'] if Path(s['path']).is_relative_to(SKILLS)]
        errors = [e for e in entry.get('errors', []) if Path(e['path']).is_relative_to(ROOT)]
        names = {s['name'] for s in local}
        collisions = {name: count for name, count in Counter(s['name'] for s in entry['skills']).items()
                      if name in names and count > 1}
        version = subprocess.run(['codex', '--version'], capture_output=True, text=True,
                                 check=True).stdout.strip()
        return {'date': '2026-10-17', 'cli_version': version, 'method': 'initialize; skills/list forceReload=true',
                'skills': local, 'project_errors': errors, 'exact_name_collisions': collisions,
                'scope': 'Local parser/discovery only; no model turn, provider, workflow, or helper execution.'}
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--discovery', action='store_true')
    parser.add_argument('--setup-boundaries', action='store_true')
    args = parser.parse_args()
    lock = json.loads((ROOT / 'SKILLS_LOCK.json').read_text(encoding='utf-8'))
    before = json.loads((RECEIPTS / 'before-setup.json').read_text(encoding='utf-8'))
    failures = []

    def check(condition, message):
        if not condition:
            failures.append(message)

    for path, expected in lock['files'].items():
        target = ROOT / path
        check(target.is_file() and sha(target) == expected, 'Hash mismatch/missing: ' + path)
    owned = {p.relative_to(ROOT).as_posix() for base in [SKILLS, ROOT / '.agents/references']
             for p in base.rglob('*') if p.is_file()}
    check(owned <= set(lock['files']), 'Unrecorded installed skill/reference files')
    manifests = sorted(SKILLS.glob('*/SKILL.md'))
    expected_names = {entry['name'] for entry in lock['installed']}
    names = []
    for path in manifests:
        text = path.read_text(encoding='utf-8')
        check(text.startswith('---\n'), 'Missing frontmatter: ' + path.parent.name)
        match = re.search(r'^name:\s*([^\n]+)$', text, re.M)
        name = match.group(1).strip().strip('\"\x27') if match else ''
        names.append(name)
        check(name == path.parent.name, 'Manifest/directory name mismatch: ' + path.parent.name)
        check(bool(re.search(r'^description:\s*\S', text, re.M)), 'Missing description: ' + name)
        check('../../PROJECT_SKILL_RULES.md' in text, 'Missing project scope: ' + name)
        if name in EXPLICIT:
            policy = path.parent / 'agents/openai.yaml'
            check(policy.is_file() and re.search(r'^policy:\n  allow_implicit_invocation: false\s*$',
                                                policy.read_text(encoding='utf-8')),
                  'Explicit-only policy missing/changed: ' + name)
    check(len(names) == len(set(names)) == lock['installed_count'] and set(names) == expected_names,
          'Expected exactly the cleared unique names recorded in the lock')
    check(not (SKILLS / 'n8n-skills').exists(), 'Pending n8n pack must not be discoverable')
    check(not list((RECEIPTS / 'pending').rglob('SKILL.md')), 'Pending receipt contains discoverable manifest')

    link_count = 0
    inline_count = 0
    illustrative_or_generated_paths = 0
    for base in [SKILLS, ROOT / '.agents/references']:
        for path in base.rglob('*.md'):
            text = path.read_text(encoding='utf-8')
            # Examples inside fenced code are illustrative, not bundled resources.
            prose = re.sub(r'^(`{3,}|~{3,}).*?^\1\s*$', '', text, flags=re.M | re.S)
            for target in re.findall(r'!?\[[^\]\n]*\]\(([^)\n]+)\)', prose):
                target = target.strip().split(' "')[0].strip('<>')
                if not target or target.startswith(('#', 'http:', 'https:', 'mailto:', 'data:')):
                    continue
                local = urllib.parse.unquote(target.split('#')[0])
                link_count += 1
                check((path.parent / local).exists(), 'Broken local Markdown link: ' +
                      path.relative_to(ROOT).as_posix() + ' -> ' + local)
            for local in re.findall(r'`((?:\.\./)+(?:references/)?[^`\s]+\.(?:md|json|yaml))`', prose):
                inline_count += 1
                check((path.parent / local).exists(), 'Broken inline resource: ' +
                      path.relative_to(ROOT).as_posix() + ' -> ' + local)
            # Taste documents its bundled resources as inline code paths.
            for local in re.findall(r'`((?:references|scripts|assets|library|evals)/[^`\s]+\.(?:md|json|mjs|js|css))`', prose):
                skill_root = next((parent for parent in path.parents if (parent / 'SKILL.md').is_file()), path.parent)
                generated = next((entry.get('generated_resources', []) for entry in lock['installed']
                                  if entry['name'] == skill_root.name), [])
                if re.search(r'<[^>]+>', local) or local in generated:
                    illustrative_or_generated_paths += 1
                    continue
                inline_count += 1
                check((path.parent / local).exists() or (skill_root / local).exists(), 'Broken bundled resource: ' +
                      path.relative_to(ROOT).as_posix() + ' -> ' + local)

    modified = []
    allowed_edits = {'AGENTS.md', 'PROGRESS.md', 'milestones/M00-repo-bootstrap/PROGRESS.md'}
    for relative, expected in before['initial_project_files'].items():
        target = ROOT / relative
        if not target.is_file() or sha(target) != expected:
            modified.append(relative)
            if args.setup_boundaries:
                check(relative in allowed_edits, 'Unintended handoff change: ' + relative)
    if args.setup_boundaries:
        for record in before['existing_skill_manifests']:
            target = Path(record['path'])
            check(target.is_file() and sha(target) == record['sha256'], 'Existing/global skill changed: ' + str(target))
        check(not (ROOT / '.git').exists(), 'Git repository was initialized during setup')
        for directory in ['apps', 'packages', 'supabase', 'n8n', 'node_modules']:
            check(not (ROOT / directory).exists(), 'Unexpected development directory: ' + directory)

    # A targeted credential-pattern check, not an exhaustive security audit.
    patterns = {
        'openai-project-key': r'sk-proj-[A-Za-z0-9_-]{40,}',
        'supabase-secret-key': r'sb_secret_[A-Za-z0-9_-]{30,}',
        'github-token': r'(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{70,})',
        'aws-access-key': r'AKIA[A-Z0-9]{16}',
        'private-key': r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    }
    scanned = 0
    for base in [SKILLS, ROOT / '.agents/references']:
        for path in base.rglob('*'):
            if not path.is_file():
                continue
            check(not path.is_symlink(), 'Unexpected symlink: ' + path.relative_to(ROOT).as_posix())
            check(path.name not in {'.env', '.mcp.json', 'settings.json', 'hooks.json'},
                  'Unreviewed config/credential/hook file: ' + path.relative_to(ROOT).as_posix())
            text = path.read_text(encoding='utf-8')
            scanned += 1
            for rule, pattern in patterns.items():
                check(not re.search(pattern, text), 'Credential-pattern finding: ' + rule + ' at ' +
                      path.relative_to(ROOT).as_posix())

    discovery = None
    if args.discovery:
        discovery = discover()
        found = {s['name'] for s in discovery['skills']}
        check(found == expected_names, 'Native discovery name set mismatch')
        check(not discovery['project_errors'], 'Native frontmatter/metadata parse errors')
        check(not discovery['exact_name_collisions'], 'Native discovery exact-name collisions')
        check(all(s['scope'] == 'repo' and s['enabled'] for s in discovery['skills']),
              'Native discovery must show enabled repo-scoped skills')
        (RECEIPTS / 'discovery.json').write_text(json.dumps(discovery, indent=2, ensure_ascii=False) + '\n',
                                               encoding='utf-8')
    report = {'date': '2026-10-17', 'passed': not failures, 'installed_count': len(names),
              'locked_files': len(lock['files']), 'markdown_local_links': link_count,
              'inline_relative_resources': inline_count, 'explicit_only': sorted(EXPLICIT),
              'illustrative_or_generated_paths_excluded': illustrative_or_generated_paths,
              'setup_boundaries_checked': args.setup_boundaries,
              'preserved_global_manifests': len(before['existing_skill_manifests']) if args.setup_boundaries else None,
              'initial_project_files': len(before['initial_project_files']),
              'changed_existing_files': modified, 'credential_pattern_scanned_files': scanned,
              'native_discovery_run': args.discovery, 'native_discovered_count': len(discovery['skills']) if discovery else None,
              'routing_examples': 'Four non-executing examples reviewed in .agents/PROJECT_SKILL_RULES.md; not application tests.',
              'pending': ['n8n-skills: actual Cloud runtime/typeVersion gate unverified'],
              'unrun': ['application/DB/browser acceptance', 'live/paid/provider operations',
                        'imported helper application integration (Taste draw/lint synthetic fixtures ran separately)',
                        'behavioral implicit-selection test'],
              'failures': failures}
    (RECEIPTS / 'validation.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if report['passed'] else 1)


if __name__ == '__main__':
    main()
