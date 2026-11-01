import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fixtureUsage, fixtureClients } from './browser/usageMeterFixture';

const locales = ['en', 'zh-CN', 'zh-TW', 'ru', 'vi', 'ko', 'tr'];
const translations = (locale: string) =>
  JSON.parse(readFileSync(new URL(`../src/i18n/locales/${locale}.json`, import.meta.url), 'utf8'))
    .usage_meter as Record<string, string>;

describe('usage meter locale and fixture isolation', () => {
  test('all seven locales include matching keys, placeholders and accessible labels', () => {
    const english = translations('en');
    for (const locale of locales) {
      const values = translations(locale);
      expect(Object.keys(values).sort()).toEqual(Object.keys(english).sort());
      for (const [key, value] of Object.entries(english)) {
        expect(values[key].trim().length).toBeGreaterThan(0);
        expect(values[key].match(/{{\w+}}/g)?.sort() ?? []).toEqual(
          value.match(/{{\w+}}/g)?.sort() ?? []
        );
      }
      for (const key of [
        'client_a11y',
        'range_a11y',
        'breakdown_a11y',
        'table_a11y',
        'timeline_a11y',
      ])
        expect(values[key]).toBeTruthy();
    }
  });
  test('synthetic browser fixture reconciles both keys and never enters production imports', () => {
    const all = fixtureUsage();
    const clients = fixtureClients.map((client) => fixtureUsage('24h', client.id));
    for (const key of [
      'attempts',
      'succeeded',
      'failed',
      'total_tokens',
      'input_tokens',
      'output_tokens',
      'cache_read_tokens',
      'cache_write_tokens',
    ] as const) {
      expect(clients.reduce((sum, client) => sum + client.totals[key], 0)).toBe(all.totals[key]);
      expect(all.models.reduce((sum, model) => sum + model[key], 0)).toBe(all.totals[key]);
      expect(all.timeline.reduce((sum, point) => sum + point[key], 0)).toBe(all.totals[key]);
    }
    const view = readFileSync(
      new URL('../src/features/dashboard/components/ClientUsageMeter.tsx', import.meta.url),
      'utf8'
    );
    expect(view).not.toContain('Fixture');
    expect(view).not.toContain('localStorage');
    expect(view).toContain('getConnectionRevision');
    expect(view).toContain('controller.abort()');
    expect(view).toContain('setResult(null)');
  });
});
