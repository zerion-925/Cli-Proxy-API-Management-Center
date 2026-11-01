# Persistent client usage meter implementation

## Outcome

Built and exercised a native plugin-owned SQLite3 meter plus the integrated existing dashboard. This replaces the earlier blocker-only report: the built-in historical read API is absent, but the official native plugin mechanism supports an independent usage observer and management-authenticated read routes without modifying upstream core.

- Frontend: `/home/ubuntu/workspace/Cli-Proxy-API-Management-Center`, branch `feat/client-key-usage-meter`, baseline `cfe3437`.
- Plugin: `/home/ubuntu/workspace/cli-proxy-usage-meter`, branch `feat/native-usage-meter`, commits `85d303b` and `286571f`.
- Read-only backend revision: `250d598175db61a4e99ac38b9164ed04745754e5`. No upstream source changes, live configuration changes, push, PR, deployment, real-user traffic or paid-provider calls.
- Actual compiled artifact: `../cli-proxy-usage-meter/build/client-usage-meter.so`, verified ELF ARM aarch64 C-shared library. Build artifacts are ignored rather than committed. No companion, remote database or extra service is needed.

## Authoritative mechanism and route

Verified from the pinned source, not an invented plugin API:

- `examples/plugin/Makefile` and `examples/plugin/simple/go/main.go`: native C ABI exports and `go build -buildmode=c-shared`.
- `sdk/pluginapi/types.go:1627–1717`: canonical `UsageRecord` execution/client fields and seven integer token counters.
- `internal/pluginhost/adapters_usage_translation.go:19–34,132–233`: independently registered named usage observer, client attribution and actual callback field mapping. It does not pop the shared queue.
- `internal/pluginhost/management.go:18–21,58–94,121–166`: plugin management prefix and registration rules. **A GET route with nonempty Menu becomes a public resource**, so this plugin declares an exact GET Route with empty Menu and no Resources.
- `internal/api/server_management.go:255–290`: availability gate and real management middleware execute before plugin dispatch.
- `sdk/cliproxy/usage/accounting.go`: exported provider-aware reconstruction; original richer breakdown/quality/presence information is not carried across the seven-counter ABI.

Declared read endpoint, intentionally preserving the backend's plugin-path exception:

```text
GET /v0/management/client-usage-meter?range=24h|7d|30d|90d
    [&client=<returned opaque ID>][&bucket=hour|day]
```

This is not a v0 fallback for core application data. Core frontend APIs remain v8. The new API module uses the existing central `apiClient`, a captured authenticated connection, and the exact absolute plugin URL. No queue consumer, public resource, inference interception or alternate authentication mechanism was added. Management disabled/unavailable, Home gates, or an absent/disabled plugin produce unavailability rather than fabricated successful metrics.

## Storage, identity and delivery

The plugin owns a local SQLite3 database through maintained `mattn/go-sqlite3 v1.14.52`: WAL, 100 ms busy timeout, immediate bounded transactions, one connection, transactional schema migrations and indexed event/time/client lookups. Defaults: 90-day retention, 100,000 events, 1,000 client identities, 256 models; documented hard caps and bounded pruning apply. Event expiry is enforced on reads; background/insertion pruning is bounded. See the plugin README for all limits, WAL/backup behavior and configuration.

The absolute durable data directory must belong to the running user and be0700; DB/lock/WAL/SHM files must be regular owner-only0600 files. A writer lock prevents multiple instances sharing a directory. The plugin does not change the host umask. It stores a random persisted HMAC secret and instance ID. Stable opaque client IDs are namespaced by native/plugin authentication and AccessProvider; missing attribution has an explicit unattributed bucket. Deleting a configured key does not erase retained history. Raw keys are never labels, query values, logged data or persisted event fields.

Persisted fields are whitelisted: hashed execution identity, timestamp, opaque client identity/namespace, bounded model identifier and aggregate counters. Headers, prompts, completions, provider secrets, failure bodies, upstream URLs and session/trace metadata are discarded. The frontend keeps results and selection in component memory, with no browser usage collector or snapshot/client-key persistence. Logout, connection switches, revision/ABA changes and unmount abort/invalidate old requests; captured old401s cannot log out the new session.

