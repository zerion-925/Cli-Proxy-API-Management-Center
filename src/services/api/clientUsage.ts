import { apiClient } from './client';
import { normalizeApiBase } from '@/utils/connection';
import { isRecord } from '@/utils/helpers';

export type UsageRange = '24h' | '7d' | '30d' | '90d';
export type UsageBucket = 'hour' | 'day';
export interface UsageMetrics {
  unpricedReasons?: Record<string, number>;
  attempts: number;
  succeeded: number;
  failed: number;
  requests: number | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  unclassifiedCachedTokens: number;
  totalTokens: number;
  cacheRate: number | null;
  cacheRateDenominator: number;
  unknownTokenEvents: number;
  pricedAttempts: number;
  savingsPricedAttempts: number;
  estimatedCostUsd: number | null;
  estimatedCacheSavingsUsd: number | null;
}
export interface UsagePricing {
  available: boolean;
  source: 'models.dev' | null;
  currency: 'USD' | null;
  status: 'loading' | 'ready' | 'stale' | 'error' | 'disabled' | 'unavailable';
  snapshotVersion: string | null;
  fetchedAt: string | null;
  snapshotVersions: string[];
  pricedAttempts: number;
  unpricedAttempts: number;
  savingsPricedAttempts: number;
  estimatedCostUsd: number | null;
  estimatedCacheSavingsUsd: number | null;
}
export interface ClientUsage {
  collection: {
    state: 'collecting' | 'partial' | 'disabled';
    startedAt: string;
    earliestEventAt: string | null;
    retentionDays: number;
    ingestionFailures: number;
    droppedEvents: number;
    duplicates: number;
    missingExecutionIds: number;
  };
  window: { from: string; to: string; bucket: UsageBucket };
  clients: {
    id: string;
    namespace: 'native' | 'plugin' | 'unattributed';
    name: string;
    keyHint: string;
  }[];
  clientUsage: (UsageMetrics & { clientId: string; models: string[] })[];
  selectedClient: string | null;
  totals: UsageMetrics;
  timeline: (UsageMetrics & { time: string })[];
  models: (UsageMetrics & { model: string })[];
  pricingAvailable: boolean;
  pricing: UsagePricing;
}

const invalid = (): never => {
  throw new Error('Invalid usage meter response');
};
const record = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : invalid());
const text = (value: unknown): string =>
  typeof value === 'string' && value.length <= 512 ? value : invalid();
const count = (value: unknown): number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : invalid();
const date = (value: unknown): string => {
  const result = text(value);
  return Number.isFinite(Date.parse(result)) ? result : invalid();
};
const list = (value: unknown, max: number): unknown[] =>
  Array.isArray(value) && value.length <= max ? value : invalid();
const id = (value: unknown): string => {
  const result = text(value);
  return /^(unattributed|(?:native|plugin)_[0-9a-f]{32})$/.test(result) ? result : invalid();
};
const money = (value: unknown, signed = false): number | null => {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value) <= Number.MAX_SAFE_INTEGER &&
    (signed || value >= 0)
    ? value
    : invalid();
};
const version = (value: unknown): string => {
  const result = text(value);
  return /^[a-f0-9]{64}$/.test(result) ? result : invalid();
};
const normalizePricing = (value: unknown, attempts: number): UsagePricing => {
  const raw = record(value);
  if (typeof raw.available !== 'boolean') invalid();
  if (!raw.available && raw.source === undefined && raw.status === undefined) {
    return {
      available: false,
      source: null,
      currency: null,
      status: 'unavailable',
      snapshotVersion: null,
      fetchedAt: null,
      snapshotVersions: [],
      pricedAttempts: 0,
      unpricedAttempts: attempts,
      savingsPricedAttempts: 0,
      estimatedCostUsd: null,
      estimatedCacheSavingsUsd: null,
    };
  }
  if (
    raw.source !== 'models.dev' ||
    raw.currency !== 'USD' ||
    !['loading', 'ready', 'stale', 'error', 'disabled'].includes(String(raw.status))
  )
    invalid();
  const priced = count(raw.priced_attempts);
  const unpriced = count(raw.unpriced_attempts);
  const savingsPriced =
    raw.savings_priced_attempts === undefined ? 0 : count(raw.savings_priced_attempts);
  const cost = money(raw.estimated_cost_usd);
  const savings = money(raw.estimated_cache_savings_usd, true);
  const versions = list(raw.snapshot_versions, 512).map(version);
  if (
    priced + unpriced !== attempts ||
    savingsPriced > priced ||
    raw.available !== priced > 0 ||
    (priced > 0 && (cost === null || versions.length === 0)) ||
    (priced === 0 && (cost !== null || savings !== null)) ||
    (savingsPriced === 0) !== (savings === null)
  )
    invalid();
  return {
    available: raw.available === true,
    source: 'models.dev',
    currency: 'USD',
    status: raw.status as UsagePricing['status'],
    snapshotVersion: raw.snapshot_version === null ? null : version(raw.snapshot_version),
    fetchedAt: raw.fetched_at === null ? null : date(raw.fetched_at),
    snapshotVersions: versions,
    pricedAttempts: priced,
    unpricedAttempts: unpriced,
    savingsPricedAttempts: savingsPriced,
    estimatedCostUsd: cost,
    estimatedCacheSavingsUsd: savings,
  };
};
const metrics = (value: unknown): UsageMetrics => {
  const raw = record(value);
  const rate = raw.cache_rate;
  if (rate !== null && (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0 || rate > 1))
    invalid();
  const result: UsageMetrics = {
    unpricedReasons: Object.fromEntries(
      Object.entries(record(raw.unpriced_reasons ?? {})).map(([key, value]) => [key, count(value)])
    ),
    attempts: count(raw.attempts),
    succeeded: count(raw.succeeded),
    failed: count(raw.failed),
    // This ABI cannot identify unique inbound requests. Do not promote trace IDs to counts.
    requests: raw.requests === null ? null : invalid(),
    inputTokens: count(raw.input_tokens),
    outputTokens: count(raw.output_tokens),
    cacheReadTokens: count(raw.cache_read_tokens),
    cacheWriteTokens: count(raw.cache_write_tokens),
    unclassifiedCachedTokens: count(raw.unclassified_cached_tokens),
    totalTokens: count(raw.total_tokens),
    cacheRate: rate as number | null,
    cacheRateDenominator: count(raw.cache_rate_denominator),
    unknownTokenEvents: count(raw.unknown_token_events),
    pricedAttempts: raw.priced_attempts === undefined ? 0 : count(raw.priced_attempts),
    savingsPricedAttempts:
      raw.savings_priced_attempts === undefined ? 0 : count(raw.savings_priced_attempts),
    estimatedCostUsd: money(raw.estimated_cost_usd),
    estimatedCacheSavingsUsd: money(raw.estimated_cache_savings_usd, true),
  };
  if (
    result.pricedAttempts > result.attempts ||
    result.savingsPricedAttempts > result.pricedAttempts ||
    (result.pricedAttempts === 0 && result.estimatedCostUsd !== null) ||
    (result.pricedAttempts > 0 && result.estimatedCostUsd === null) ||
    (result.savingsPricedAttempts === 0) !== (result.estimatedCacheSavingsUsd === null)
  )
    invalid();
  return result;
};

