import { fixtureUsage } from './usageMeterFixture';
import officialRuntime from '../fixtures/usage-meter-official-runtime.json';

let mode = 'ready';
Bun.serve({
  hostname: '127.0.0.1',
  port: 18419,
  fetch(request) {
    const url = new URL(request.url);
    const headers = {
      'Access-Control-Allow-Origin': 'http://127.0.0.1:18418',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers });
    if (request.headers.get('Authorization') !== 'Bearer fixture-management-only')
      return new Response('{}', { status: 401, headers });
    if (url.pathname === '/__fixture/mode' && request.method === 'POST') {
      mode = url.searchParams.get('value') ?? 'ready';
      return new Response('{}', { headers });
    }
    if (url.pathname !== '/v0/management/client-usage-meter')
      return new Response('{}', { status: 404, headers });
    if (mode === 'unsupported' || mode === 'error')
      return new Response('{}', { status: mode === 'unsupported' ? 404 : 503, headers });
    if (mode === 'official-runtime') {
      if (url.searchParams.get('client') || (url.searchParams.get('range') ?? '24h') !== '24h') {
        return new Response(
          '{"error":"Recorded official-runtime snapshot only supports aggregate 24h"}',
          { status: 400, headers }
        );
      }
      return new Response(JSON.stringify(officialRuntime), { headers });
    }
    const data = fixtureUsage(
      url.searchParams.get('range') ?? '24h',
      url.searchParams.get('client') ?? ''
    );
    if (mode === 'empty') {
      data.totals = {
        attempts: 0,
        succeeded: 0,
        failed: 0,
        requests: null,
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        unclassified_cached_tokens: 0,
        total_tokens: 0,
        cache_rate: null,
        cache_rate_denominator: 0,
        unknown_token_events: 0,
      };
      data.timeline = [];
      data.models = [];
    }
    return new Response(JSON.stringify(data), { headers });
  },
});
console.log('Synthetic usage fixture listening on 127.0.0.1:18419');