Delivery is explicitly **best effort**, not billing-grade or exactly-once. A bounded nonblocking callback queue isolates inference from storage failures. Queue overflow, malformed/missing IDs, capacity drops and ingest faults are exposed in health counters. Deduplication uses persisted instance + canonical execution RequestID and survives restart while records are retained. Host/pre-callback drops are not observable; counters and queued work can be lost on a crash. SQLite WAL `synchronous=NORMAL` is documented, including possible recent-commit loss on machine/power failure. No historical backfill is claimed.

## Metric semantics and UI

- Primary count is **provider execution attempts**, including retries/fallbacks. Success/failure comes from the execution Failed flag. Requests are always null/unavailable: optional short TraceID does not establish unique inbound requests. Attempts are never relabeled sessions or requests.
- Canonical input/output counters are shown separately; input is not universally uncached and output/reasoning semantics vary by provider. Total tokens use the pinned SDK's `EnsureTokenBreakdownForProvider`, avoiding naive cache/reasoning addition.
- Explicit cache-read/write counters and unclassified cached remainder are retained. Cache rate is reads divided by reconstructed comparable total input, including cache, only when the aggregate has no unknown accounting. The exact denominator and reconstruction limitations are visible. Ambiguous/zero-only/inconsistent events remain marked unknown; a null rate is unavailable, not0%.
- The ABI cannot prove whether a zero counter is measured or absent. During active collection the UI conservatively renders zero-valued token categories, and zero cache rate, unavailable. Generic uncached input is unavailable rather than inferred by universal subtraction. Original v2 per-field quality, cache TTL, and complete unclassified breakdown cannot be recovered; no full-fidelity claim is made.
- Pricing and cache savings are unavailable: no prices, fake zero bill, currency or savings assumptions were introduced.
- Aggregate/per-client selector,24h/7d/30d/90d, observed coverage/retention/earliest event, partial health state, summary, UTC token timeline, canonical/cache/output totals and model/hour/day table use existing Select/Button/theme tokens and SCSS Modules. Before-installation and expired history is not drawn as backfilled zero observations. Loading, no-history, unsupported/disabled collection, errors and disconnected states are explicit.
- Existing provider credential dashboard metrics remain provider metrics and are not substituted for client usage. Hash routing and single-file output are preserved. All seven locales have matching usage-meter keys and accessible labels. No dependency or lockfile refresh occurred.

## Reproduce locally

Full plugin setup/build/config/security instructions are in `../cli-proxy-usage-meter/README.md`; verification details are in its `VALIDATION.md`. Minimal build/verification:

```bash
cd /home/ubuntu/workspace/cli-proxy-usage-meter
make verify
make runtime-race
```

Configure `plugins.configs.client-usage-meter.data_dir` as an absolute dedicated durable directory, or set `CLI_PROXY_USAGE_METER_DIR`. Keep the `.so` filename/plugin ID `client-usage-meter`. The README has the complete v8 YAML example, retention/cap settings and authenticated curl command. The pinned host requires a configured management secret hash or `MANAGEMENT_PASSWORD`; its SDK local-password option alone is insufficient. Installing/enabling in a production host remains an operator action, not something performed here.

Bun1.4.3 was installed in an isolated tool prefix because Bun was absent from PATH:

```bash
export PATH=/home/ubuntu/.hermes/cache/scratch/usage-meter-tools/node_modules/.bin:$PATH
cd /home/ubuntu/workspace/Cli-Proxy-API-Management-Center
bun install --frozen-lockfile
bun test tests/clientUsageMeter.test.ts tests/clientUsageView.test.ts tests/clientUsageLocalization.test.ts
bun run verify
```

Synthetic browser demo commands and safety notes: `tests/browser/README.md`. Its mock server is loopback-only, authenticated with an explicitly synthetic test bearer and exact-origin CORS. It is not part of production. `official-runtime` mode displays an actual sanitized HTTP wire snapshot generated by the compiled plugin in the official proxy using a loopback upstream stub, not hand-authored fake API data; that recorded mode deliberately rejects unsupported filters. This is recorded synthetic runtime evidence, not a browser connected to a live production proxy.

## Executed verification

