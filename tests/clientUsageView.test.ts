import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClientUsageView } from '../src/features/dashboard/components/ClientUsageView';
import { normalizeClientUsage } from '../src/services/api/clientUsage';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { response } from './clientUsageMeter.test';

const i18n = createInstance();
await i18n.init({ lng: 'cimode', resources: {} });
const render = (props = {}) =>
  renderToStaticMarkup(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(ClientUsageView, {
        data: normalizeClientUsage(response),
        status: 'ready',
        range: '24h',
        client: '',
        onRangeChange: () => {},
        onClientChange: () => {},
        onRefresh: () => {},
        ...props,
      })
    )
  );
describe('client meter presentation', () => {
  test('shows explicit execution semantics and opaque clients without raw server labels', () => {
    const html = render();
    expect(html).toContain('usage_meter.attempts');
    expect(html).toContain('usage_meter.requests_unavailable');
    expect(html).toContain('usage_meter.reconstructed');
    expect(html).not.toContain('Do not trust key labels');
    expect(html).toContain('usage_meter.timeline_a11y');
  });
  test('unsupported and error states do not display invented metrics', () => {
    expect(render({ data: null, status: 'unsupported' })).toContain('usage_meter.unsupported');
    expect(render({ data: null, status: 'error' })).toContain('usage_meter.error');
    expect(render({ data: null, status: 'loading' })).toContain('usage_meter.loading');
  });
  test('does not draw backfilled zero buckets from before collection began', () => {
    const data = normalizeClientUsage({
      ...response,
      collection: { ...response.collection, started_at: '2026-11-02T00:00:00Z' },
    });
    const html = render({ data });
    expect(html).toContain('points=""');
    expect(html).not.toContain('NaN');
  });
  test('unknown zero token counters remain unavailable rather than measured zero', () => {
    const data = normalizeClientUsage({
      ...response,
      totals: {
        ...response.totals,
        attempts: 1,
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        unclassified_cached_tokens: 0,
        total_tokens: 0,
        cache_rate: null,
        cache_rate_denominator: 0,
        unknown_token_events: 1,
      },
    });
    expect(
      (render({ data }).match(/<dd>usage_meter.unavailable<\/dd>/g) ?? []).length
    ).toBeGreaterThanOrEqual(6);
  });
  test('empty collection renders an explicit no-history state', () => {
    const data = normalizeClientUsage({
      ...response,
      totals: { ...response.totals, attempts: 0 },
      timeline: [],
      models: [],
    });
    expect(render({ data })).toContain('usage_meter.empty');
  });
});
