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
  test('imports a manifest, generates a ZIP, shows the manifest report', async ({ page }) => {
    // Capture downloads.
    const downloadPromise = page.waitForEvent('download');

    // Land on the home view; the JSON tab is selected by default.
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

    // The manifest report panel should appear in the UI.
    await page.getByText('Manifest report').waitFor();
    await expect(page.getByText('Total')).toBeVisible();
    await expect(page.getByText('Successful')).toBeVisible();
  });

  test('theme toggle switches the data-theme attribute', async ({ page }) => {
    await page.goto('/');
    // Default to light (no data-theme or 'light').
    const initial = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    await page.getByRole('button', { name: /Switch to dark theme/ }).click();
    const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(after).not.toBe(initial);
  });
});
