// Isolated full-shell checks. No production sessions, keys, provider calls, or external network.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright-core');
const output = resolve(process.env.USAGE_EVIDENCE_DIR || 'tests/browser/screenshots/usage-shell');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/snap/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const checks = [];
try {
  const response = await fetch('http://127.0.0.1:18419/__fixture/mode?value=breakdown', {
    method: 'POST',
    headers: { Authorization: 'Bearer fixture-management-only' },
  });
  assert.equal(response.status, 200);
  for (const [name, width, height] of [
    ['desktop', 1440, 1000],
    ['mobile', 390, 844],
  ]) {
    const context = await browser.newContext({ viewport: { width, height } });
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      return url.hostname === '127.0.0.1' && ['18418', '18419'].includes(url.port)
        ? route.continue()
        : route.abort();
    });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:18418/tests/browser/usage-meter.html?shell#/usage');
    const meter = page.locator('[aria-labelledby="client-usage-title"]');
    await meter.locator('table').waitFor();
    const refresh = meter.getByRole('button', { name: 'Refresh usage', exact: true });
    const header = await page.locator('.main-header').boundingBox();
    const button = await refresh.boundingBox();
    assert(header && button);
    const intersects =
      button.x < header.x + header.width &&
      button.x + button.width > header.x &&
      button.y < header.y + header.height &&
      button.y + button.height > header.y;
    assert.equal(intersects, false, 'Refresh must not overlap the global topbar');
    const text = await meter.innerText();
    for (const forbidden of [
      'Partial collection',
      'Accounting method',
      'Price source',
      'models.dev',
      'priced; ',
      'ABI',
      'snapshot',
      'reconstructed',
      'best-effort',
      'No backfill',
      '(6/9)',
      '(12/18)',
      'Cost estimates',
    ]) {
      assert(!text.toLowerCase().includes(forbidden.toLowerCase()), forbidden);
    }
    assert(!/\(\d+\/\d+\)/.test(text));
    assert.equal(await meter.locator('details, summary').count(), 0);
    assert.equal(await page.locator('.sidebar a[href="#/usage"]').count(), 1);
    const heading = () => meter.locator('dl').first().locator('dd').first().innerText();
    const tableHeaders = () => meter.locator('thead th').allTextContents();
    const names = () => meter.locator('tbody th[scope="row"]').allTextContents();
    const chooseBreakdown = async (label) => {
      await meter.getByRole('button', { name: 'Group usage by model or time interval' }).click();
      await page.getByRole('option', { name: label, exact: true }).click();
    };
    const screenshot = async (suffix) => {
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false
      );
      await meter.getByRole('heading', { name: 'Usage breakdown' }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: resolve(output, `${name}-${suffix}.png`), fullPage: true });
      await meter.locator('tbody tr').last().scrollIntoViewIfNeeded();
      await page.screenshot({ path: resolve(output, `${name}-${suffix}-table-viewport.png`) });
    };
    assert.deepEqual(await tableHeaders(), ['#', 'Model', 'Cost', 'Share', 'Tokens']);
    assert.deepEqual(await names(), [
      'synthetic-premium',
      'synthetic-economy',
      'synthetic-unpriced',
    ]);
    assert((await heading()).includes('7.50'));
    const costRows = await meter.locator('tbody tr').allTextContents();
    assert(costRows[0].includes('80%'));
    assert(costRows[1].includes('20%'));
    assert(costRows[2].includes('Unavailable'));
    const widths = await meter
      .locator('tbody th[scope="row"] [aria-hidden="true"] span')
      .evaluateAll((els) => els.map((el) => el.style.width));
    assert.deepEqual(widths, ['100%', '25%']);
    await screenshot('cost-model');
    await meter.getByRole('button', { name: 'Tokens', exact: true }).click();
    assert.equal(await heading(), '3,000');
    assert.deepEqual(await names(), [
      'synthetic-unpriced',
      'synthetic-economy',
      'synthetic-premium',
    ]);
    assert((await meter.locator('tbody tr').first().innerText()).includes('60%'));
    assert.equal(
      await meter
        .getByRole('img', { name: 'Timeline of processed tokens, cached input, and output.' })
        .count(),
      1
    );
    await screenshot('tokens-model');
    await chooseBreakdown('Hour');
    assert.deepEqual(await tableHeaders(), ['Hour', 'Total (estimated cost)', 'Tokens']);
    const hourLabels = await names();
    const hours = hourLabels.map((label) => Date.parse(label + ' UTC'));
    assert(hours.every((time, index) => index === 0 || time > hours[index - 1]));
    await screenshot('tokens-hour');
    await meter.getByRole('button', { name: 'Cost', exact: true }).click();
    assert.deepEqual(await tableHeaders(), ['Hour', 'Total (estimated cost)', 'Tokens']);
    await screenshot('cost-hour');
    await meter.getByRole('button', { name: '7 days', exact: true }).click();
    await meter.getByRole('columnheader', { name: 'Day', exact: true }).waitFor();
    assert.deepEqual(await tableHeaders(), ['Day', 'Total (estimated cost)', 'Tokens']);
    await screenshot('cost-day');
    await meter.getByRole('button', { name: 'Tokens', exact: true }).click();
    await screenshot('tokens-day');
    await chooseBreakdown('Model');
    await meter.getByRole('button', { name: 'Filter usage by client' }).click();
    await page.getByRole('option').nth(1).click();
    await page.waitForFunction(
      () =>
        document.querySelector('[aria-labelledby="client-usage-title"] dl dd')?.textContent ===
        '1,000'
    );
    assert.equal(await heading(), '1,000');
    await refresh.click();
    await meter.locator('table').waitFor();
    assert.equal(await heading(), '1,000');
    await screenshot('client-tokens-model');
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await screenshot('dark-tokens-model');
    checks.push({
      name,
      width,
      height,
      hash: new URL(page.url()).hash,
      header,
      refresh: button,
      intersects,
      disclosures: 0,
      coverageRatio: false,
      horizontalOverflow: false,
      modelHeaders: ['#', 'Model', 'Cost', 'Share', 'Tokens'],
      hourLabels,
      perClientTokens: 1000,
      metrics: ['cost', 'tokens'],
      modes: ['model', 'hour', 'day'],
    });
    await context.close();
  }
  await writeFile(resolve(output, 'checks.json'), JSON.stringify(checks, null, 2) + '\n');
  console.log(JSON.stringify({ output, checks }, null, 2));
} finally {
  await browser.close();
}
