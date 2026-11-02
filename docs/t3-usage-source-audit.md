# T3 Code usage presentation source audit

## Pinned upstream

Reference: [pingdotgg/t3code at 79f3ee139b99a932178c4bd7c191c4a7f5cf0481](https://github.com/pingdotgg/t3code/tree/79f3ee139b99a932178c4bd7c191c4a7f5cf0481), MIT, Copyright (c) 2026 T3 Tools Inc.
Actual source was read, not inferred solely from screenshots:

- [`apps/web/src/components/usage/UsagePage.tsx`](https://github.com/pingdotgg/t3code/blob/79f3ee139b99a932178c4bd7c191c4a7f5cf0481/apps/web/src/components/usage/UsagePage.tsx): metric-dependent primary total and trend, period controls, token/cache totals, model and time breakdowns; lines 630–1068 cover the principal presentation.
- [`apps/web/src/components/usage/usageBreakdown.ts`](https://github.com/pingdotgg/t3code/blob/79f3ee139b99a932178c4bd7c191c4a7f5cf0481/apps/web/src/components/usage/usageBreakdown.ts): token sorting, unknown-cost/null share, cache-hit denominator and category segments.
- [`packages/shared/src/usageMerge.ts`](https://github.com/pingdotgg/t3code/blob/79f3ee139b99a932178c4bd7c191c4a7f5cf0481/packages/shared/src/usageMerge.ts): `isModelCostUnknown`, separate token/cost accumulators, model shares, chronological bucket merge, cache savings and category costs.
- [`apps/server/src/usage/usagePricing.ts`](https://github.com/pingdotgg/t3code/blob/79f3ee139b99a932178c4bd7c191c4a7f5cf0481/apps/server/src/usage/usagePricing.ts): rate lookup, category pricing, provider-reported costs, speed tiers and cache savings.
- [`packages/contracts/src/usage.ts`](https://github.com/pingdotgg/t3code/blob/79f3ee139b99a932178c4bd7c191c4a7f5cf0481/packages/contracts/src/usage.ts): disjoint token totals, explicit cost source/category fields, source fingerprints, distinct sessions and time-zone-aware buckets.
- [`LICENSE`](https://github.com/pingdotgg/t3code/blob/79f3ee139b99a932178c4bd7c191c4a7f5cf0481/LICENSE): included in `THIRD_PARTY_NOTICES.md`, the adapted helper, and the single-file HTML's inert JSON notice. The notice is not a rendered disclosure.

## Mapping to the proxy's existing contract

| T3 approach | This frontend |
| --- | --- |
| Cost/Tokens views | Top toggle changes primary total, timeline, model order, share metric and proportional bars. Period and aggregate/per-client controls remain. |
| Primary total beside trend | Estimated cost or processed tokens is the primary figure; execution attempts/outcomes and cache read rate are secondary. Estimated savings is integrated with token totals, not a separate bottom pricing panel. |
| Model table `#, Model, Cost, Share, Tokens` | Same columns and ranking approach in existing CLI Proxy theme. Cost descends with known amounts before unavailable; equal amounts use model identifier order, independent of locale/response order. Token mode includes unpriced models. |
| Cost and token shares | Cost denominator is the sum of known model cost subtotals. Missing cost or zero denominator gives unavailable, not 0%. Token share uses observed model tokens; zero total also gives unavailable. |
| Small under-model bar | Width is amount/maximum for the selected metric, without upstream's minimum decorative pixel floor. Unknown/zero amounts do not receive a fake positive bar. |
| Unknown cost | T3 internally uses zero plus `unpricedRecords` to detect fully unknown models. The plugin already sends nullable `estimatedCostUsd`; null is retained/displayed unavailable, while published/recorded zero remains an actual zero. Mixed rows retain their known subtotal. No visible coverage ratio or disclosure paragraphs. |
| Hour/day table | Chronological UTC rows, `Hour/Day, Total (estimated cost), Tokens`, keyed by the original timestamp rather than formatted label. Same columns in either metric mode. |
| Cache totals | Backend `totalTokens`, input, classified cache read/write, output, unclassified cached and estimated cache-read savings are preserved. Uncached input remains unavailable. Backend nullable cache rate is used directly, including a legitimate measured 0%. |
| Pricing | Existing models.dev estimates and immutable per-event plugin prices are unchanged. This is presentation adaptation, not a new catalog/ingestion/pricing implementation. Tiny positive, unavailable and genuine free amounts retain the existing USD formatter and normalization checks. |
| Missing time prices | Cost trend breaks at null prices, rather than drawing them as free usage or bridging them. A single known bucket is drawn as a point. |

## Deliberate non-parity and exact contract gaps

- T3's Codex, Claude Code and Pi are CLI transcript **sources**, not the proxy's provider/model/client dimensions. The plugin exposes aggregate timeline and model totals but no provider-by-time cross-product or source sessions. Therefore there are no invented source columns, provider trend series, source totals, or session counts. True parity requires classified source/provider identity on stored events and grouped provider-by-time API totals, plus an independently justified session identity definition.
- T3 has disjoint uncached input/cached input/cache creation/output totals. The proxy ABI can lose original token presence and accounting quality; canonical input can overlap cached counters. Do not infer uncached input by subtraction, recompute processed totals by adding overlapping counters, or draw a token-type allocation bar from them. Exact parity needs canonical disjoint token fields and presence/quality metadata from the backend.
- T3 can compute category costs, provider-reported adjustments and speed premiums because its pricing layer supplies those fields. This plugin response supplies estimated total cost and savings, not immutable input/cache-read/cache-write/output costs or speed costs. No token-type cost allocation, stacked cost-by-type chart, or speed premium is fabricated. Exact parity requires per-event monetary category values persisted alongside the event's original price snapshot, with reconciliation exposed in model/time/aggregate API summaries.
- T3 pricing uses LiteLLM-style per-token rates, optional user overrides, cached-input fallback to input rates, variant normalization and current transcript repricing. Those policies are not copied. Keep the user's models.dev provider-scoped price selection, conservative unsupported-rate handling, historical unknowns and immutable event estimates. No browser catalog lookup, retroactive price override, transcript ingestion, backend/plugin/database modification or live inference is included.
- T3's UI presents newest time rows first; this implementation deliberately uses chronological order as requested. Its undefined zero-denominator shares are also tightened to null as requested.

## Verification

Repository-pinned Bun 1.4.3. Focused behavior/contract tests cover deterministic ranking, known-zero versus unknown, shares, proportional bars, both metrics, model and hour/day column sets, aggregate/per-client fixture reconciliation, cache rate null versus measured zero, preserved estimated semantics and absence of coverage ratios/disclosures. Seven locale key/placeholder/a11y parity is tested.

`tests/browser/verifyUsageShell.mjs` renders the real authenticated MainLayout at `#/usage`, using synthetic data only. It blocks all non-loopback network traffic and checks desktop 1440px and mobile 390px: exact columns, cost/token ranking and shares, bar widths, primary total and chart switches, chronological Hour/Day, per-client filtering, refresh, theme, page overflow, Observe navigation and refresh/topbar nonintersection. Evidence is saved outside the repository to `/home/ubuntu/.hermes/cache/scratch/t3-usage-evidence/`, including screenshots and measured `checks.json`. These are not live usage measurements.

Final verification: focused usage behavior, presentation, localization, route and pricing contract suites passed (40 tests); full suite reached 1,908 passing tests and the one baseline cooldown failure (1,909 total). ESLint passed. TypeScript and the production Vite build passed, producing only `dist/index.html`; the complete T3 MIT notice was parsed back from that built HTML. Browser checks passed in both viewport sizes and all requested modes/metrics, with no page overflow or refresh/topbar intersection.

Full `bun run verify` reaches one pre-existing full-suite failure: `tests/authFileCooldowns.test.ts`, `cooldown section rendering > keeps the reset action contextual and exposes pending state`, line 228. React escapes the apostrophe in a title, but the assertion searches raw text. This was reproduced by running the full test suite in an untouched detached worktree at baseline `2482b06`; the same test passes when run alone. No unrelated cooldown code/test was changed. Run lint and build separately because verify stops at the test failure. The existing Vite native-config `__dirname` warning is unrelated.
