// Run against the isolated fixture servers on 18418/18419, never a live backend.
// NODE_PATH must contain playwright-core; CHROMIUM_PATH may override Chromium.
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
  const modeResponse = await fetch('http://127.0.0.1:18419/__fixture/mode?value=pricing', {
    method: 'POST',
    headers: { Authorization: 'Bearer fixture-management-only' },
  });
  assert.equal(modeResponse.status, 200);
  for (const [name, width, height] of [
    ['desktop', 1440, 1000],
    ['mobile', 390, 844],
  ]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    // Block all non-fixture network traffic; no production keys or endpoints.
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      return url.hostname === '127.0.0.1' && ['18418', '18419'].includes(url.port)
        ? route.continue()
        : route.abort();
    });
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
    assert.equal(await meter.locator('details, summary').count(), 0);
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
    ]) {
      assert(!text.toLowerCase().includes(forbidden.toLowerCase()), forbidden);
    }
    assert(text.includes('(2/3)'));
    await meter.getByRole('img', { name: '2 of 3 attempts included in estimated cost' }).waitFor();
    assert.equal(await page.locator('.sidebar a[href="#/usage"]').count(), 1);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false
    );
    await refresh.click();
    await meter.locator('table').waitFor();
    await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true });
    if (name === 'desktop') {
      await meter.getByRole('heading', { name: 'Cost estimates' }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: resolve(output, 'desktop-cost.png') });
    }
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await page.screenshot({ path: resolve(output, `${name}-dark.png`), fullPage: true });
    checks.push({
      name,
      width,
      height,
      hash: new URL(page.url()).hash,
      header,
      refresh: button,
      intersects,
      disclosures: 0,
      partialCost: '(2/3)',
      horizontalOverflow: false,
    });
    await context.close();
  }
  await writeFile(resolve(output, 'checks.json'), JSON.stringify(checks, null, 2) + '\n');
  console.log(JSON.stringify({ output, checks }, null, 2));
} finally {
  await browser.close();
}
