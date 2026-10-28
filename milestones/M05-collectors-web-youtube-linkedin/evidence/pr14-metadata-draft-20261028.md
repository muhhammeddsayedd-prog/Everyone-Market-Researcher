# PR14 metadata update — prepared, not applied

The connected GitHub integration rejected `update_pull_request` with HTTP403, `Resource not accessible by integration`. No alternate tool/account was used for that metadata mutation. Git push had already succeeded through its existing authorized native path. This is separate from the preserved website edit denial and does not establish a missing GitHub credential.

Nonblocking owner path: GitHub → PR14 → Edit title/description under the repository owner's normal account, if desired. The proposed title is `feat(m05): connect collectors and verify YouTube/LinkedIn dev ingestion`. The proposed body below is review material; its CI paragraph records the preparation checkpoint and should be checked against the latest branch head before saving. No broader permission change is required for the development already completed.

## Proposed body

+Implements website, official YouTube, LinkedIn-post and public employee collectors on the accepted M04 base. Restricted gateway/RPC operations connect account ownership, normalization, ingestion, measured costs and completion. Native builders reuse existing credentials and asynchronous callbacks; employee snapshots retain only four fields and honest partial coverage. Website validation remains open.

Actual dev evidence at application head `445b60b` (all five CI40739636927 jobs passed):
- WF-13 ingested31 Hekka items; Aflam returned0 in the approved window. Both reached EOF, four official API quota units, USD0. No ineligible daily repeat was forced.
- Corrected WF-18 ingested7 Everyone posts; GoodPeople0. Its second observation added0.
- WF-18b observed20 public employees twice and preserved one same-date partial snapshot. No joins/departures were inferred.
- Both corrected callbacks replayed with unchanged items, snapshots, queues, actor starts and costs. Scope/unknown-run denials, privacy, registration, claims and cost assertions passed.
- Six actors total USD0.28515, including the preserved USD0.09505 failed pair. Infrastructure/unitemized charges remain unknown.

Dev migration `20261028020745` applied once after exact history/dry-run verification;19 versions, catalog/grants/RLS and zero-warning advisors were verified. All earlier migrations, M04 data and costs remain intact. Final state retains280 items/raw and one partial snapshot, with no unfinished owned jobs/actors/parents, registrations or claims. All five owned workflows are inactive; original graphs, Machine audience and temporary employee due setting are restored. Seven Preview bindings were removed and the exact owned default bypass was revoked/verified absent. Persistent encrypted originals and the owner-approved encrypted workflow rollback remain outside Git.

The latest restore correction preserves unknown pre-write edits while completing independent owned cleanup; uncertain writes remain fenced.38 focused native tests, lint, formatting, secrets scan (1886 tracked files, zero findings) and independent review pass. Required changed-head CI is pending at `34da12c512e07988cf33004d74e9d2ab38e99769`; no required checks were disabled.

[Actual subset result and remaining criteria](milestones/M05-collectors-web-youtube-linkedin/evidence/subset-validation-20261028.md#final-selected-subset-result-and-closure). Full LinkedIn history, wider pilot/daily observations and unobserved source examples remain explicit gaps. Native execution payload retention was not changed to manufacture evidence.

The earlier website edit denial remains preserved. Its revised finite-positive native retry validation and website observations are unperformed; website actors/accounts were excluded from the live subset. The current runtime exposes `approval_policy=never`, prohibits escalation arguments and has no action-review endpoint. Checked local configuration/startup arguments do not establish that source. The owner already found `/approve` unavailable. No denied action was rerouted or permission policy weakened. [Sanitized support report](milestones/M05-collectors-web-youtube-linkedin/evidence/review-capability-support-20261028.md) is prepared and unsubmitted.

Stacked draft against `m04-collectors-vimeo-instagram`. M05 overall remains open. Production, recurring activation, notifications, unrelated R2, merge and M06 remain excluded.
