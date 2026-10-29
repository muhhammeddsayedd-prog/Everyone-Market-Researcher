# M07 — AI understanding · PROGRESS

> Codex keeps this file current. Read it first in every session; update it after every task.
> The owner reads it to see where we stand, what's blocked, and what they must do.

## Status
**In progress — independent local extraction slice.** The owner accepted/closed bounded upkeep701cd93/CI40890083175 and explicitly authorized this separate local M07 sequencing exception. M05 and full M06 remain open. No live model, hosted queue or campaign operation is part of this delivery.

| Field | Value |
|---|---|
| Started | 2026-10-29 |
| Last updated | 2026-10-29 |
| Finished | — |
| Branch / PR | `m07-ai-understanding`, isolated worktree based on `701cd93dafd881280ff246fdcb487b48f2a44f3f` / separate ordinary branch delivery; existing draft-creation403 boundary retained |
| Current task | Local text T1, extraction-essential T2 and inactive WF-30 connection implemented and qualified;25 local definitions. All24 baseline files preserved; no hosted M07 migration. |
| Next step | Deliver this local slice and verify required CI against its changed head. Next independent implementation: embedding input/hash/upsert and inactive WF-33 contracts; hosted gateway/model/price observation remains separately scoped. No owner input needed for this local delivery. |

## Task checklist
<!-- Mirror of the tasks in MILESTONE.md. Tick when done and committed. -->
- [x] T1 - Local text prompt/schema/request/parser/cost contract complete; vision later
- [ ] T2 - Extraction SQL complete locally; embedding and Batch functions remain
- [ ] T3 - Connected inactive local WF-30 qualified; hosted, vision and schedules remain
- [ ] T4 — WF-31 · Media v2 (dev)
- [ ] T5 — WF-33 · Embeddings (dev)
- [ ] T6 — Dev end-to-end test
- [ ] T7 — Eval set (MA-17)
- [ ] T8 — Eval run + model choice
- [ ] T9 — Backlog estimate + processing (prod)
- [ ] T10 — Prices, reporting, export, hand-off
- [ ] T11 - Current local text slice qualified; later T2-T5 behavior remains

## Acceptance criteria
<!-- Mirror of MILESTONE.md §9; paste evidence (command + output summary, counts, screenshot paths). -->
- [ ] AC1 — Eval targets met — evidence:
- [ ] AC2 — Queue drained (prod) — evidence:
- [ ] AC3 — Routing — evidence:
- [ ] AC4 — Locked fields are respected — evidence:
- [ ] AC5 — Resolution — evidence:
- [ ] AC6 — Cost known — evidence:
- [ ] AC7 — Embeddings — evidence:
- [ ] AC8 — Media — evidence:
- [ ] AC9 — Safety — evidence:

## Blockers
- No blocker for this local delivery. The existing draft-PR creation403 remains a delivery-access limitation; branch/CI delivery is independent. No attempt to evade that boundary.
- Hosted extraction is unverified and outside this authorization; local loopback binding cannot be used from n8n Cloud.

## Manual actions needed from the owner
<!-- Exact steps, why, and where to paste results. The owner ticks them; Codex verifies. Steps: docs/MANUAL_ACTIONS.md + MILESTONE.md §11. -->
| # | Action | Why | Status |
|---|---|---|---|
| MA-12 | Reuse existing OpenAI integration at a later explicitly authorized live validation; ask only for actual missing access then | Live WF-30 / WF-33 | Not needed or requested for controlled local responses |
| MA-17 | Confirm/correct the 200 eval labels; approve the extraction model; approve backlog cost + standard vs Batch path | Eval (T7–T8) and prod backlog (T9) | Not requested yet |

## Decisions & deviations
<!-- Anything that differs from the docs. Also add to docs/DECISIONS.md → Changes if it changes a decision. -->
- Planned: AI backlog runs in prod after MA-17 (WF-30/31/33 queue-draining schedules on; collector schedules stay off until M08).
- Option for owner: WF-30b Batch path for the backlog (~50% cheaper tokens, 24 h turnaround).
- [29October local sequencing/replay decision](../../docs/DECISIONS.md#independent-local-m07-extraction-slice--29-october-2026) overrides the original M06-Done prerequisite only for this local slice. One attempt replay has no repeated dispatch or durable effects; a new explicit attempt/version is distinct. Unknown provider outcome is held, never assumed unbilled.
- T2 embedding/Batch functions, actual vision/key frames, embedding execution, the200-item evaluation and model selection remain outside this first slice. WF-30 remains inactive/unbound; no fallback schedule, campaign binding or WF-31 change is made.
- The campaign stays8ba0eb7. First observation31October06:00Cairo; new collection stops6November12:00Cairo; resumed shutdown/revocation remains due7November18:00Cairo. Accepted media/source/connected/upkeep results stay closed, including the original whole-row evidence limitation.
- Protected stale root/M03 records and the specifically denied M05 action are unchanged. The current milestone record carries this exception without a new approval/credential framework.

## Risks / notes for the owner
- Controlled responses establish implementation, not model accuracy or actual billing. Native Cloud/live extraction, vision, embedding execution, evaluation and production remain open.
- The finite M06 campaign and its shutdown dates remain binding. No campaign inspection or mutation was performed by this local slice.
- [Local evidence and exact boundaries](evidence/local-extraction-20261029.md); [machine receipt](evidence/local-extraction-20261029.json).

## Local slice evidence

T1 text, extraction-essential T2 and inactive local T3 are complete for the authorized scope. Routing, locks, resolution and cost/replay behavior have local evidence only; the full milestone AC checkboxes intentionally remain open. New suite101/101; normalizer16; handler/adapter12; native9; composed actual SQL1; CI safety21; typecheck passed. Native local advisors have zero findings and types cover25 definitions. Provider calls/cost increment:0/USD0; fixture accounting is simulated.

## Session log
- 2026-10-29 - Preserved initial CI40897890748 cancellation/dummy-URL scanner finding and CI40898010713 regular-SQL failure. Corrected password-free fixtures, exact35-table expectation/full FK index and known-failure redelivery fence; local schema21/extraction101 and generated-route-SQL regression pass. Required changed-head CI remains mandatory.
<!-- Newest first. One line per meaningful step: date · what · files · result. -->
- 2026-10-29 - Completed local extraction, CLI-created SQL25, generated types, inactive export and mandatory CI coverage. New pgTAP101, normalizer16, handler12, native9, composed SQL1 and CI safety21 passed; typecheck and zero-finding native advisors passed. Preserved all baseline data and campaign/denial boundaries. See local-extraction evidence and actual branch CI receipt.
- 2026-10-17 · milestone file created (handoff pack)
- 2026-10-29 · Owner authorized independent local M07 from accepted701cd93/full24 migrations. Created isolated worktree/branch, preserved M06's uncommitted final-CI receipt and frozen campaign, reused existing installed dependencies with local workspace links and no installation. Read actual AI contracts and official Responses/Structured Outputs documentation; split request/SQL/native implementation with one integration coordinator. No hosted/provider/credential operation. Implementation and qualification in progress.

## Hand-off to next milestone
<!-- Filled when Done: what exists now, how to run/verify it, known gaps, what the next milestone should start with. See MILESTONE.md §14 for the required items. -->
- —
