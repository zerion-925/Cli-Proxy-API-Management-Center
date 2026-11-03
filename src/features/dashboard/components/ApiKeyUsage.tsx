import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { ClientUsage } from '@/services/api/clientUsage';
import { clientDisplayName } from '../clientNames';
import { formatEstimatedUsd } from '../pricing';
import styles from './ClientUsageMeter.module.scss';

export function ApiKeyUsage({
  data,
  onClientChange,
  onSaveName,
}: {
  data: ClientUsage;
  onClientChange: (client: string) => void;
  onSaveName?: (client: string, name: string) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const entries = new Map(data.clients.map((client) => [client.id, client]));
  const money = (cost: number | null) =>
    formatEstimatedUsd(cost, i18n.language, t('usage_meter.unavailable'));
  const save = async () => {
    if (!editing || !onSaveName || saving) return;
    setSaving(true);
    setError(false);
    try {
      await onSaveName(editing, name.trim());
      setEditing(null);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className={styles.keySection} aria-labelledby="api-key-usage-title">
      <h2 id="api-key-usage-title">{t('usage_meter.key_breakdown')}</h2>
      <div
        className={styles.tableWrap}
        tabIndex={0}
        role="region"
        aria-label={t('usage_meter.key_breakdown')}
      >
        <table>
          <caption className={styles.srOnly}>{t('usage_meter.key_breakdown')}</caption>
          <thead>
            <tr>
              {['api_key', 'models_used', 'attempts', 'tokens', 'cost', 'key_actions'].map(
                (key) => (
                  <th key={key} scope="col">
                    {t(`usage_meter.${key}`)}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {data.clientUsage.map((row) => {
              const client = entries.get(row.clientId);
              if (!client) return null;
              const label =
                client.namespace === 'unattributed'
                  ? t('usage_meter.unattributed')
                  : clientDisplayName(client, t('usage_meter.api_key'), data.clients);
              return (
                <tr key={row.clientId}>
                  <th scope="row">
                    <Button variant="ghost" size="sm" onClick={() => onClientChange(row.clientId)}>
                      {label}
                    </Button>
                    {client.name && client.keyHint && (
                      <small className={styles.keyHint}>{client.keyHint}</small>
                    )}
                  </th>
                  <td className={styles.keyModels}>{row.models.join(', ') || '—'}</td>
                  <td>{row.attempts.toLocaleString(i18n.language)}</td>
                  <td>{row.totalTokens.toLocaleString(i18n.language)}</td>
                  <td>
                    {money(row.estimatedCostUsd)}
                    {row.pricedAttempts < row.attempts && (
                      <small className={styles.keyHint}>
                        {t('usage_meter.cost_coverage', {
                          priced: row.pricedAttempts,
                          total: row.attempts,
                        })}
                      </small>
                    )}
                  </td>
                  <td>
                    {onSaveName && client.namespace !== 'unattributed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={saving}
                        aria-label={t('usage_meter.rename_key_a11y', { key: label })}
                        onClick={() => {
                          setEditing(client.id);
                          setName(client.name);
                          setError(false);
                        }}
                      >
                        {t('usage_meter.rename_key')}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">
                {t(data.selectedClient ? 'usage_meter.selected_key' : 'usage_meter.all_clients')}
              </th>
              <td />
              <td>{data.totals.attempts.toLocaleString(i18n.language)}</td>
              <td>{data.totals.totalTokens.toLocaleString(i18n.language)}</td>
              <td>{money(data.totals.estimatedCostUsd)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {editing && (
        <form
          className={styles.keyEditor}
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <Input
            label={t('usage_meter.key_name')}
            value={name}
            maxLength={80}
            disabled={saving}
            onChange={(event) => setName(event.target.value)}
            hint={t('usage_meter.key_name_hint')}
            autoFocus
          />
          {error && <p role="alert">{t('usage_meter.key_name_error')}</p>}
          <div className={styles.ranges}>
            <Button type="submit" loading={saving}>
              {t('common.save')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => setEditing(null)}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
