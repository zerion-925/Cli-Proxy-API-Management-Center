import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { normalizeClientUsage } from '../src/services/api/clientUsage';

const legacy = JSON.parse(
  readFileSync(new URL('./fixtures/usage-meter-official-runtime.json', import.meta.url), 'utf8')
);
import { pricedResponse } from './fixtures/usagePricing';

describe('models.dev pricing contract', () => {
  test('accepts actual priced wire data from the official proxy and compiled plugin', () => {
    const wire = readFileSync(
      new URL('./fixtures/usage-meter-pricing-official-runtime.json', import.meta.url),
      'utf8'
    );
    const raw = JSON.parse(wire);
    const result = normalizeClientUsage(raw);
    expect(result.pricing.source).toBe('models.dev');
    expect(result.pricing.pricedAttempts).toBe(2);
    expect(result.pricing.unpricedAttempts).toBe(4);
    expect(result.pricing.estimatedCostUsd).toBe(raw.pricing.estimated_cost_usd);
    expect(result.pricing.snapshotVersions).toEqual(raw.pricing.snapshot_versions);
    expect(result.models.reduce((sum, row) => sum + (row.estimatedCostUsd ?? 0), 0)).toBeCloseTo(
      result.pricing.estimatedCostUsd!,
      12
    );
    expect(result.timeline.reduce((sum, row) => sum + row.pricedAttempts, 0)).toBe(2);
    expect(wire).not.toContain('synthetic-client-key');
    expect(wire).not.toContain('synthetic prompt');
  });
  test('normalizes priced subtotals with source, immutable versions, date and coverage', () => {
    const result = normalizeClientUsage(pricedResponse);
    expect(result.pricing.available).toBe(true);
    expect(result.pricing.source).toBe('models.dev');
    expect(result.pricing.currency).toBe('USD');
    expect(result.pricing.pricedAttempts).toBe(2);
    expect(result.pricing.unpricedAttempts).toBe(1);
    expect(result.pricing.estimatedCostUsd).toBe(0.024);
    expect(result.pricing.estimatedCacheSavingsUsd).toBe(0.006);
    expect(result.pricing.snapshotVersions).toEqual(['a'.repeat(64)]);
    expect(result.totals.estimatedCostUsd).toBe(0.024);
  });
  test('accepts old unpriced plugin response without fabricating cost or price freshness', () => {
    const result = normalizeClientUsage(legacy);
    expect(result.pricing.available).toBe(false);
    expect(result.pricing.estimatedCostUsd).toBeNull();
    expect(result.pricing.fetchedAt).toBeNull();
    expect(result.pricing.unpricedAttempts).toBe(result.totals.attempts);
    expect(result.totals.estimatedCostUsd).toBeNull();
  });
  test('preserves explicit free prices instead of treating them as missing', () => {
    const result = normalizeClientUsage({
      ...pricedResponse,
      pricing: { ...pricedResponse.pricing, estimated_cost_usd: 0 },
      totals: { ...pricedResponse.totals, estimated_cost_usd: 0 },
    });
    expect(result.pricing.estimatedCostUsd).toBe(0);
  });
  test('preserves stale cached estimates with their original source and versions', () => {
    const result = normalizeClientUsage({
      ...pricedResponse,
      pricing: { ...pricedResponse.pricing, status: 'stale' },
    });
    expect(result.pricing.status).toBe('stale');
    expect(result.pricing.estimatedCostUsd).toBe(0.024);
  });
  test('rejects malformed priced metric coverage instead of showing contradictory row costs', () => {
    expect(() =>
      normalizeClientUsage({
        ...pricedResponse,
        totals: { ...pricedResponse.totals, priced_attempts: 4 },
      })
    ).toThrow();
    expect(() =>
      normalizeClientUsage({
        ...pricedResponse,
        totals: { ...pricedResponse.totals, priced_attempts: 0 },
      })
    ).toThrow();
  });
  test('rejects contradictory pricing summaries and savings coverage', () => {
    for (const pricing of [
      { ...pricedResponse.pricing, estimated_cost_usd: 999 },
      {
        ...pricedResponse.pricing,
        priced_attempts: 1,
        unpriced_attempts: 2,
        savings_priced_attempts: 1,
      },
      { ...pricedResponse.pricing, savings_priced_attempts: 0 },
      { ...pricedResponse.pricing, estimated_cache_savings_usd: null },
    ])
      expect(() => normalizeClientUsage({ ...pricedResponse, pricing })).toThrow();
    expect(() =>
      normalizeClientUsage({
        ...pricedResponse,
        totals: { ...pricedResponse.totals, estimated_cache_savings_usd: null },
      })
    ).toThrow();
    expect(() =>
      normalizeClientUsage({
        ...pricedResponse,
        pricing: { ...pricedResponse.pricing, estimated_cost_usd: 0.024000000000000004 },
      })
    ).not.toThrow();
  });
  test('rejects malformed money, non-USD pricing and impossible coverage', () => {
    for (const pricing of [
      { ...pricedResponse.pricing, estimated_cost_usd: -1 },
      { ...pricedResponse.pricing, currency: 'INR' },
      { ...pricedResponse.pricing, snapshot_version: 'https://untrusted.invalid' },
      { ...pricedResponse.pricing, priced_attempts: 4 },
      { ...pricedResponse.pricing, unpriced_attempts: 0 },
      { ...pricedResponse.pricing, estimated_cost_usd: null },
    ])
      expect(() => normalizeClientUsage({ ...pricedResponse, pricing })).toThrow();
  });
});
