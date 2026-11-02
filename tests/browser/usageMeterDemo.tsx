// Test-only harness. Uses the real meter, apiClient, theme and locale code.
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { HashRouter } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import '@/styles/global.scss';
import i18n from '@/i18n';
import { apiClient } from '@/services/api/client';
import { useAuthStore } from '@/stores';
import { ClientUsageMeter } from '@/features/dashboard/components/ClientUsageMeter';

void i18n.changeLanguage('en');
const apiBase = 'http://127.0.0.1:18419';
const key = 'fixture-management-only';
apiClient.setConfig({ apiBase, managementKey: key });
useAuthStore.setState({
  apiBase,
  managementKey: key,
  isAuthenticated: true,
  supportsPlugin: true,
  connectionStatus: 'connected',
  rememberPassword: false,
});
export function Demo() {
  const [version, setVersion] = useState(0);
  const mode = async (value: string) => {
    await fetch(`${apiBase}/__fixture/mode?value=${value}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
    });
    setVersion((value) => value + 1);
  };
  return (
    <main style={{ maxWidth: 1120, margin: '0 auto', padding: '24px clamp(16px, 4vw, 48px)' }}>
      <aside
        style={{
          border: '1px solid var(--border-color)',
          padding: 16,
          marginBottom: 28,
          fontSize: 12,
        }}
      >
        <strong>SYNTHETIC TEST FIXTURE ONLY</strong>
        <p>
          No live traffic, provider calls or production usage. Real component and authenticated API
          client, isolated mock data.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {[
            'ready',
            'empty',
            'unsupported',
            'error',
            'official-runtime',
            'breakdown',
            'pricing',
            'pricing-stale',
            'pricing-runtime',
          ].map((value) => (
            <button
              className="btn btn-secondary btn-sm"
              key={value}
              onClick={() => void mode(value)}
            >
              {value}
            </button>
          ))}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() =>
              document.documentElement.setAttribute(
                'data-theme',
                document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
              )
            }
          >
            Toggle theme
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              useAuthStore.getState().logout();
            }}
          >
            Logout
          </button>
        </div>
      </aside>
      <ClientUsageMeter key={version} />
    </main>
  );
}
createRoot(document.getElementById('root')!).render(
  new URLSearchParams(location.search).has('shell') ? (
    <HashRouter>
      <MainLayout />
    </HashRouter>
  ) : (
    <Demo />
  )
);
