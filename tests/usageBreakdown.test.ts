import { describe, expect, test } from 'bun:test';
import { normalizeClientUsage } from '../src/services/api/clientUsage';
import { pricedResponse } from './fixtures/usagePricing';
import { fixtureBreakdown } from './browser/usageBreakdownFixture';
import { fixtureClients } from './browser/usageMeterFixture';
import { modelBreakdown, chronologicalBuckets } from '../src/features/dashboard/usageBreakdown';

const metrics = normalizeClientUsage(pricedResponse).totals;
const model = (name: string, cost: number | null, tokens = 10) => ({
  ...metrics,
  model: name,
  estimatedCostUsd: cost,
  pricedAttempts: cost === null ? 0 : 1,
  totalTokens: tokens,
});
describe('usage model breakdown', () => {
  test('synthetic browser evidence reconciles aggregates, clients, model/time money and tokens', () => {
    for (const range of ['24h', '7d', '30d', '90d']) {
      const all = normalizeClientUsage(fixtureBreakdown(range));
      const clients = fixtureClients.map((client) =>
        normalizeClientUsage(fixtureBreakdown(range, client.id))
      );
      for (const field of [
        'attempts',
        'totalTokens',
        'pricedAttempts',
        'estimatedCostUsd',
        'estimatedCacheSavingsUsd',
      ] as const) {
        const sum = (rows: typeof all.models | typeof all.timeline) =>
          rows.reduce((total, row) => total + (row[field] ?? 0), 0);
        expect(sum(all.models)).toBeCloseTo(all.totals[field]!);
        expect(sum(all.timeline)).toBeCloseTo(all.totals[field]!);
        expect(
          clients.reduce((total, client) => total + (client.totals[field] ?? 0), 0)
        ).toBeCloseTo(all.totals[field]!);
      }
    }
  });
  test('cost ranks known amounts before unknown with deterministic model ties and proportional bars', () => {
    const input = [model('unknown', null, 100), model('z', 2), model('a', 2), model('free', 0)];
    const rows = modelBreakdown(input, 'cost');
    expect(rows.map((row) => row.model)).toEqual(['a', 'z', 'free', 'unknown']);
    expect(rows.map((row) => row.share)).toEqual([0.5, 0.5, 0, null]);
    expect(rows.map((row) => row.bar)).toEqual([1, 1, 0, null]);
    expect(input[0].model).toBe('unknown');
  });
  test('zero priced subtotal has no cost shares and unknown is never a free amount', () => {
    const rows = modelBreakdown([model('unknown', null), model('free', 0)], 'cost');
    expect(rows.map((row) => row.share)).toEqual([null, null]);
    expect(rows[1].estimatedCostUsd).toBeNull();
    expect(rows.map((row) => row.bar)).toEqual([null, null]);
  });
  test('tokens rank and share include unpriced models without changing their cost', () => {
    const rows = modelBreakdown([model('known', 2, 25), model('unknown', null, 75)], 'tokens');
    expect(rows.map((row) => row.model)).toEqual(['unknown', 'known']);
    expect(rows.map((row) => row.share)).toEqual([0.75, 0.25]);
    expect(rows.map((row) => row.bar)).toEqual([1, 1 / 3]);
    expect(rows[0].estimatedCostUsd).toBeNull();
    expect(modelBreakdown([model('zero', null, 0)], 'tokens')[0].share).toBeNull();
  });
  test('time buckets are chronological, independent of amount or response order', () => {
    const rows = [
      { ...metrics, time: '2026-11-02T02:00:00Z' },
      { ...metrics, time: '2026-11-02T01:00:00Z' },
    ];
    expect(chronologicalBuckets(rows).map((row) => row.time)).toEqual([
      '2026-11-02T01:00:00Z',
      '2026-11-02T02:00:00Z',
    ]);
    expect(rows[0].time).toBe('2026-11-02T02:00:00Z');
  });
});
