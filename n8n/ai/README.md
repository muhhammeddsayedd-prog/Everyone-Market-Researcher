# M07 local extractor

`build-native-extractor.mjs` generates a supported-node, inactive WF-30 blueprint.
The checked-in export has missing-binding guards and cannot perform I/O. A bound
local test uses the actual generated Code transitions and restricted Node route
with a controlled Responses API fixture. No real model call is claimed.

The first slice is deliberately local: the route and database adapter accept only
loopback local-development targets and deny every Vercel/production environment.
An actual n8n Cloud instance cannot reach that loopback route. This is a
Cloud-compatible graph contract qualified locally, not a hosted runtime or native
Cloud acceptance receipt. A separately reviewed hosted binding will be required
before any live extraction observation.

The route owns prompt/schema/model and price-book validation. The generated
workflow claims one message, prepares the versioned request, durably marks a
one-shot dispatch, sends the provider request, settles a known response through
atomic SQL and acknowledges only a completed receipt. An uncertain model outcome
or database commit is held for the same-attempt reconciliation; there is no
automatic provider retry. Completed replay performs no provider call and produces
no second cost, entity or queue work.

Local accounting is labelled `simulated`, including calculated fixture cost.
Missing usage or applicable price is unknown, not zero. Vision, batch extraction,
embedding execution, schedules, email and media dispatch remain outside this slice.

Before any separately authorized live route, bind a verified model snapshot (or
an explicitly verified alias mapping): this local boundary holds responses whose
model differs from the configured model. The finite output-token setting is
server-selected locally; only model and prompt/schema versions are frozen in the
current SQL attempt. A hosted extension must freeze its complete admitted request
configuration before provider I/O.
