import { test, expect } from '@playwright/test';

const STARTER_MANIFEST = JSON.stringify({
  schemaVersion: 1,
  job: { name: 'e2e_smoke' },
  requests: [{
    name: 'core',
    assets: [{
      kind: 'image',
      name: 'smoke',
      width: 64,
      height: 64,
      format: 'png',
      output_path: 'art/',
    }],
  }],
});

test.describe('Placeholderer web app', () => {
  // Generous timeouts because the dev server cold-starts in CI.
  test.setTimeout(60_000);

  test('imports a manifest, generates a ZIP, shows the manifest report', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');

    await page.goto('/');
    await page.getByRole('heading', { name: 'Import Manifest' }).waitFor();

    // Paste a manifest into the textarea. The handler fires when the
    // text length exceeds 20 chars.
    const textarea = page.locator('textarea[placeholder^="Paste your JSON"]');
    await textarea.fill(STARTER_MANIFEST);

    // The Overview view should now be visible.
    await page.getByRole('heading', { name: /Job Overview/ }).waitFor();
    await expect(page.getByText('e2e_smoke')).toBeVisible();

    // Click Generate & Download.
    await page.getByRole('button', { name: /Generate & Download ZIP/ }).click();

    // A download should fire.
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('e2e_smoke.zip');

    // The manifest report panel should appear in the UI. Wait
    // explicitly for the panel heading so we don't race the manual
    // ZIP decoder, then assert the job name from the report is
    // visible (the job name only appears in the report panel, not
    // elsewhere on the page, so this is a unique assertion).
    const heading = page.locator('strong', { hasText: 'Manifest report' });
    await heading.waitFor();
    await expect(page.getByText('e2e_smoke').nth(1)).toBeVisible();
  });

  test('theme toggle switches the data-theme attribute', async ({ page }) => {
    await page.goto('/');

    // The button's accessible name comes from its aria-label; the
    // title attribute is for tooltips and not used by role-based
    // queries. Click by aria-label, which is stable across themes.
    const toggle = page.getByRole('button', { name: 'Toggle theme' });
    await toggle.waitFor();

    const initial = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    await toggle.click();
    // Allow the React effect to run before reading.
    await page.waitForFunction((prev) =>
      document.documentElement.getAttribute('data-theme') !== prev, initial);
    const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(after).not.toBe(initial);
  });
});
