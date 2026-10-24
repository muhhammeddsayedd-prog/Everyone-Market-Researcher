# Isolated native n8n 2.43.5 reproduction

This opt-in local fixture uses a new, labeled Docker container/internal network,
one CPU, 1 GiB memory and 256 PIDs. It uses only a synthetic local owner/API key,
fixed fake provider output/errors and isolated SQLite. It never reads real
credentials or contacts Cloud, providers, Supabase or existing containers.
It is excluded from normal CI. Local engine evidence is not Cloud acceptance.

The four archived source files reproduce the corrected native cases actually
used on 19 October. Their only added behavior is the explicit local guard and
native-package Flatted resolution. This preparation entry starts nothing:

```powershell
node scripts/n8n/foundation-native-repro.mjs --isolated-local
```

Expected: `C01_REPRO_SOURCE_PREPARED`, `runtimeStarted:false`. An existing
destination is rejected. Keep existing files; do not remove unrelated data to
make a run fit. Review the archived setup/consumer before continuing.

If the exact image is absent, obtain the public image explicitly:

```powershell
docker pull n8nio/n8n:2.43.5
```

The observed image configuration ID and actual `RepoDigests` entry were both
`sha256:4fc4c67bf5fb990201a71d94c7070abf8dd0619cb8af1d059877a447f3640392`.
The setup verifies the installed label is 2.43.5 and records its actual image ID;
it never uses `latest`. The runtime package version must also be 2.43.5.

Run only the prepared fixture:

```powershell
node .c01-repro.local/replay.c01-repro.local/c01-setup.mjs --isolated-local
docker exec emr-m03-c01-repro-20261019 node /c01-repro/c01-repro.mjs --isolated-local --inside
docker exec emr-m03-c01-repro-20261019 node /c01-repro/c01-repro.mjs --isolated-local --inside --policy-only
```

The internal Docker network blocks host ingress to its published loopback port.
The runner therefore uses actual HTTP at `127.0.0.1:5678` **inside** that isolated
container. It does not weaken network security. The manual entry is the native
local internal REST endpoint, not the installed Cloud MCP tool. Production
Error Trigger uses the actual local public webhook. Fixed native public API
execution reads and full local SQLite inspection provide separate evidence.

The first runner executes eight fixed cases: no-retention success, retained
manual wrapper with child output, caught failure, uncaught failure, detached
child, timeout, a second native ID for the same workflow, and wait/resume.
The policy runner adds retained success/error/wait pairs and an automatically
triggered error child. There are at most 24 valid native executions. Fixture
results must be inspected; a process finishing is not an acceptance assertion.

Publication registration can return a first webhook 404. Only after that exact
result, this bounded local recovery checks the saved publication and verifies
that no execution exists before one further synthetic webhook attempt:

```powershell
docker exec emr-m03-c01-repro-20261019 node /c01-repro/c01-auto-probe.mjs --isolated-local --inside
```

Any prior execution blocks that command; it never replays an uncertain start.
Do not use it for another failure or a hosted workflow.

Raw synthetic snapshots stay under the ignored prepared `state/c01-receipts/`
directory. They intentionally include intermediate outputs and failure details
for privacy inspection. They must not enter Git. A safe final node does not
sanitize earlier stored data. The original-session projector is archived only
for the reviewed historical receipt; its fixed original counts are **not** a
fresh-run report and it is not part of these execution commands.

Inspect parent task `metadata.subExecution` and child `data.parentExecution`.
A throwing child can leave no parent-side metadata; only the child backlink is
available. Candidate/historical rows from a reused workflow must be separated
by the actual parent ID. Under `none`, public metadata becomes unavailable and
initial child context may survive logical deletion without a final outcome.
Waiting payloads can persist until resume despite terminal retention `none`.

The proposed non-manual fixture sets success/error storage `all`; its additional
manual flag is unused in integrated/error mode. This is mode-equivalent evidence
for those fields, not exact configuration or Cloud parity across all 25 IDs.

After inspection, stop/remove only these owned resources. Verify the labels first:

```powershell
$emrC01Owner = 'emr-m03-c01-repro-20261019'
$emrC01ContainerLabels = docker inspect $emrC01Owner --format '{{json .Config.Labels}}' | ConvertFrom-Json
$emrC01NetworkLabels = docker network inspect ($emrC01Owner + '-network') --format '{{json .Labels}}' | ConvertFrom-Json
if ($emrC01ContainerLabels.'com.emr.owner' -ne $emrC01Owner -or $emrC01NetworkLabels.'com.emr.owner' -ne $emrC01Owner) { throw 'C01 ownership mismatch' }
docker stop --timeout 10 $emrC01Owner
docker rm $emrC01Owner
docker network rm ($emrC01Owner + '-network')
```

Project only allowlisted identities, versions, outcomes, times, link paths and
privacy booleans before removing raw synthetic state. Verify its resolved
absolute path stays under the prepared ignored directory before recursive
removal. Never run `docker prune`, operate on other containers or reuse a real
password/key here. No workflow publication or execution in Cloud follows from
these commands.