| Check | Actual result |
| --- | --- |
| Backend `make verify` | Passed: behavioral tests, in-process race tests, vet, actual C-shared build and official runtime integration. |
| Backend `make runtime-race` | Passed with race-instrumented official host and ordinary compiled library; plugin Go logic separately passed in-process race tests. |
| Official proxy/plugin runtime | Real loader, callback fanout and inference through local upstream stub.3 attempts,2 successes,1 real stub upstream failure,240 tokens,2 keys. Repeat publication deduped; nonconsuming repeated reads; per-key/global reconciliation; process restart; stable deleted-key history; native auth-denied management401/403; public-route404; disabled management404. Core usage-statistics aggregator disabled throughout. |
| SQLite/ABI behavior | Restart/dedupe, concurrent callbacks/reload, namespaces, unknown/cache semantics, UTC boundaries/retention/caps, lock faults, health counters, owner-only DB/WAL/SHM, migrations, secret canaries, invalid body/query/method/path and queue-overflow tests passed. |
| Actual wire → frontend normalizer | Passed against generated `tests/fixtures/usage-meter-official-runtime.json`; validates3 attempts,240 tokens,2 clients,1 duplicate, null request/cache rate and no secret canaries. |
| Focused frontend tests |15 passed,0 failed across three files, including authenticated exact-path transport, stale connection401 suppression, response validation, unknowns, coverage clipping, locale/a11y keys and two-key fixture reconciliation. |
| Full `bun run verify` | **Not green:**1882 passed,1 failed across1883 tests. The failure is the existing `authFileCooldowns` SSR assertion expecting an unescaped English apostrophe. |
| Baseline reproduction | A clean `git archive cfe3437` using the same pinned dependencies independently produced the same full-suite failure:1867 passed,1 failed. That existing test passes alone. No unrelated cooldown code/test was changed. |
| `bun run lint` | Passed with no warnings after fixture cleanup. |
| `bun run build` | Passed TypeScript/Vite; production `dist/index.html`3,748.98 kB. Single-file inlining preserved. Existing Vite native-config warning remains. Generated dist not committed. |
| Browser | Actual component/API client checked in isolated Chromium fixture: aggregate/per-client,7d/day table, loading/empty/error/unsupported states, logout data clearing, dark theme and390px responsive layout with no page-level overflow. Actual official-runtime wire snapshot also rendered3 attempts/240 tokens/2 success/1 failure with unavailable cache rate. |
| Source scope | Upstream checkout remains clean; dependency lockfile unchanged; diff whitespace checks pass. |

A fully race-instrumented shared library inside a race-instrumented host was attempted and failed before assertions with ThreadSanitizer shadow-memory allocation errno12. That combination is **not** reported as passing. The production artifact was restored to a normal build. No production throughput, power-loss recovery, non-ARM64 platform, real paid provider or live Home integration was verified.

Browser evidence (explicitly synthetic):

- `tests/browser/screenshots/usage-meter-desktop.png`
- `tests/browser/screenshots/usage-meter-mobile.png`
- `tests/browser/screenshots/usage-meter-official-runtime.png`
- `tests/browser/browser-verification.json`

Full local logs are retained under `/home/ubuntu/.hermes/cache/scratch/usage-meter-*`, including `usage-meter-backend-verify.log`, `usage-meter-backend-host-race.log`, `usage-meter-wire-runtime.log`, `usage-meter-frontend-final3-verify.log`, `usage-meter-frontend-final3-lint.log`, `usage-meter-frontend-final3-build.log`, and `usage-meter-baseline-test.log`.

## Review and remaining work

Standards review: existing frontend theme/API/hash/single-file contracts preserved; new feature code is feature-owned; no raw client labels/browser persistence, core fallback, queue drain, public usage route, unbounded custom collector or authentication weakening. Spec review: actual persistent plugin and supported UI are exercised; execution/request distinction, partial coverage, reconstruction uncertainty and absent pricing are explicit. The richer original accounting/presence data is unavailable at this native ABI and is not fabricated. The remaining full-suite failure is independently reproduced on baseline. Production enabling/deployment, arbitrary platform verification and richer future ABI metrics are intentionally left to separate work.
