/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect, devices } from '@playwright/test';

// Pixel 7 reports touch, so the viewer's virtual-keyboard detection (which only
// runs on touch devices) is active.
test.use({ ...devices['Pixel 7'] });

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/format-painter.pptx', import.meta.url)),
);

test('notes editor stays mounted when the virtual keyboard opens', async ({ page }) => {
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[data-pptx-element="true"]').first().waitFor();

	// Open the notes panel from the mobile bottom bar.
	await page.getByRole('button', { name: 'Notes' }).tap();

	const panel = page.locator('#slide-notes-content');
	const editor = panel.locator('textarea[name="slide-notes"], [contenteditable="true"]').first();
	await expect(panel).toBeVisible();
	await expect(editor).toBeVisible();

	// Focus the notes box, then simulate the on-screen keyboard by shrinking the
	// viewport height > 30% (what the viewer uses to infer keyboard visibility).
	await editor.tap();
	const vp = page.viewportSize()!;
	await page.setViewportSize({ width: vp.width, height: Math.round(vp.height * 0.4) });

	// Regression: the panel used to unmount on keyboard-open, yanking the textbox
	// the user just tapped. It must remain mounted while notes is expanded.
	await expect(panel).toBeVisible();
	await expect(editor).toBeVisible();
});
