// Synthetic presentation evidence only, not catalog quotes or backend recordings.
import { fixtureClients, fixtureUsage } from './usageMeterFixture';
export function fixtureBreakdown(range = '24h', selected = '') {
  const base = fixtureUsage(range, selected);
  const factor = selected === fixtureClients[0].id ? 1 : selected === fixtureClients[1].id ? 2 : 3;
  const metric = (tokens: number, cost: number | null, savings: number | null) => ({
    attempts: 2 * factor,
    succeeded: factor,
    failed: factor,
    requests: null,
    input_tokens: tokens * 0.8 * factor,
    output_tokens: tokens * 0.2 * factor,
    cache_read_tokens: tokens * 0.4 * factor,
    cache_write_tokens: 0,
    unclassified_cached_tokens: 0,
    total_tokens: tokens * factor,
    cache_rate: 0.5,
    cache_rate_denominator: tokens * 0.8 * factor,
    unknown_token_events: 0,
    priced_attempts: cost === null ? 0 : 2 * factor,
    savings_priced_attempts: savings === null ? 0 : 2 * factor,
    estimated_cost_usd: cost === null ? null : cost * factor,
    estimated_cache_savings_usd: savings === null ? null : savings * factor,
  });
  const models = [
    { model: 'synthetic-unpriced', ...metric(600, null, null) },
    { model: 'synthetic-economy', ...metric(300, 0.5, 0.1) },
    { model: 'synthetic-premium', ...metric(100, 2, 0.4) },
  ];
  const totals = {
    ...metric(1000, 2.5, 0.5),
    attempts: 6 * factor,
    succeeded: 3 * factor,
    failed: 3 * factor,
    priced_attempts: 4 * factor,
    savings_priced_attempts: 4 * factor,
  };
  const step = base.window.bucket === 'hour' ? 3600000 : 86400000;
  const end = Math.floor(Date.parse(base.window.to) / step) * step;
  return {
    ...base,
    models,
    totals,
    timeline: models
      .map(({ model: _model, ...row }, index) => ({
        ...row,
        time: new Date(end - (2 - index) * step).toISOString(),
      }))
      .reverse(),
    pricing: {
      available: true,
      source: 'models.dev',
      currency: 'USD',
      status: 'ready',
      snapshot_version: 'a'.repeat(64),
      fetched_at: base.window.to,
      snapshot_versions: ['a'.repeat(64)],
      priced_attempts: totals.priced_attempts,
      unpriced_attempts: 2 * factor,
      savings_priced_attempts: totals.savings_priced_attempts,
      estimated_cost_usd: totals.estimated_cost_usd,
      estimated_cache_savings_usd: totals.estimated_cache_savings_usd,
    },
  };
}
