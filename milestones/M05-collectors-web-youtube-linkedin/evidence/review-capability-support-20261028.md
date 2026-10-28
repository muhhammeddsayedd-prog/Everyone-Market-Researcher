# Review capability support report — DRAFT, not submitted

Observed 28 October 2026, 16:10 UTC, at PR #14 base head `e3742572f7a6f56cd4c0e89efb636eaf263a84f1`. This is a sanitized, read-only capability audit and proposed-action review. It does not retry the denied command, apply the three proposed edits or authorize a workaround. Legitimate newer database-helper work was preserved.

## Precise support question

Which **supported narrow review mechanism in this existing VS Code conversation** can review a revised public three-file edit after automatic review returned only `blocked by policy`? The owner already tried `/approve` and reported `Command unavailable`; do not ask for that again. Identify the responsible host/reviewer layer and whether this client exposes a one-action review, including its exact supported UI entry point if available. Do not prescribe disabling review, changing permission defaults or moving the denied action to another shell, tool, agent or session.

## Observed sources and limits

| Source | Observed result | What this establishes |
|---|---|---|
| Active execution contract supplied to this turn | `sandbox_mode=danger-full-access`; `approval_policy=never`; `sandbox_permissions` arguments forbidden | Effective tool instructions for this turn. This is not a reading of a saved TOML default. |
| Owned process ancestry | PowerShell →`codex.exe`→VS Code→VS Code→Explorer; same Windows account | VS Code-launched execution host. No raw command lines or executable URLs were printed. |
| Client/version metadata | VS Code 1.143.1; OpenAI `chatgpt` extension 26.1021.22027; active bundled CLI and PATH CLI both `0.164.0-alpha.11.1` | Fresh local metadata, not the version of a hypothetical separate TUI. Only version output was requested; no authentication command was used. |
| Owned ancestor argument tokens | No explicit approval/sandbox/reviewer flag or matching `--config` override found | No such startup override observed. App-server/host-injected turn settings are not excluded. Shell command payloads were not searched. |
| Default user config | `%USERPROFILE%/.codex/config.toml` exists; modified 26 October 22:54:28.9993880 UTC. No top-level `approval_policy`, `sandbox_mode`, `approvals_reviewer`, `profile` or `default_permissions`; no `[auto_review]` section | Only allowlisted permission values/section presence were inspected. Actual UI/profile selection remains unknown; absence of a saved selector is not proof that no profile is active. `CODEX_HOME` was not explicitly set. |
| Project config | No `.codex/config.toml` in checked drive/workspace ancestors, original repo or M05 worktree | No project override file at those checked paths. |
| Requirements presence | `%ProgramData%/OpenAI/Codex/requirements.toml` and `managed_config.toml` absent; same-named user-home candidates absent. Contents were not read | Does not rule out cloud-managed requirements or a host/service-side policy. No organization policy was changed or inferred absent. |
| Exposed tools | No approval/denial-review/`request_permissions` endpoint in the current tool inventory | No available API was identified for submitting this revised exact action. Tool availability is distinct from documented client features. |
| Previous denial and owner check | Public project evidence records `blocked by policy`; owner reports `/approve` unavailable | The denial reason is opaque. It does not establish a permanent filename ban or identify which policy/reviewer layer denied the command. |

No authentication files, encrypted credential stores, token values or environment dumps were opened/emitted. No settings, policies or permission modes were changed. No hosted development, production, provider, billing or external messaging action was taken. This draft has not been submitted to support.

## Official documentation versus this client

