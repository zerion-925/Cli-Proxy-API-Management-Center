# Client API key usage meter: contract audit and blocker

## Outcome

**Blocked at the backend contract gate. No runtime dashboard was implemented.**
The requested read-only aggregate/per-client-key historical token/cache dashboard
cannot be integrated with the inspected upstream Management API. Shipping an
upstream-credential chart as client usage, consuming the usage queue, or adding
fictional snapshot endpoints would violate the requirements. Existing frontend
behavior, dependencies, translations, routing and build output are unchanged.

Branch: `feat/client-key-usage-meter`.
Frontend baseline: `4e4aeff23f9f82b3ccdbe48b2e774d5dc918234e`.
This document is the only repository change; it is an audit, not a completed UI.

## Authoritative source evidence

`../CLIProxyAPI` was absent. README.md lines 12, 39 and 55 explicitly link
https://github.com/router-for-me/CLIProxyAPI. That public repository was cloned
for inspection only at `/home/ubuntu/workspace/CLIProxyAPI-upstream-audit`.
No backend files were edited and no live Management API was contacted.

Inspected upstream revision: `250d598175db61a4e99ac38b9164ed04745754e5` (main).
Source links below are revision-pinned, not assumptions about an installed server:

- [v8 route table](https://github.com/router-for-me/CLIProxyAPI/blob/250d598175db61a4e99ac38b9164ed04745754e5/internal/api/server_management_v8.go#L37-L43): the built-in usage routes are `GET /v8/management/observability/usage/api-keys` and `GET /v8/management/observability/usage/queue`. No historical snapshot/aggregation route is declared there.
- [API key usage handler](https://github.com/router-for-me/CLIProxyAPI/blob/250d598175db61a4e99ac38b9164ed04745754e5/internal/api/handlers/management/api_key_usage.go#L56-L116): enumerates the upstream auth manager, groups by provider and `base_url|api_key`, and returns only `success`, `failed`, `recent_requests`. These are upstream credentials, **not client access keys**. They cannot be joined to client keys by matching the word “key”.
- [Recent auth buckets](https://github.com/router-for-me/CLIProxyAPI/blob/250d598175db61a4e99ac38b9164ed04745754e5/sdk/cliproxy/auth/types.go#L314-L334): 20 buckets of 10 minutes, not 24-hour or multi-day client-key history.
- [Queue handler](https://github.com/router-for-me/CLIProxyAPI/blob/250d598175db61a4e99ac38b9164ed04745754e5/internal/api/handlers/management/usage.go#L23-L42): `GetUsageQueue` calls `redisqueue.PopOldest(count)`. Its HTTP GET **consumes records**, so it is unsuitable for a read-only dashboard and can steal records from another consumer.
- [Queue regression test](https://github.com/router-for-me/CLIProxyAPI/blob/250d598175db61a4e99ac38b9164ed04745754e5/internal/api/handlers/management/usage_test.go#L13-L44) explicitly checks that requested records are removed. It tests the shared handler via a legacy URL; that URL must not be used by this frontend.
- [Queue lifecycle](https://github.com/router-for-me/CLIProxyAPI/blob/250d598175db61a4e99ac38b9164ed04745754e5/internal/redisqueue/queue.go#L9-L16): default retention is 60 seconds, maximum 3600 seconds, in memory. This is delivery buffering, not queryable historical retention. Subscriber delivery also bypasses queued storage; a browser listener would not recover history.
- [Queued usage schema](https://github.com/router-for-me/CLIProxyAPI/blob/250d598175db61a4e99ac38b9164ed04745754e5/internal/redisqueue/plugin.go#L208-L290): does carry client `api_key`, `is_native_key`, `access_provider`, execution/request/trace identities, model, timestamp, failure and token/cache accounting. Necessary data exists internally, but the only built-in HTTP usage delivery path exposing these records is destructive, not a historical read API. The schema also contains sensitive fields that a dashboard does not need.
- [Canonical token accounting](https://github.com/router-for-me/CLIProxyAPI/blob/250d598175db61a4e99ac38b9164ed04745754e5/sdk/cliproxy/usage/accounting.go#L25-L79): schema v2 provides disjoint input/output buckets, quality and unclassified tokens. Its existence does not make the queue a safe read API.

## Frontend findings and supported scope

- `src/services/api/apiKeys.ts` accesses `/config/access/api-keys`, the configured
  **client** access-key list. It has no usage counters or durable identity metadata.
- `src/services/api/apiKeyUsage.ts` already wraps the verified upstream-credential
  usage endpoint through `apiClient`. `src/utils/recentRequests.ts` models only
  request counters and buckets; no client attribution, model or tokens are present.
- `src/features/dashboard/hooks/useDashboardOverview.ts` combines provider inline
  credentials with auth-file credential counters. This is provider health/traffic,
  not all-client usage, and must not be relabeled as such.
- `useProviderRecentRequests` already scopes its in-memory cache to the connection
  and management key; future work must preserve that isolation and stale-result
  handling rather than accumulating browser history or persisting raw keys.
- Existing tests include `tests/dashboardMetrics.test.ts`, using `bun:test` for
  pure metric logic. No new test framework is necessary when integration unblocks.
- The attachments were inspected as structure references: summary beside timeline,
  totals, cost composition, model/hour breakdown and range controls. There is no
  implemented UI or screenshot implying those metrics are supported.

No requested client-key metric can be truthfully derived from the currently
available read-only usage response. The existing provider dashboard is the
verified supported capability and remains untouched. No synthetic runtime data,
client-key filter without attribution, meaningless zero-valued cache counters,
price defaults, or false 90-day retention controls were added.

## Required backend extension (requirements, not an existing API contract)

Backend implementation requires separate authorization and an agreed contract:

1. Retain canonical usage server-side independently of delivery queues. Provide a
   non-consuming Management API snapshot/query supporting aggregate and per-client
   filters, bounded time ranges, model and hourly/daily grouping. Do not expose an
   assumed endpoint name until backend implementation defines it.
2. Return stable opaque client-key IDs and masked display labels, including deleted
   key history, native/plugin identity namespaces and an explicit unattributed
   bucket. Never use raw client keys in URLs, labels, logs or dashboard persistence;
   upstream credential IDs and management login keys are different identities.
3. Specify whether counters mean provider execution attempts or inbound requests.
   Retries/fallbacks may yield multiple executions. Provide suitable deduplication
   identities and outcome semantics; do not equate either unit with sessions.
4. Publish retention bounds, coverage start/end, timezone/bucket boundaries,
   completeness, disabled-collection state and query limits. Enable 24h/7d/30d/90d
   only when supported; partial coverage must remain explicit, not zero-filled as
   evidence of no activity.
5. Expose canonical v2 token accounting and per-field availability/quality. Sum
   disjoint uncached input, cache-read, cache-write and output once; reasoning is
   a component of output, not additional output. Preserve unclassified amounts.
   Missing/unsupported cache-write must be unavailable, not inferred zero. Define
   token cache-read share as cache-read / total input for records with comparable
   known input accounting, with that denominator and coverage shown; a request
   cache-hit rate needs a separate documented request-level signal/denominator.
6. If estimates are supported, supply or integrate genuine configured model/tier
   pricing with currency, units and effective version. Show priced coverage and
   unknown contributions. Cache savings require comparable configured uncached
   and cache-read prices; missing prices are unavailable, never a zero bill.
7. Test read idempotency, aggregate/per-key reconciliation, attribution, retries,
   time boundaries, expired/deleted history, unknown fields/prices and isolation.

An already-installed external usage collector/plugin might provide these missing
capabilities, but no such instance, contract or credentials were supplied. Its
existence cannot be assumed from the generic plugin routes.

## Verification and review

- Read AGENTS.md in full and inspected implementation/UI/review skills, existing
  dashboard, API/types, session-scoped usage cache and representative Bun tests.
- Cloned the README-linked public backend and inspected actual v8 routes, handlers,
  queue tests, retention, usage identity and canonical token schema. This is source
  verification only, not compatibility testing against the user's running backend.
- `git diff --check`: passed before and after this document change.
- Standards self-review: documentation-only, no API fallback, secrets, dependency
  change, backend edit or unrelated migration. Spec self-review: the explicit
  instruction to return an audit/blocker on a major contract blocker applies;
  the requested dashboard is deliberately **not** reported as completed.
- `bun --version`: failed, executable not on PATH. No install, focused test,
  `bun run verify`, build, route check or browser screenshot was run for this
  documentation-only blocker outcome. Test counts: not run, not zero passing.
- UI screenshot paths: none. No mock fixture or live credential was used.
- The repository-local Impeccable context-loader script was also absent. No design
  work proceeded, so this did not change the contract-blocker decision.

Next unblock: authorize the backend read-only historical usage extension or
provide an authoritative existing collector API contract meeting these semantics.
No push, PR, deployment, config mutation or generated proxy traffic was performed.
