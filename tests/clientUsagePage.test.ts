import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

describe('dedicated client usage route', () => {
  test('Observe links to the dedicated usage page, not an embedded dashboard meter', () => {
    const layout = source('components/layout/MainLayout.tsx');
    const observe = layout.slice(layout.indexOf("id: 'observe'"), layout.indexOf("id: 'control'"));
    expect(observe).toContain("path: '/usage'");
    expect(observe).toContain("labelKey: 'nav.client_usage'");
    expect(observe).toContain("metaKey: 'nav_meta.client_usage'");
    expect(source('router/MainRoutes.tsx')).toContain(
      "{ path: '/usage', element: <ClientUsagePage /> }"
    );
    expect(source('features/dashboard/DashboardPage.tsx')).not.toContain('ClientUsageMeter');
    expect(source('features/dashboard/ClientUsagePage.tsx')).toContain('<ClientUsageMeter />');
  });
  test('all seven locales translate the usage navigation label and description', () => {
    for (const locale of ['en', 'zh-CN', 'zh-TW', 'ru', 'vi', 'ko', 'tr']) {
      const translations = JSON.parse(source(`i18n/locales/${locale}.json`));
      expect(translations.nav.client_usage?.trim()).toBeTruthy();
      expect(translations.nav_meta.client_usage?.trim()).toBeTruthy();
    }
  });
});
