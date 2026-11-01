import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { ClientUsageView } from '../src/features/dashboard/components/ClientUsageView';
import { UsagePricingSummary } from '../src/features/dashboard/components/UsagePricingSummary';
import { normalizeClientUsage } from '../src/services/api/clientUsage';
import { pricedResponse } from './fixtures/usagePricing';

const i18n = createInstance();
await i18n.init({ lng: 'cimode', resources: {} });
const render = (raw = pricedResponse) =>
  renderToStaticMarkup(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(UsagePricingSummary, { pricing: normalizeClientUsage(raw).pricing })
    )
  );

describe('models.dev estimate presentation', () => {
  test('breakdown shows priced-attempt coverage alongside estimated subtotals', () => {
    const html = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(ClientUsageView, {
          data: normalizeClientUsage(pricedResponse),
          status: 'ready',
          range: '24h',
          client: '',
          onRangeChange: () => {},
          onClientChange: () => {},
          onRefresh: () => {},
        })
      )
    );
    expect(html.match(/<thead>[\s\S]*?<\/thead>/)?.[0]).toContain(
      'usage_meter.pricing_priced_attempts'
    );
  });
  test('labels priced subtotal, coverage, real source and snapshot provenance', () => {
    const html = render();
    expect(html).toContain('https://models.dev');
    expect(html).toContain('usage_meter.pricing_subtotal');
    expect(html).toContain('usage_meter.pricing_coverage');
    expect(html).toContain('USD');
    expect(html).toContain('aaaaaaaaaaaa');
    expect(html).toContain('usage_meter.pricing_not_bill');
    expect(html).toContain('usage_meter.pricing_history');
  });
  test('stale data is visibly stale, not silently current', () => {
    const html = render({
      ...pricedResponse,
      pricing: { ...pricedResponse.pricing, status: 'stale' },
    });
    expect(html).toContain('usage_meter.pricing_status_stale');
  });
  test('no priced records remain unavailable rather than a free bill', () => {
    const html = render({
      ...pricedResponse,
      pricing: {
        ...pricedResponse.pricing,
        available: false,
        priced_attempts: 0,
        unpriced_attempts: 3,
        savings_priced_attempts: 0,
        estimated_cost_usd: null,
        estimated_cache_savings_usd: null,
        snapshot_versions: [],
      },
      totals: {
        ...pricedResponse.totals,
        priced_attempts: 0,
        savings_priced_attempts: 0,
        estimated_cost_usd: null,
        estimated_cache_savings_usd: null,
      },
    });
    expect(html).toContain('usage_meter.unavailable');
    expect(html).not.toContain('USD');
  });
  test('tiny positive costs are not rounded to a false zero', () => {
    const html = render({
      ...pricedResponse,
      pricing: { ...pricedResponse.pricing, estimated_cost_usd: 0.000000001 },
      totals: { ...pricedResponse.totals, estimated_cost_usd: 0.000000001 },
    });
    expect(html).toContain('&lt;');
  });
});
