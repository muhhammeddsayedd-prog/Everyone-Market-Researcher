# M07 extraction and embeddings

WF-30 and WF-33 use supported n8n Code/HTTP nodes. Both checked-in exports are
inactive and unbound; missing bindings stop before I/O. Local integration tests
execute their actual generated Code through authenticated handlers and restricted
SQL against PostgreSQL, with controlled provider responses. No live model or
hosted native acceptance is claimed.

Preparation freezes the complete provider body and response-validation context:
item/taxonomy, prompt/schema identity and content, model/output settings, routing
threshold and prices. The SQL canonical snapshot hash gates dispatch and settlement.
Later environment, source, taxonomy, threshold or price changes cannot alter that
attempt. One-shot dispatch, exact replay and unknown-outcome containment apply to
both paths. Known failures remain attributable; queue expiry is not a paid retry.

WF-33 embeds items, competitors and organizations. Competitors use the last20 item
summaries with deterministic ordering; campaign summaries wait for the later
campaign implementation. Bounded UTF8 text is hashed exactly. Unchanged checks
include model,1536 dimensions and input version. Responses map by unique complete
indexes, not array order. Storage-compatible finite vectors are required. A delayed
result cannot overwrite newer content or vectors. One provider batch has one
aggregate token/cost settlement, without invented per-vector usage. Refresh enqueue
is explicit and replay-safe; there is no active schedule.

The existing local profile remains loopback-only and records simulated accounting.
The separate hosted profile is implemented but default-disabled. It requires the
exact dev project, Preview branch/commit/deployment/audience, authenticated Machine
access, restricted writer and server-selected item/entity allowlists. Production
and wrong bindings are rejected. It uses the existing strict-TLS certificate path;
no administrator or Supabase secret key enters runtime. No secret is loaded or
bound by this implementation. Local profile tests do not establish hosted access.

Before the next separately authorized smoke observation, confirm the pinned model,
applicable price book, selected existing dev records, supported protection access
and actual bindings in the single live-validation packet. Evaluation still owns the
final model decision. Vision/media extensions, Batch, evaluation, production and
recurrence remain later scope.
