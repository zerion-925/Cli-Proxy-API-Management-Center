import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { ClientUsage } from '@/services/api/clientUsage';
import type { UsageStatus } from './ClientUsageView';
import { clientDisplayName } from '../clientNames';
import styles from './ClientUsageMeter.module.scss';

export function ApiKeyNames({
  data,
  status,
  onSaveName,
  onRefresh,
}: {
  data: ClientUsage | null;
  status: UsageStatus;
  onSaveName: (client: string, name: string) => Promise<void>;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
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
  const clients = data?.clients.filter((client) => client.namespace !== 'unattributed') ?? [];
  return (
    <section
      className={styles.section}
      aria-labelledby="key-names-title"
      aria-busy={status === 'loading'}
    >
      <a className="btn btn-ghost btn-sm" href="#/usage">
        {t('usage_meter.back_to_usage')}
      </a>
      <header className={styles.header}>
        <h1 id="key-names-title">{t('usage_meter.key_names_title')}</h1>
        <Button
          variant="secondary"
          size="sm"
          onClick={onRefresh}
          loading={status === 'loading'}
          disabled={saving || status === 'disconnected'}
        >
          {t('usage_meter.refresh')}
        </Button>
      </header>
      <p className={styles.note}>{t('usage_meter.key_names_description')}</p>
      {status !== 'ready' && (
        <p className={styles.state} role={status === 'error' ? 'alert' : 'status'}>
          {t(`usage_meter.${status}`)}
        </p>
      )}
      {status === 'ready' && clients.length === 0 && (
        <p className={styles.state}>{t('usage_meter.key_names_empty')}</p>
      )}
      {status === 'ready' && clients.length > 0 && (
        <ul className={styles.keyList}>
          {clients.map((client) => {
            const label = clientDisplayName(client, t('usage_meter.api_key'), data?.clients);
            return (
              <li key={client.id}>
                <div className={styles.keyRow}>
                  <div>
                    <strong>{label}</strong>
                    {client.name && client.keyHint && (
                      <small className={styles.keyHint}>{client.keyHint}</small>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    aria-label={t('usage_meter.rename_key_a11y', { key: label })}
                    aria-expanded={editing === client.id}
                    onClick={() => {
                      setEditing(client.id);
                      setName(client.name);
                      setError(false);
                    }}
                  >
                    {t('usage_meter.rename_key')}
                  </Button>
                </div>
                {editing === client.id && (
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
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
