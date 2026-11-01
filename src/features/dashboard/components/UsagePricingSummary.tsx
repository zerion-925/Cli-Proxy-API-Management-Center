import { useTranslation } from 'react-i18next';
import type { UsagePricing } from '@/services/api/clientUsage';
import { formatEstimatedUsd } from '../pricing';
import styles from './UsagePricingSummary.module.scss';

export function UsagePricingSummary({ pricing }: { pricing: UsagePricing }) {
  const { t, i18n } = useTranslation();
  const money = (value: number | null) =>
    formatEstimatedUsd(value, i18n.language, t('usage_meter.unavailable'));
  const fetchedAt = pricing.fetchedAt
    ? new Date(pricing.fetchedAt).toLocaleString(i18n.language, { timeZone: 'UTC' })
    : t('usage_meter.unavailable');
  return (
    <section className={styles.pricing} aria-label={t('usage_meter.pricing_a11y')}>
      <header>
        <h3>{t('usage_meter.pricing_title')}</h3>
        <span className={styles.status}>{t(`usage_meter.pricing_status_${pricing.status}`)}</span>
      </header>
      <dl className={styles.amounts}>
        <div>
          <dt>{t('usage_meter.pricing_subtotal')}</dt>
          <dd>{money(pricing.estimatedCostUsd)}</dd>
        </div>
        <div>
          <dt>{t('usage_meter.pricing_savings')}</dt>
          <dd>{money(pricing.estimatedCacheSavingsUsd)}</dd>
        </div>
      </dl>
      <p>
        {t('usage_meter.pricing_coverage', {
          priced: pricing.pricedAttempts,
          total: pricing.pricedAttempts + pricing.unpricedAttempts,
          unpriced: pricing.unpricedAttempts,
        })}
      </p>
      <p>{t('usage_meter.pricing_savings_coverage', { count: pricing.savingsPricedAttempts })}</p>
      <p>{t('usage_meter.pricing_not_bill')}</p>
      {pricing.source === 'models.dev' && (
        <details>
          <summary>{t('usage_meter.pricing_provenance')}</summary>
          <p>
            <a href="https://models.dev" target="_blank" rel="noopener noreferrer">
              models.dev
            </a>
            {' · '}
            {t('usage_meter.pricing_units')}
          </p>
          <p>{t('usage_meter.pricing_fetched', { date: fetchedAt })}</p>
          <p>
            {t('usage_meter.pricing_snapshot', {
              version: pricing.snapshotVersion?.slice(0, 12) ?? t('usage_meter.unavailable'),
            })}
          </p>
          <p>
            {t('usage_meter.pricing_applied_versions', { count: pricing.snapshotVersions.length })}
          </p>
          {pricing.snapshotVersions.length > 0 && (
            <ul>
              {pricing.snapshotVersions.map((version) => (
                <li key={version}>
                  <code>{version}</code>
                </li>
              ))}
            </ul>
          )}
          <p>{t('usage_meter.pricing_history')}</p>
        </details>
      )}
    </section>
  );
}
