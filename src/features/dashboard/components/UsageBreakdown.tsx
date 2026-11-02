// Adapted from T3 Code UsagePage model/time tables (MIT). See THIRD_PARTY_NOTICES.md.
import { useTranslation } from 'react-i18next';
import type { ClientUsage, UsageBucket } from '@/services/api/clientUsage';
import { formatEstimatedUsd } from '../pricing';
import { chronologicalBuckets, modelBreakdown, type UsageMetric } from '../usageBreakdown';
import styles from './ClientUsageMeter.module.scss';

interface Props {
  models: ClientUsage['models'];
  timeline: ClientUsage['timeline'];
  mode: 'model' | 'time';
  bucket: UsageBucket;
  metric: UsageMetric;
}
export function UsageBreakdown({ models, timeline, mode, bucket, metric }: Props) {
  const { t, i18n } = useTranslation();
  const unavailable = t('usage_meter.unavailable');
  const money = (value: number | null) => formatEstimatedUsd(value, i18n.language, unavailable);
  const tokens = (row: ClientUsage['models'][number] | ClientUsage['timeline'][number]) =>
    row.totalTokens === 0 && row.attempts > 0
      ? unavailable
      : row.totalTokens.toLocaleString(i18n.language);
  const share = (value: number | null) =>
    value === null
      ? unavailable
      : new Intl.NumberFormat(i18n.language, { style: 'percent', maximumFractionDigits: 1 }).format(
          value
        );
  const headers =
    mode === 'model'
      ? ['rank', 'model', 'cost', 'share', 'tokens']
      : [`bucket_${bucket}`, 'total_cost', 'tokens'];
  return (
    <div
      className={styles.tableWrap}
      tabIndex={0}
      role="region"
      aria-label={t('usage_meter.table_a11y')}
    >
      <table className={mode === 'model' ? styles.modelTable : undefined}>
        <caption className={styles.srOnly}>{t('usage_meter.table_a11y')}</caption>
        <thead>
          <tr>
            {headers.map((key) => (
              <th scope="col" key={key}>
                {t(`usage_meter.${key}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mode === 'model'
            ? modelBreakdown(models, metric).map((row, index) => (
                <tr key={row.model}>
                  <td className={styles.rank}>{index + 1}</td>
                  <th scope="row" className={styles.modelName}>
                    {row.model}
                    {row.bar !== null && row.bar > 0 && (
                      <div className={styles.modelBar} aria-hidden="true">
                        <span style={{ width: `${row.bar * 100}%` }} />
                      </div>
                    )}
                  </th>
                  <td>{money(row.estimatedCostUsd)}</td>
                  <td>{share(row.share)}</td>
                  <td>{tokens(row)}</td>
                </tr>
              ))
            : chronologicalBuckets(timeline).map((row) => (
                <tr key={row.time}>
                  <th scope="row">
                    {new Date(row.time).toLocaleString(i18n.language, {
                      timeZone: 'UTC',
                      month: 'short',
                      day: 'numeric',
                      ...(bucket === 'hour'
                        ? ({ hour: '2-digit', minute: '2-digit' } as const)
                        : {}),
                    })}
                  </th>
                  <td>{money(row.estimatedCostUsd)}</td>
                  <td>{tokens(row)}</td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
