// Isolated synthetic browser fixture only. Never imported by src or production build.
export const fixtureClients = [
  { id: 'native_0123456789abcdef0123456789abcdef', namespace: 'native', label: 'Synthetic A' },
  { id: 'plugin_abcdef0123456789abcdef0123456789', namespace: 'plugin', label: 'Synthetic B' },
];
export function fixtureUsage(range = '24h', selected = '') {
  const now = Date.now();
  const days = ({ '24h': 1, '7d': 7, '30d': 30, '90d': 90 } as Record<string, number>)[range] ?? 1;
  const from = now - days * 86400000;
  const weights = [2, 3, 2, 6, 12, 14, 9, 4, 2, 1, 2, 7, 12, 18, 13, 6, 3, 1, 4, 11, 16, 12, 5, 2];
  const factor = selected === fixtureClients[0].id ? 1 : selected === fixtureClients[1].id ? 2 : 3;
  const metric = (n: number) => ({
    attempts: n,
    succeeded: n,
    failed: 0,
    requests: null,
    input_tokens: n * 1000,
    output_tokens: n * 120,
    cache_read_tokens: n * 600,
    cache_write_tokens: n * 40,
    unclassified_cached_tokens: 0,
    total_tokens: n * 1760,
    cache_rate: n ? 600 / 1640 : null,
    cache_rate_denominator: n * 1640,
    unknown_token_events: 0,
  });
  const count = weights.reduce((sum, value) => sum + value * factor, 0);
  return {
    schema_version: 1,
    collection: {
      state: 'partial',
      started_at: new Date(now - 3 * 86400000).toISOString(),
      earliest_event_at: new Date(now - 2 * 86400000).toISOString(),
      retention_days: 90,
      delivery: 'best_effort',
      ingestion_failures: 0,
      dropped_events: 0,
      duplicates: 2,
      missing_execution_ids: 0,
      coverage_note: 'Synthetic fixture only',
    },
    window: {
      from: new Date(from).toISOString(),
      to: new Date(now).toISOString(),
      bucket: days === 1 ? 'hour' : 'day',
    },
    clients: fixtureClients,
    selected_client: selected || null,
    totals: metric(count),
    timeline: weights.map((n, i) => ({
      time: new Date(from + i * days * 3600000).toISOString(),
      ...metric(n * factor),
    })),
    models: [
      { model: 'synthetic-model-a', ...metric(Math.floor(count / 3)) },
      { model: 'synthetic-model-b', ...metric(count - Math.floor(count / 3)) },
    ],
    pricing: { available: false, reason: 'No configured prices' },
  };
}
