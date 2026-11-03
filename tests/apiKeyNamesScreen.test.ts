import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { ApiKeyNames } from '../src/features/dashboard/components/ApiKeyNames';
import { normalizeClientUsage } from '../src/services/api/clientUsage';
import { response } from './clientUsageMeter.test';

const i18n = createInstance();
await i18n.init({ lng: 'cimode', resources: {} });
const render = (
  data: ReturnType<typeof normalizeClientUsage> | null,
  status: 'ready' | 'error' = 'ready'
) =>
  renderToStaticMarkup(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(ApiKeyNames, {
        data,
        status,
        onRefresh: () => {},
        onSaveName: async () => {},
      })
    )
  );

test('names screen includes retained keys without usage in the selected period', () => {
  const data = normalizeClientUsage(response);
  data.clients = [{ ...data.clients[0], name: 'Operations', keyHint: 'sk-demo••••' }];
  data.clientUsage = [];
  const html = render(data);
  expect(html).toContain('Operations');
  expect(html).toContain('sk-demo••••');
  expect(html).toContain('usage_meter.rename_key');
  expect(html).toContain('href="#/usage"');
  expect(html).not.toContain('<table');
  expect(html).not.toContain('usage_meter.attempts');
});

test('names screen excludes unattributed usage and handles empty/error responses', () => {
  const data = normalizeClientUsage(response);
  data.clients = data.clients.map((client) => ({ ...client, namespace: 'unattributed' }));
  expect(render(data)).toContain('usage_meter.key_names_empty');
  expect(render(data)).not.toContain('usage_meter.rename_key');
  expect(render(null, 'error')).toContain('role="alert"');
});
