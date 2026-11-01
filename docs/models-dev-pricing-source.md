# models.dev pricing source audit

Primary sources inspected for the client usage meter pricing extension:

- Public provider catalog: <https://models.dev/api.json>.
- Official repository documentation: <https://github.com/anomalyco/models.dev/blob/dev/README.md> (raw source <https://raw.githubusercontent.com/anomalyco/models.dev/dev/README.md>).
- Existing proxy token accounting: read-only sibling `CLIProxyAPI-upstream-audit/sdk/cliproxy/usage/accounting.go` and native callback conversion in `internal/pluginhost/adapters_usage_translation.go`.

## Verified source facts

The public API is keyed by provider ID, with provider-specific models keyed by exact model ID. The official README's API section explicitly recommends the model ID for lookup. Its cost-field documentation defines `input`, `output`, optional `reasoning`, `cache_read`, `cache_write`, `input_audio` and `output_audio` as USD per million tokens. Provider-agnostic model metadata is a separate endpoint and is not a substitute for provider-specific prices.

A successful real catalog retrieval during implementation produced valid JSON with235 providers and8,940 model entries. The retrieved bytes' SHA256 was `f2f089da079dbd94d318ccd2e4c6dd1941f9820342f2060397b91106a514c663`. This is provenance for the inspected response, not a permanent upstream release or historical effective-price date. The full catalog is not committed.

The actual response includes contextual price tiers under `cost.tiers`, and legacy `cost.context_over_200k` entries. For example, the inspected OpenAI model entry had a272,000-input-token contextual threshold, so a universal200,000 threshold would be incorrect. Models may also carry audio-specific or separate reasoning rates. Missing optional price fields must stay missing; explicit numeric zero is distinct from absent.

## Required accounting boundaries

- Resolve exact provider/model pairs. Never choose the first reseller that happens to list a model ID, or fuzzy-match an alias to a price.
- Interpret monetary output as an estimate from a dated, versioned catalog snapshot, not actual provider billing. OAuth/subscription usage can at most have a clearly labelled API-equivalent estimate.
- Preserve the snapshot used at ingestion. New source observations cannot establish what historical prices were before collection, and must not silently rewrite earlier estimates.
- Use the proxy SDK's disjoint reconstructed token breakdown, not raw input + cache + reasoning sums. The native ABI loses original field-presence/quality/cache-TTL information; uncertain usage remains unpriced or explicitly incomplete.
- Cache savings require actual comparable input/read rates and classified cache-read tokens. Cache-write pricing cannot assume an unknown TTL.
- Refresh failures must not destroy good cached data or block inference. Source status, snapshot identity/date, priced/unpriced coverage and unavailable costs must be visible.

The models.dev catalog is public community-maintained reference data. Its published list prices do not capture private discounts, subscription bills, every service tier or every modality charge. Those limitations must remain visible in the meter.
