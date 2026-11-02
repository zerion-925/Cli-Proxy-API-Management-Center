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
  test('shows compact partial coverage beside cost without any disclosure content', () => {
    const html = render();
    expect(html).toContain('usage_meter.pricing_subtotal');
    expect(html).toContain('(2/3)');
    expect(html).toContain('usage_meter.pricing_coverage_a11y');
    expect(html).toContain('USD');
    expect(html).not.toContain('<details');
    expect(html).not.toContain('<p>');
    for (const text of [
      'models.dev',
      'aaaaaaaa',
      'pricing_provenance',
      'pricing_not_bill',
      'pricing_history',
      'pricing_units',
      'pricing_fetched',
      'pricing_snapshot',
      'pricing_applied_versions',
      'pricing_status',
      'pricing_savings_coverage',
    ]) {
      expect(html).not.toContain(text);
    }
  });
  test('fully priced costs do not add coverage', () => {
    const raw = structuredClone(pricedResponse);
    raw.pricing.unpriced_attempts = 0;
    raw.pricing.priced_attempts = 3;
    raw.totals.priced_attempts = 3;
    expect(render(raw)).not.toContain('(3/3)');
    expect(render(raw)).not.toContain('pricing_coverage_a11y');
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
