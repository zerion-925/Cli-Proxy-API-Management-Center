// Synthetic pricing fixture only; never imported by production src.
// These test amounts/version are not a fetched models.dev price quote.
import legacy from './usage-meter-official-runtime.json';

const pricedFields = (attempts: number) => ({
  priced_attempts: attempts >= 2 ? 2 : 0,
  savings_priced_attempts: attempts >= 2 ? 2 : 0,
  estimated_cost_usd: attempts >= 2 ? 0.024 : null,
  estimated_cache_savings_usd: attempts >= 2 ? 0.006 : null,
});
export const pricedResponse = {
  ...legacy,
  pricing: {
    available: true,
    source: 'models.dev',
    currency: 'USD',
    status: 'ready',
    snapshot_version: 'a'.repeat(64),
    fetched_at: '2026-11-01T12:00:00Z',
    snapshot_versions: ['a'.repeat(64)],
    priced_attempts: 2,
    unpriced_attempts: 1,
    estimated_cost_usd: 0.024,
    estimated_cache_savings_usd: 0.006,
    savings_priced_attempts: 2,
    reason: 'Synthetic fixture only, not a fetched price quote',
  },
  totals: { ...legacy.totals, ...pricedFields(legacy.totals.attempts) },
  models: legacy.models.map((row) => ({ ...row, ...pricedFields(row.attempts) })),
  timeline: legacy.timeline.map((row) => ({ ...row, ...pricedFields(row.attempts) })),
};