export const normalizeClientUsage = (value: unknown): ClientUsage => {
  const raw = record(value);
  if (raw.schema_version !== 1) invalid();
  const collection = record(raw.collection);
  const state = collection.state;
  if (state !== 'collecting' && state !== 'partial' && state !== 'disabled') invalid();
  const window = record(raw.window);
  if (window.bucket !== 'hour' && window.bucket !== 'day') invalid();
  const totals = metrics(raw.totals);
  const pricing = normalizePricing(raw.pricing, totals.attempts);
  // Independently accumulated floats can differ at machine precision, not at billing scale.
  const sameMoney = (a: number | null, b: number | null): boolean =>
    a === null || b === null
      ? a === b
      : Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b), Number.MIN_VALUE) * 1e-10;
  if (
    pricing.pricedAttempts !== totals.pricedAttempts ||
    pricing.savingsPricedAttempts !== totals.savingsPricedAttempts ||
    !sameMoney(pricing.estimatedCostUsd, totals.estimatedCostUsd) ||
    !sameMoney(pricing.estimatedCacheSavingsUsd, totals.estimatedCacheSavingsUsd)
  )
    invalid();
  return {
    collection: {
      state: state as ClientUsage['collection']['state'],
      startedAt: date(collection.started_at),
      earliestEventAt:
        collection.earliest_event_at === null ? null : date(collection.earliest_event_at),
      retentionDays: count(collection.retention_days),
      ingestionFailures: count(collection.ingestion_failures),
      droppedEvents: count(collection.dropped_events),
      duplicates: count(collection.duplicates),
      missingExecutionIds: count(collection.missing_execution_ids),
    },
    window: { from: date(window.from), to: date(window.to), bucket: window.bucket as UsageBucket },
    clients: list(raw.clients, 10001).map((value) => {
      const client = record(value);
      if (!['native', 'plugin', 'unattributed'].includes(String(client.namespace))) invalid();
      // Ignore legacy labels. Only use explicit administrator names and validated masked hints.
      const hint = client.key_hint === undefined ? '' : text(client.key_hint);
      if (hint && !/^[a-zA-Z0-9_.:-]{0,8}••••$/.test(hint)) invalid();
      return {
        id: id(client.id),
        name: client.name === undefined ? '' : text(client.name),
        keyHint: hint,
        namespace: client.namespace as ClientUsage['clients'][number]['namespace'],
      };
    }),
    clientUsage: list(raw.client_usage ?? [], 10001).map((value) => ({
      ...metrics(value),
      clientId: id(record(value).client),
      models: list(record(value).models, 10001).map(text),
    })),
    selectedClient: raw.selected_client === null ? null : id(raw.selected_client),
    totals,
    timeline: list(raw.timeline, 2161).map((value) => ({
      ...metrics(value),
      time: date(record(value).time),
    })),
    models: list(raw.models, 10001).map((value) => ({
      ...metrics(value),
      model: text(record(value).model),
    })),
    pricingAvailable: pricing.available,
    pricing,
  };
};

/** Exact official plugin extension path, not a v0 core Management API fallback. */
export const usageMeterUrl = (apiBase: string): string =>
  `${normalizeApiBase(apiBase)}/v0/management/client-usage-meter`;

export const fetchClientUsage = async (
  apiBase: string,
  range: UsageRange,
  client: string,
  signal: AbortSignal
): Promise<ClientUsage> => {
  const connection = apiClient.captureConnection();
  const raw = await connection.get<unknown>(usageMeterUrl(apiBase), {
    params: { range, ...(client ? { client } : {}) },
    signal,
  });
  return normalizeClientUsage(raw);
};

export const saveClientName = async (
  apiBase: string,
  client: string,
  name: string
): Promise<void> => {
  const connection = apiClient.captureConnection();
  await connection.put(`${usageMeterUrl(apiBase)}/client-label`, { client, name });
};
