# models.dev cost estimates

This feature requires the pricing-capable native usage plugin (plugin metadata version1.1.0) and the matching frontend. The original v1.0.0 frontend release does not display these new pricing responses.

## Source and refresh

The plugin anonymously downloads the fixed public `https://models.dev/api.json` endpoint in a background worker. No client keys, prompts, usage, model queries, host credentials or environment-proxy credentials are sent to models.dev. Rates are USD per million tokens, verified against the official documentation. The catalog is community-maintained reference data, not your provider's invoice or private contract.

Pricing is enabled by default. A successful normalized catalog is persisted in the existing owner-only SQLite database and refreshed approximately every24 hours. The downloader has a10-second timeout and16 MiB body limit, rejects unsafe redirects and invalid data, and never waits on the inference callback. Failed refreshes preserve the last good cache and expose stale/error status. `pricing_enabled: false` stops pricing downloads/new estimates without erasing previously priced events.

## Exact matching

Automatic native provider mappings are `openai → openai`, `codex → openai`, `claude → anthropic` and `gemini → google`. A model ID must match exactly within that provider. There is no arbitrary reseller selection, fuzzy model matching or guessed suffix/date removal.

Custom gateways and aliases need explicit `pricing_provider_map` and `pricing_model_map` values. See the [plugin README](https://github.com/zerion-925/cli-proxy-usage-meter#modelsdev-pricing) for YAML/JSON-string examples and the requirement to use the actual emitted provider ID. Client access keys and provider pricing identities are different things; never put keys in these mappings.

## Accounting and history

- Estimates use the SDK's reconstructed disjoint uncached input, cache-read, cache-write and output/reasoning buckets. They do not add cache/reasoning to raw totals twice.
- Missing required rates remain unavailable. An explicitly published numeric zero is a valid zero price; an absent field is not.
- Classified, standard text usage with supported price dimensions can be estimated. Unknown counters, unresolved/nonstandard service tiers, unsupported modality/tier prices, and cache writes whose TTL cannot be established remain unpriced.
- Context tiers use the actual per-event reconstructed input count and the catalog's exact threshold. A missing required tier-specific rate is not replaced with a guessed base rate.
- Cache-read savings require comparable published uncached/read prices. Savings have separate coverage and can be unavailable even when a cost subtotal exists.
- Every priced event saves its estimate and catalog version at ingestion. Catalog refreshes or restarts do not rewrite those estimates. Earlier unpriced events are not retrospectively billed from today's price list.
- One normalized current catalog is cached. Referenced historical version metadata and immutable event amounts remain; full historical catalog bodies are not archived.
- Subscription/OAuth estimates are API-equivalent list-price comparisons, not subscription charges. Original field presence/quality lost by the seven-counter plugin ABI cannot be recovered by pricing.

## Usage page

The dedicated Observe → Client usage page displays estimated cost and cache-read savings. Partial priced coverage appears only beside the cost label, for example **Estimated cost (6/9)**, with a localized accessible description. Fully priced totals omit the fraction. Provider/model misses or unavailable accounting never appear as a fake free bill.

Collection/accounting explanations and pricing source, status, date, hash and historical-version disclosures are documentation-only, not rendered content or expandable disclosures. Backend provenance and normalization remain unchanged. Ordinary partial selected-window coverage is not a collection fault and has no persistent badge. Disabled collection and actual ingestion failures/dropped events retain concise status messages.

Model/hour/day tables show priced-attempt coverage alongside estimated subtotals. USD amounts retain small positive values rather than rounding them to zero. All seven locales include the new labels and accessible descriptions.

## Verification

The plugin's `make verify` and `make runtime-race` exercise persistence, refresh failure, exact mappings, token accounting, missing/zero/tier prices, migration, dedupe and concurrency. `MODELS_DEV_LIVE=1 ... -run TestLiveModelsDevCatalog` additionally checks the anonymous public endpoint and real normalization.

The official-host integration uses a local synthetic inference upstream and actual public models.dev prices. Its sanitized priced wire recording is `tests/fixtures/usage-meter-pricing-official-runtime.json`. The frontend normalizer and isolated browser fixture both consume that recording. No paid API or production traffic is used. Separate `pricing`/`pricing-stale` browser modes use explicitly synthetic amounts solely for UI edge-case testing; they are not fetched quotes.
