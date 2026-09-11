# G09 — Privacy-safe free pilot foundation

Status: implementation in progress. Production is untouched and no paid wall exists.

## Product behavior

- Core document creation, export and sharing remain free.
- Feedback is an inline Home card, never a modal in the first-document journey.
- Eligibility requires three issued documents or a second distinct active day.
- Feedback is a 1–5 value score, an optional fixed missing-feature category and optional short text. The UI warns against entering customer or invoice information.

## Data boundary

`app_events` is first-party, tenant scoped and accepts only known events with event-specific property allowlists. It never stores customer names, phone numbers, item text, document notes, card/account identifiers, payment-stage information or raw document IDs as properties. Internal deduplication hashes prevent retry inflation without exposing entity IDs.

Optional free text lives only in `pilot_feedback`, not analytics properties. Feedback has a small triage state machine: `new → reviewed → planned/resolved/declined`.

## Metric definitions

| Metric | Definition |
|---|---|
| Activation | An issued pro-forma or invoice exists for the business |
| Time to first invoice | Seconds from first recorded app open to first issued document |
| Active days | Distinct first-party event days in the stated 30-day window |
| D1/D7/D30 retention | Return event on the exact cohort-day offset; future, not-yet-matured windows remain null |
| Documents per active seller | Issued documents in 7/30-day windows; cohort aggregation is performed without content payloads |
| Export/share rate | Distinct issued documents with an authoritative export record ÷ issued documents in 30 days |
| Conversion | Linked issued invoice ÷ eligible issued pro-formas in the stated 30-day cohort |
| Export failure rate | Allowlisted client failures ÷ successful export records plus failures in 30 days |

Draft and cancelled pro-formas are excluded from conversion. Conversion is derived only from `source_document_id`; matching names or amounts is forbidden. Payment-stage details are not analytics fields.

## Pilot triage

1. Review new feedback without copying customer/document content into GitHub.
2. Label the finding as bug, usability, request or support.
3. Record reproducible technical facts and request correlation ID when relevant.
4. Move feedback to reviewed, then planned/resolved/declined with a short decision.
5. Freeze decision thresholds only after an initial baseline; do not choose them retrospectively.

## Acceptance still required

- exact PR-head CI and exact merged-SHA staging deployment;
- privacy review of stored event rows and feedback behavior;
- feedback prompt appears only after eligibility and never blocks the first invoice;
- controlled-pilot production go/no-go by the owner;
- deferred iOS matrix remainder and provider retention/restore-request details remain visible in the pilot checklist.
