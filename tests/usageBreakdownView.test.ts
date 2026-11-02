import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { UsageBreakdown } from '../src/features/dashboard/components/UsageBreakdown';
import { normalizeClientUsage } from '../src/services/api/clientUsage';
import { pricedResponse } from './fixtures/usagePricing';
const i18n = createInstance();
await i18n.init({ lng: 'cimode', resources: {} });
const data = normalizeClientUsage(pricedResponse);
data.models.push({
  ...data.models[0],
  model: 'unpriced-model',
  pricedAttempts: 0,
  estimatedCostUsd: null,
});
const render = (
  mode: 'model' | 'time',
  bucket: 'hour' | 'day' = 'hour',
  metric: 'cost' | 'tokens' = 'cost'
) =>
  renderToStaticMarkup(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(UsageBreakdown, {
        models: data.models,
        timeline: data.timeline,
        mode,
        bucket,
        metric,
      })
    )
  );
describe('usage breakdown table', () => {
  test('model table has exactly rank, model, cost, share, tokens and real bars', () => {
    const html = render('model');
    const head = html.match(/<thead>[\s\S]*?<\/thead>/)![0];
    expect(head.match(/<th /g)?.length).toBe(5);
    for (const key of ['rank', 'model', 'cost', 'share', 'tokens'])
      expect(head).toContain(`usage_meter.${key}`);
    expect(html).toContain('width:100%');
    expect(html).toContain('usage_meter.unavailable');
    expect(html).not.toContain('pricing_priced_attempts');
    expect(html).not.toContain('usage_meter.success');
    expect(html).not.toContain('usage_meter.failed');
  });
  test('time table has only chronological Hour/Day, Total cost, Tokens in both metrics', () => {
    for (const bucket of ['hour', 'day'] as const)
      for (const metric of ['cost', 'tokens'] as const) {
        const html = render('time', bucket, metric);
        const head = html.match(/<thead>[\s\S]*?<\/thead>/)![0];
        expect(head.match(/<th /g)?.length).toBe(3);
        expect(head).toContain(`usage_meter.bucket_${bucket}`);
        expect(head).toContain('usage_meter.total_cost');
        expect(head).toContain('usage_meter.tokens');
        for (const forbidden of ['Codex', 'Claude Code', 'Pi', 'usage_meter.attempts'])
          expect(html).not.toContain(forbidden);
      }
  });
});
