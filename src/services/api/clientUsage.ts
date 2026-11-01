import { apiClient } from './client';
import { normalizeApiBase } from '@/utils/connection';
import { isRecord } from '@/utils/helpers';

export type UsageRange = '24h' | '7d' | '30d' | '90d';
export type UsageBucket = 'hour' | 'day';
export interface UsageMetrics {
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
  clients: { id: string; namespace: 'native' | 'plugin' | 'unattributed' }[];
  selectedClient: string | null;
  totals: UsageMetrics;
  timeline: (UsageMetrics & { time: string })[];
  models: (UsageMetrics & { model: string })[];
  pricingAvailable: false;
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
const metrics = (value: unknown): UsageMetrics => {
  const raw = record(value);
  const rate = raw.cache_rate;
  if (rate !== null && (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0 || rate > 1))
    invalid();
  return {
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
  };
};

export const normalizeClientUsage = (value: unknown): ClientUsage => {
  const raw = record(value);
  if (raw.schema_version !== 1) invalid();
  const collection = record(raw.collection);
  const state = collection.state;
  if (state !== 'collecting' && state !== 'partial' && state !== 'disabled') invalid();
  const window = record(raw.window);
  if (window.bucket !== 'hour' && window.bucket !== 'day') invalid();
  const pricing = record(raw.pricing);
  if (pricing.available !== false) invalid();
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
      // Never display server labels, which might contain a raw key in a misconfigured service.
      return {
        id: id(client.id),
        namespace: client.namespace as ClientUsage['clients'][number]['namespace'],
      };
    }),
    selectedClient: raw.selected_client === null ? null : id(raw.selected_client),
    totals: metrics(raw.totals),
    timeline: list(raw.timeline, 2161).map((value) => ({
      ...metrics(value),
      time: date(record(value).time),
    })),
    models: list(raw.models, 10001).map((value) => ({
      ...metrics(value),
      model: text(record(value).model),
    })),
    pricingAvailable: false,
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
