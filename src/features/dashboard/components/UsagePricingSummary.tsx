import { useTranslation } from 'react-i18next';
import type { UsagePricing } from '@/services/api/clientUsage';
import { formatEstimatedUsd } from '../pricing';
import styles from './UsagePricingSummary.module.scss';

export function UsagePricingSummary({ pricing }: { pricing: UsagePricing }) {
  const { t, i18n } = useTranslation();
  const money = (value: number | null) =>
    formatEstimatedUsd(value, i18n.language, t('usage_meter.unavailable'));
  const total = pricing.pricedAttempts + pricing.unpricedAttempts;
  const partial = pricing.pricedAttempts > 0 && pricing.unpricedAttempts > 0;
  return (
    <section className={styles.pricing} aria-label={t('usage_meter.pricing_title')}>
      <header>
        <h3>{t('usage_meter.pricing_title')}</h3>
      </header>
      <dl className={styles.amounts}>
        <div>
          <dt>
            {t('usage_meter.pricing_subtotal')}
            {partial && (
              <span
                role="img"
                aria-label={t('usage_meter.pricing_coverage_a11y', {
                  priced: pricing.pricedAttempts,
                  total,
                })}
              >
                {' '}
                ({pricing.pricedAttempts}/{total})
              </span>
            )}
          </dt>
          <dd>{money(pricing.estimatedCostUsd)}</dd>
        </div>
        <div>
          <dt>{t('usage_meter.pricing_savings')}</dt>
          <dd>{money(pricing.estimatedCacheSavingsUsd)}</dd>
        </div>
      </dl>
    </section>
  );
}
