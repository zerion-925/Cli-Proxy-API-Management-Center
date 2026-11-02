import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type { ClientUsage, UsageMetrics, UsageRange } from '@/services/api/clientUsage';
import { formatEstimatedUsd } from '../pricing';
import { UsagePricingSummary } from './UsagePricingSummary';
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
  const [breakdown, setBreakdown] = useState('model');
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
  const timeline =
    data?.timeline.filter((row) => Date.parse(row.time) + bucketMs > coveredFrom) ?? [];
  const observedTokens = (value: number, metrics: UsageMetrics) =>
    value === 0 && metrics.attempts > 0 ? t('usage_meter.unavailable') : number(value);
  const rows: (UsageMetrics & { label: string })[] = !data
    ? []
    : breakdown === 'model'
      ? data.models.map((row) => ({ ...row, label: row.model }))
      : timeline.map((row) => ({ ...row, label: when(row.time) }));
  const series = [
    { key: 'totalTokens', label: 'total_tokens', color: 'var(--text-primary)' },
    { key: 'cacheReadTokens', label: 'cache_read', color: 'var(--viz-success)' },
    { key: 'outputTokens', label: 'output', color: 'var(--amber-color)' },
  ] as const;
  const max = Math.max(1, ...timeline.flatMap((row) => series.map(({ key }) => row[key])));
  const from = data ? Date.parse(data.window.from) : 0;
  const duration = data ? Math.max(1, Date.parse(data.window.to) - from) : 1;
  const plot = (key: (typeof series)[number]['key']) =>
    timeline
      .map(
        (row) =>
          `${32 + Math.max(0, Math.min(1, (Date.parse(row.time) - from) / duration)) * 716},${176 - (row[key] / max) * 152}`
      )
      .join(' ') ?? '';
  const clients = [
    { value: '', label: t('usage_meter.all_clients') },
    ...(data?.clients.map((entry) => ({
      value: entry.id,
      label:
        entry.namespace === 'unattributed'
          ? t('usage_meter.unattributed')
          : `${t(`usage_meter.namespace_${entry.namespace}`)} · ${entry.id.slice(-10)}`,
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
      </header>
      <div className={styles.controls}>
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
          <dl className={styles.summary}>
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
              <dt>{t('usage_meter.total_tokens')}</dt>
              <dd>{observedTokens(totals.totalTokens, totals)}</dd>
            </div>
            <div>
              <dt>{t('usage_meter.cache_rate')}</dt>
              <dd>
                {percent(totals.cacheRate === 0 && totals.attempts > 0 ? null : totals.cacheRate)}
              </dd>
            </div>
          </dl>

          {totals.attempts === 0 ? (
            <p className={styles.state}>{t('usage_meter.empty')}</p>
          ) : (
            <>
              {totals.totalTokens > 0 && (
                <figure className={styles.figure}>
                  <figcaption>
                    {t('usage_meter.timeline')}{' '}
                    <span className={styles.note}>{t('usage_meter.utc')}</span>
                  </figcaption>
                  <div className={styles.legend}>
                    {series.map((item) => (
                      <span key={item.key}>
                        <i style={{ background: item.color }} aria-hidden="true" />
                        {t(`usage_meter.${item.label}`)}
                      </span>
                    ))}
                  </div>
                  <svg viewBox="0 0 780 210" role="img" aria-label={t('usage_meter.timeline_a11y')}>
                    {[24, 100, 176].map((y) => (
                      <line key={y} x1="32" y1={y} x2="748" y2={y} stroke="var(--border-color)" />
                    ))}
                    <text x="32" y="16">
                      {number(max)}
                    </text>
                    <text x="32" y="198">
                      {when(data.window.from)}
                    </text>
                    <text x="748" y="198" textAnchor="end">
                      {when(data.window.to)}
                    </text>
                    {series.map((item) => (
                      <polyline
                        key={item.key}
                        points={plot(item.key)}
                        fill="none"
                        stroke={item.color}
                        strokeWidth="2"
                      />
                    ))}
                    {timeline.length === 1 &&
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
              <dl className={styles.tokens}>
                {(
                  [
                    ['input', totals.inputTokens],
                    ['cache_read', totals.cacheReadTokens],
                    ['cache_write', totals.cacheWriteTokens],
                    ['output', totals.outputTokens],
                    ['unclassified_cache', totals.unclassifiedCachedTokens],
                  ] as const
                ).map(([key, value]) => (
                  <div key={key}>
                    <dt>{t(`usage_meter.${key}`)}</dt>
                    <dd>{observedTokens(value, totals)}</dd>
                  </div>
                ))}
                <div>
                  <dt>{t('usage_meter.uncached_input')}</dt>
                  <dd>{t('usage_meter.unavailable')}</dd>
                </div>
              </dl>
              <div className={styles.tableHeader}>
                <h3>{t('usage_meter.breakdown')}</h3>
                <Select
                  value={breakdown}
                  options={[
                    { value: 'model', label: t('usage_meter.model') },
                    { value: 'time', label: t(`usage_meter.bucket_${data.window.bucket}`) },
                  ]}
                  onChange={setBreakdown}
                  ariaLabel={t('usage_meter.breakdown_a11y')}
                  fullWidth={false}
                  size="sm"
                />
              </div>
              <div
                className={styles.tableWrap}
                tabIndex={0}
                role="region"
                aria-label={t('usage_meter.table_a11y')}
              >
                <table>
                  <caption className={styles.srOnly}>{t('usage_meter.table_a11y')}</caption>
                  <thead>
                    <tr>
                      {[
                        'model_time',
                        'attempts',
                        'success',
                        'failed',
                        'total_tokens',
                        'cache_read',
                        'cache_write',
                        'output',
                      ].map((key) => (
                        <th scope="col" key={key}>
                          {t(`usage_meter.${key}`)}
                        </th>
                      ))}
                      {data.pricing.available && (
                        <>
                          <th scope="col">{t('usage_meter.pricing_priced_attempts')}</th>
                          <th scope="col">{t('usage_meter.pricing_subtotal')}</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.label}>
                        <th scope="row">{row.label}</th>
                        {[
                          row.attempts,
                          row.succeeded,
                          row.failed,
                          row.totalTokens,
                          row.cacheReadTokens,
                          row.cacheWriteTokens,
                          row.outputTokens,
                        ].map((value, index) => (
                          <td key={index}>
                            {index < 3 ? number(value) : observedTokens(value, row)}
                          </td>
                        ))}
                        {data.pricing.available && (
                          <>
                            <td>
                              {number(row.pricedAttempts)} / {number(row.attempts)}
                            </td>
                            <td>
                              {formatEstimatedUsd(
                                row.estimatedCostUsd,
                                i18n.language,
                                t('usage_meter.unavailable')
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <UsagePricingSummary pricing={data.pricing} />
        </>
      )}
    </section>
  );
}
