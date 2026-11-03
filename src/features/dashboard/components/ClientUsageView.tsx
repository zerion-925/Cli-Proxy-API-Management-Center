import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type { ClientUsage, UsageMetrics, UsageRange } from '@/services/api/clientUsage';
import { formatEstimatedUsd } from '../pricing';
import { clientDisplayName } from '../clientNames';
import { UsageBreakdown } from './UsageBreakdown';
import { chronologicalBuckets, type UsageMetric } from '../usageBreakdown';
import styles from './ClientUsageMeter.module.scss';

export type UsageStatus = 'loading' | 'ready' | 'error' | 'unsupported' | 'disconnected';
interface Props {
  data: ClientUsage | null;
  status: UsageStatus;
  range: UsageRange;
  client: string;
  onRangeChange: (range: UsageRange) => void;
  onClientChange: (client: string) => void;
  onRefresh: () => void;
}
const number = (value: number) => value.toLocaleString();

export function ClientUsageView({
  data,
  status,
  range,
  client,
  onRangeChange,
  onClientChange,
  onRefresh,
}: Props) {
  const { t, i18n } = useTranslation();
  const [breakdown, setBreakdown] = useState<'model' | 'time'>('model');
  const [metric, setMetric] = useState<UsageMetric>('cost');
  const when = (value: string) =>
    new Date(value).toLocaleString(i18n.language, {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  const percent = (value: number | null) =>
    value === null
      ? t('usage_meter.unavailable')
      : `${(value * 100).toLocaleString(i18n.language, { maximumFractionDigits: 1 })}%`;
  const totals = data?.totals;
  const bucketMs = data?.window.bucket === 'hour' ? 3_600_000 : 86_400_000;
  const coveredFrom = data
    ? Math.max(
        Date.parse(data.collection.startedAt),
        Date.parse(data.window.to) - data.collection.retentionDays * 86_400_000
      )
    : 0;
  // Do not draw synthetic zero history before installation or beyond retention.
  const timeline = chronologicalBuckets(
    data?.timeline.filter((row) => Date.parse(row.time) + bucketMs > coveredFrom) ?? []
  );
  const observedTokens = (value: number, metrics: UsageMetrics) =>
    value === 0 && metrics.totalTokens === 0 && metrics.attempts > 0
      ? t('usage_meter.unavailable')
      : number(value);
  const series = [
    { key: 'totalTokens', label: 'total_tokens', color: 'var(--text-primary)' },
    { key: 'cacheReadTokens', label: 'cache_read', color: 'var(--viz-success)' },
    { key: 'outputTokens', label: 'output', color: 'var(--amber-color)' },
  ] as const;
  const max =
    metric === 'cost'
      ? Math.max(0, ...timeline.map((row) => row.estimatedCostUsd ?? 0))
      : Math.max(1, ...timeline.flatMap((row) => series.map(({ key }) => row[key])));
  const from = data ? Date.parse(data.window.from) : 0;
  const duration = data ? Math.max(1, Date.parse(data.window.to) - from) : 1;
  const plot = (key: (typeof series)[number]['key']) =>
    timeline
      .map(
        (row) =>
          `${32 + Math.max(0, Math.min(1, (Date.parse(row.time) - from) / duration)) * 716},${176 - (row[key] / max) * 152}`
      )
      .join(' ') ?? '';
  // A missing cost interrupts the line instead of becoming a fabricated zero.
  const costSegments: string[][] = [[]];
  timeline.forEach((row) => {
    if (row.estimatedCostUsd === null) {
      costSegments.push([]);
    } else {
      costSegments[costSegments.length - 1].push(
        `${32 + Math.max(0, Math.min(1, (Date.parse(row.time) - from) / duration)) * 716},${176 - (row.estimatedCostUsd / (max || 1)) * 152}`
      );
    }
  });
  const clients = [
    { value: '', label: t('usage_meter.all_clients') },
    ...(data?.clients.map((entry) => ({
      value: entry.id,
      label:
        entry.namespace === 'unattributed'
          ? t('usage_meter.unattributed')
          : clientDisplayName(entry, t('usage_meter.api_key'), data?.clients),
    })) ?? []),
  ];

  return (
    <section
      className={styles.section}
      aria-labelledby="client-usage-title"
      aria-busy={status === 'loading'}
    >
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{t('usage_meter.eyebrow')}</span>
          <h1 id="client-usage-title">{t('usage_meter.title')}</h1>
        </div>
        <a className="btn btn-ghost btn-sm" href="#/usage/keys">
          {t('usage_meter.manage_key_names')}
        </a>
      </header>
      <div className={styles.controls}>
        <div className={styles.ranges} role="group" aria-label={t('usage_meter.metric_a11y')}>
          {(['cost', 'tokens'] as const).map((value) => (
            <Button
              key={value}
              variant={metric === value ? 'secondary' : 'ghost'}
              size="sm"
              aria-pressed={metric === value}
              onClick={() => setMetric(value)}
            >
              {t(`usage_meter.${value}`)}
            </Button>
          ))}
        </div>
        <div className={styles.clientSelect}>
          <Select
            value={client}
            options={clients}
            onChange={onClientChange}
            ariaLabel={t('usage_meter.client_a11y')}
            disabled={status === 'disconnected'}
          />
        </div>
        <div className={styles.ranges} role="group" aria-label={t('usage_meter.range_a11y')}>
          {(['24h', '7d', '30d', '90d'] as const).map((value) => (
            <Button
              key={value}
              variant={range === value ? 'secondary' : 'ghost'}
              size="sm"
              aria-pressed={range === value}
              onClick={() => onRangeChange(value)}
            >
              {t(`usage_meter.range_${value}`)}
            </Button>
          ))}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onRefresh}
          loading={status === 'loading'}
          disabled={status === 'disconnected'}
        >
          {t('usage_meter.refresh')}
        </Button>
      </div>
      {status !== 'ready' && (
        <p className={styles.state} role={status === 'error' ? 'alert' : 'status'}>
          {t(`usage_meter.${status}`)}
        </p>
      )}
      {data && status === 'ready' && totals && (
        <>
          {(data.collection.state === 'disabled' ||
            data.collection.ingestionFailures > 0 ||
            data.collection.droppedEvents > 0) && (
            <p className={styles.coverage} role="status">
              {t(
                data.collection.state === 'disabled'
                  ? 'usage_meter.state_disabled'
                  : 'usage_meter.collection_issue'
              )}
            </p>
          )}
          {data.pricing.unpricedAttempts > 0 && (
            <p className={styles.coverage} role="status">
              {t('usage_meter.cost_coverage', {
                priced: data.pricing.pricedAttempts,
                total: totals.attempts,
              })}
              {Object.entries(totals.unpricedReasons ?? {}).map(([reason, count]) => (
                <span key={reason}>
                  {t(`usage_meter.reason_${reason}`, {
                    count,
                    defaultValue: t('usage_meter.reason_other', { count }),
                  })}
                </span>
              ))}
            </p>
          )}
          <div className={styles.overview}>
            <dl className={styles.summary}>
              <div>
                <dt>
                  {t(
                    metric === 'cost' ? 'usage_meter.pricing_subtotal' : 'usage_meter.total_tokens'
                  )}
                </dt>
                <dd>
                  {metric === 'cost'
                    ? formatEstimatedUsd(
                        totals.estimatedCostUsd,
                        i18n.language,
                        t('usage_meter.unavailable')
                      )
                    : observedTokens(totals.totalTokens, totals)}
                </dd>
              </div>
              <div>
                <dt>{t('usage_meter.attempts')}</dt>
                <dd>{number(totals.attempts)}</dd>
                <small>
                  {t('usage_meter.outcomes', {
                    success: number(totals.succeeded),
                    failed: number(totals.failed),
                  })}
                </small>
              </div>
              <div>
                <dt>{t('usage_meter.cache_rate')}</dt>
                <dd>{percent(totals.accountedCacheRate ?? totals.cacheRate)}</dd>
                {totals.accountedAttempts > 0 && totals.accountedAttempts < totals.attempts && (
                  <small>
                    {t('usage_meter.token_coverage', {
                      known: totals.accountedAttempts,
                      total: totals.attempts,
                    })}
                  </small>
                )}
              </div>
            </dl>

            {totals.attempts === 0 ? (
              <p className={styles.state}>{t('usage_meter.empty')}</p>
            ) : (
              <>
                {totals.totalTokens > 0 && (
                  <figure className={styles.figure}>
                    <figcaption>
                      {t(metric === 'cost' ? 'usage_meter.cost_timeline' : 'usage_meter.timeline')}{' '}
                      <span className={styles.note}>{t('usage_meter.utc')}</span>
                    </figcaption>
                    <div className={styles.legend}>
                      {(metric === 'cost'
                        ? [{ key: 'cost', label: 'cost', color: 'var(--text-primary)' }]
                        : series
                      ).map((item) => (
                        <span key={item.key}>
                          <i style={{ background: item.color }} aria-hidden="true" />
                          {t(`usage_meter.${item.label}`)}
                        </span>
                      ))}
                    </div>
                    <svg
                      viewBox="0 0 780 210"
                      role="img"
                      aria-label={t(
                        metric === 'cost'
                          ? 'usage_meter.cost_timeline_a11y'
                          : 'usage_meter.timeline_a11y'
                      )}
                    >
                      {[24, 100, 176].map((y) => (
                        <line key={y} x1="32" y1={y} x2="748" y2={y} stroke="var(--border-color)" />
                      ))}
                      <text x="32" y="16">
                        {metric === 'cost'
                          ? formatEstimatedUsd(
                              timeline.some((row) => row.estimatedCostUsd !== null) ? max : null,
                              i18n.language,
                              t('usage_meter.unavailable')
                            )
                          : number(max)}
                      </text>
                      <text x="32" y="198">
                        {when(data.window.from)}
                      </text>
                      <text x="748" y="198" textAnchor="end">
                        {when(data.window.to)}
                      </text>
                      {metric === 'cost'
                        ? costSegments.map((segment, index) => (
                            <polyline
                              key={index}
                              points={segment.join(' ')}
                              fill="none"
                              stroke="var(--text-primary)"
                              strokeWidth="2"
                            />
                          ))
                        : series.map((item) => (
                            <polyline
                              key={item.key}
                              points={plot(item.key)}
                              fill="none"
                              stroke={item.color}
                              strokeWidth="2"
                            />
                          ))}
                      {metric === 'cost' &&
                        costSegments
                          .filter((segment) => segment.length === 1)
                          .map((segment, index) => {
                            const [cx, cy] = segment[0].split(',');
                            return (
                              <circle
                                key={index}
                                cx={cx}
                                cy={cy}
                                r="3"
                                fill="var(--text-primary)"
                              />
                            );
                          })}
                      {metric === 'tokens' &&
                        timeline.length === 1 &&
                        series.map((item) => (
                          <circle
                            key={item.key}
                            cx={
                              32 +
                              Math.max(
                                0,
                                Math.min(1, (Date.parse(timeline[0].time) - from) / duration)
                              ) *
                                716
                            }
                            cy={176 - (timeline[0][item.key] / max) * 152}
                            r="3"
                            fill={item.color}
                          />
                        ))}
                    </svg>
                  </figure>
                )}
              </>
            )}
          </div>
          {totals.attempts > 0 && (
            <>
              <dl className={styles.tokens}>
                {(
                  [
                    ['total_tokens', totals.totalTokens],
                    ['cache_read', totals.cacheReadTokens],
                  ] as const
                ).map(([key, value]) => (
                  <div key={key}>
                    <dt>{t(`usage_meter.${key}`)}</dt>
                    <dd>{observedTokens(value, totals)}</dd>
                  </div>
                ))}
                <div>
                  <dt>{t('usage_meter.uncached_input')}</dt>
                  <dd>
                    {totals.uncachedInputTokens === null
                      ? t('usage_meter.unavailable')
                      : number(totals.uncachedInputTokens)}
                  </dd>
                  {totals.accountedAttempts > 0 && totals.accountedAttempts < totals.attempts && (
                    <small className={styles.note}>
                      {t('usage_meter.token_coverage', {
                        known: totals.accountedAttempts,
                        total: totals.attempts,
                      })}
                    </small>
                  )}
                </div>
                <div>
                  <dt>{t('usage_meter.output')}</dt>
                  <dd>{observedTokens(totals.outputTokens, totals)}</dd>
                </div>
                <div>
                  <dt>{t('usage_meter.pricing_savings')}</dt>
                  <dd>
                    {formatEstimatedUsd(
                      data.pricing.estimatedCacheSavingsUsd,
                      i18n.language,
                      t('usage_meter.unavailable')
                    )}
                  </dd>
                </div>
              </dl>
              <dl className={styles.tokenDetails}>
                {(
                  [
                    ['input', totals.inputTokens],
                    ['cache_write', totals.cacheWriteTokens],
                    ['unclassified_cache', totals.unclassifiedCachedTokens],
                  ] as const
                ).map(([key, value]) => (
                  <div key={key}>
                    <dt>{t(`usage_meter.${key}`)}</dt>
                    <dd>
                      {key === 'unclassified_cache' ? number(value) : observedTokens(value, totals)}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className={styles.tableHeader}>
                <h3>{t('usage_meter.breakdown')}</h3>
                <Select
                  value={breakdown}
                  options={[
                    { value: 'model', label: t('usage_meter.model') },
                    { value: 'time', label: t(`usage_meter.bucket_${data.window.bucket}`) },
                  ]}
                  onChange={(value) => {
                    if (value === 'model' || value === 'time') setBreakdown(value);
                  }}
                  ariaLabel={t('usage_meter.breakdown_a11y')}
                  fullWidth={false}
                  size="sm"
                />
              </div>
              <UsageBreakdown
                models={data.models}
                timeline={timeline}
                mode={breakdown}
                bucket={data.window.bucket}
                metric={metric}
              />
            </>
          )}
        </>
      )}
    </section>
  );
}