- Current [configuration precedence](https://learn.chatgpt.com/docs/config-file/config-basic#configuration-precedence) separates saved defaults, startup overrides and enforced requirements. The checked local files cannot determine an unobserved cloud/host policy.
- The [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference) describes `approvals_reviewer` for eligible interactive approval requests; it does not make the current `never` execution contract an interactive review endpoint.
- The [Auto-review documentation](https://learn.chatgpt.com/docs/sandboxing/auto-review) describes one exact-action retry through `/approve` in the open-source TUI. Its availability in this IDE conversation is not established by that documentation; the owner's actual unavailable result is preserved.
- [Managed configuration](https://learn.chatgpt.com/docs/enterprise/managed-configuration) documents the Windows requirements path and cloud-delivered requirements. Missing local files do not exclude the latter.

**Conclusion:** a supported narrow retry/review path has not been established in this surface. Keep the revised action unperformed while that capability is clarified. This is not another owner budget, credential or general development approval request.

## Revised action for review — not applied

The earlier rejected command is obsolete: it proposed a fixed USD 10 retry guard and documentation based on USD 0.40/run, USD 5 and twelve starts. The owner's standing development authorization supersedes those project-owner financial gates. The revised action must preserve finite server-selected run settings, original scope/charges, immutable admitted work and provider acknowledgements. Database-format limits are representation constraints, not owner spending ceilings.

The following are **semantic diff excerpts for review**, not a runnable patch or replacement implementation. Only the same three existing files are proposed; no alternate helper/export/path is created.

### 1. `n8n/collectors/build-native-m05-callback.mjs`

```diff
@@ Verify thin retry permit: extend the existing authenticated receipt predicate
+ reject a returned launch_id different from p.retry.launch_id
+ require typeof descriptor.maxTotalChargeUsd === 'number'
+ require Number.isFinite(descriptor.maxTotalChargeUsd)
+ require descriptor.maxTotalChargeUsd > 0
+ preserve fresh permit/replay, exact actor/build, memory 1024, timeout 600 and output checks
+ preserve registration-only recovery of a known replay; issue no fresh POST/descriptor
- proposed historical maxTotalChargeUsd <= 10 approval ceiling
+ no fixed project-owner monetary ceiling; use the authentic validated server allocation
@@ Prepare retry registration
+ require a string actor ID before the existing format check
+ durably register a valid returned ID before stopping on a missing/mismatched charge ACK
```

The current builder already sends the selected option and checks the PPU acknowledgement after registration. The missing finite/positive retry-descriptor validation is still unimplemented. Current primary collector/gateway tests do not prove this missing native retry guard or constitute native Cloud acceptance. WF-19-M05 has not been regenerated to disguise that gap.

### 2. `milestones/M05-collectors-web-youtube-linkedin/PROGRESS.md`

```diff
@@ Status / current task / next step / MA-15
- representative packet proposed; separate general dev approval still needed
+ standing authority covers the selected representative dev scope and temporary default bypass
+ current code is on stacked draft PR14; actual live checks remain unperformed
+ next gate: supported narrow review of this revised action, then correction tests/required CI/preflight
@@ Risks
- PPU website billing cannot use a PPE invoice cap; proxy/storage/transfer and infrastructure USD remain unknown until qualified
+ request the authentic server-selected option and verify actual provider ACK/usage
+ an option/usage mismatch is a security/data-integrity reconciliation stop, not a budget-approval gate
+ preserve unknown billing/infrastructure amounts and all missing source/coverage observations
```

Preserve historical evidence, unchecked original criteria and separate production, recurrence, notification and merge decisions. Do not mark a denied edit or native observation complete.

### 3. `milestones/M05-collectors-web-youtube-linkedin/evidence/live-dev-packet-20261028.md`

```diff
@@ Packet authority and pricing
- Proposed; not approved; request another USD5/twelve-start owner decision
+ selected representative dev work is authorized by the standing owner instruction
+ retain original quotes/reserves/counts as historical planning estimates, not owner-permission ceilings
+ finite per-run settings are selected/validated before subsequent launches
+ admitted configurations remain immutable until their exact work is reconciled
@@ API billing wording
+ clarify the existing PPU/PPE wording with the current run-option contract
+ distinguish billing models, actual acknowledgement and measured invoice components
+ documentation is not proof of this account/build's acknowledgement or an invoice guarantee
@@ Request/recovery/shutdown estimates
- stop or request approval merely because the former estimate/actor/request amount is exceeded
+ adjust necessary development allocations without resetting charges or expanding selected source scope
+ retain bounded outputs/pages/retries, exact ownership, no uncertain-start replacement and shutdown capacity
@@ Single approval wording
- ask the owner to approve the obsolete fixed monetary/request/start ceilings again
+ reference existing standing authority; record actual readiness and unresolved enforced review capability
```

Retain the selected companies, exact pending migration, public-only/employee projection restrictions, conditional source eligibility, idempotency/cost assertions, temporary-bypass safeguards and restoration. No full-market/history expansion, production, recurrence, notifications, R2 work or merge is included. After supported review, actual corrected code, exports, tests and CI must be verified before live admission; this report supplies no substitute authority or evidence.
