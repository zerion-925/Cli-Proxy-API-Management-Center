import { expect, test } from 'bun:test';
import { normalizeClientUsage, saveClientName } from '../src/services/api/clientUsage';
import { apiClient } from '../src/services/api/client';
import { clientDisplayName } from '../src/features/dashboard/clientNames';
import { response, totals } from './clientUsageMeter.test';

test('names take precedence, hints are masked, and duplicate hints stay distinguishable', () => {
  const raw = {
    ...response,
    clients: [{ ...response.clients[0], name: 'Team A', key_hint: 'sk-demo••••' }],
    client_usage: [{ client: response.clients[0].id, models: ['model-a'], ...totals }],
  };
  const data = normalizeClientUsage(raw);
  expect(clientDisplayName(data.clients[0], 'API key')).toBe('Team A');
  data.clients[0].name = '';
  expect(clientDisplayName(data.clients[0], 'API key')).toBe('sk-demo••••');
  const other = { ...data.clients[0], id: 'native_abcdef0123456789abcdef0123456789' };
  expect(clientDisplayName(data.clients[0], 'API key', [...data.clients, other])).not.toBe(
    clientDisplayName(other, 'API key', [...data.clients, other])
  );
  expect(data.clientUsage[0].models).toEqual(['model-a']);
  expect(data.clientUsage[0].attempts).toBe(3);
  expect(() =>
    normalizeClientUsage({
      ...raw,
      clients: [{ ...raw.clients[0], key_hint: 'sk-unmasked-private-key' }],
    })
  ).toThrow();
});

test('old plugin labels are ignored and missing new fields remain compatible', () => {
  const data = normalizeClientUsage(response);
  expect(data.clients[0].name).toBe('');
  expect(data.clients[0].keyHint).toBe('');
  expect(data.clientUsage).toEqual([]);
});

test('label updates use the authenticated plugin endpoint', async () => {
  let received: unknown;
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      received = {
        method: request.method,
        path: new URL(request.url).pathname,
        auth: request.headers.get('Authorization'),
        body: await request.json(),
      };
      return Response.json({ saved: true });
    },
  });
  try {
    const apiBase = `http://127.0.0.1:${server.port}`;
    apiClient.setConfig({ apiBase, managementKey: 'synthetic-management' });
    await saveClientName(apiBase, response.clients[0].id, 'Team A');
    expect(received).toEqual({
      method: 'PUT',
      path: '/v0/management/client-usage-meter/client-label',
      auth: 'Bearer synthetic-management',
      body: { client: response.clients[0].id, name: 'Team A' },
    });
  } finally {
    server.stop(true);
    apiClient.setConfig({ apiBase: '', managementKey: '' });
  }
});
