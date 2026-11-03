import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores';
import { apiClient } from '@/services/api/client';
import {
  fetchClientUsage,
  saveClientName,
  type ClientUsage,
  type UsageRange,
} from '@/services/api/clientUsage';
import { ClientUsageView, type UsageStatus } from './ClientUsageView';
import { ApiKeyNames } from './ApiKeyNames';

export function ClientUsageMeter({ view = 'usage' }: { view?: 'usage' | 'names' }) {
  const apiBase = useAuthStore((state) => state.apiBase);
  const managementKey = useAuthStore((state) => state.managementKey);
  const connected = useAuthStore(
    (state) => state.isAuthenticated && state.connectionStatus === 'connected'
  );
  const supportsPlugin = useAuthStore((state) => state.supportsPlugin);
  const [range, setRange] = useState<UsageRange>('24h');
  const [selection, setSelection] = useState({ revision: -1, client: '' });
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{
    data: ClientUsage | null;
    status: UsageStatus;
    revision: number;
    range: UsageRange;
    client: string;
  } | null>(null);
  const revision = apiClient.getConnectionRevision();
  const client = selection.revision === revision ? selection.client : '';

  useEffect(() => {
    if (!connected || !supportsPlugin) return;
    const controller = new AbortController();
    const capturedRevision = apiClient.getConnectionRevision();
    let active = true;
    const current = () =>
      active &&
      !controller.signal.aborted &&
      apiClient.getConnectionRevision() === capturedRevision;
    // Subscribe as well as checking revisions: an ABA session switch must cancel old credentials.
    const unsubscribe = useAuthStore.subscribe((next, previous) => {
      if (
        next.apiBase !== previous.apiBase ||
        next.managementKey !== previous.managementKey ||
        !next.isAuthenticated
      ) {
        active = false;
        controller.abort();
        setResult(null);
      }
    });
    void fetchClientUsage(apiBase, range, client, controller.signal)
      .then((data) => {
        if (current())
          setResult({ data, status: 'ready', revision: capturedRevision, range, client });
      })
      .catch((error: unknown) => {
        if (!current()) return;
        const status =
          error && typeof error === 'object' && 'status' in error ? error.status : null;
        setResult({
          data: null,
          status: status === 404 || status === 501 ? 'unsupported' : 'error',
          revision: capturedRevision,
          range,
          client,
        });
      });
    return () => {
      active = false;
      controller.abort();
      unsubscribe();
    };
  }, [apiBase, managementKey, connected, supportsPlugin, range, client, refresh, revision]);

  const visible =
    result?.revision === revision && result.range === range && result.client === client
      ? result
      : null;
  const status: UsageStatus = !connected
    ? 'disconnected'
    : !supportsPlugin
      ? 'unsupported'
      : (visible?.status ?? 'loading');
  const data = status === 'ready' ? (visible?.data ?? null) : null;
  const onRefresh = () => {
    setResult(null);
    setRefresh((value) => value + 1);
  };
  if (view === 'names') {
    return (
      <ApiKeyNames
        key={revision}
        data={data}
        status={status}
        onRefresh={onRefresh}
        onSaveName={async (id, name) => {
          await saveClientName(apiBase, id, name);
          if (apiClient.getConnectionRevision() === revision) onRefresh();
        }}
      />
    );
  }
  return (
    <ClientUsageView
      key={revision}
      data={data}
      status={status}
      range={range}
      client={client}
      onRangeChange={setRange}
      onClientChange={(client) => setSelection({ revision, client })}
      onRefresh={onRefresh}
    />
  );
}
