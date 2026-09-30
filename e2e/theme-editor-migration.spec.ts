/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright test API */
import { expect, test } from '@playwright/test';

import { savePptxViaBackstage } from './save-pptx';
import { loadDeck, ribbonTab } from './support/deck';
import { downloadBytes } from './support/exports';
import { readZipPartText } from './support/pptx-xml';

test.use({ viewport: { width: 1440, height: 900 } });

test('theme editor stages, resets, discards and applies a saved edit', async ({
	page,
}, testInfo) => {
	await loadDeck(page);
	await ribbonTab(page, 'Design').click();
	const launch = page.getByRole('button', { name: 'Edit Theme', exact: true });
	await launch.click();
	const editor = page.locator('pptx-ui-theme-editor:not([inline])');
	const name = editor.getByRole('textbox', { name: 'Theme name', exact: true });
	await expect(name).toBeFocused();
	const original = await name.inputValue();
	await expect(editor.locator('input[type=color]')).toHaveCount(12);
	await expect(editor.locator('.preset')).toHaveCount(10);
	const body = await page.locator('[data-pptx-chrome="body"]').boundingBox();
	const dock = await editor.boundingBox();
	expect(Math.abs(dock!.y - body!.y)).toBeLessThan(2);
	expect(Math.abs(dock!.x + dock!.width - body!.x - body!.width)).toBeLessThan(2);
	await editor.getByRole('button', { name: 'Facet', exact: true }).click();
	await expect(name).toHaveValue('Facet');
	await editor.getByRole('button', { name: 'Reset', exact: true }).click();
	await expect(name).toHaveValue(original);
	await name.fill('Discarded draft');
	await name.press('Escape');
	await expect(editor).toHaveCount(0);
	await expect(launch).toBeFocused();
	await launch.click();
	await expect(name).toHaveValue(original);
	await name.fill('Shared Theme Regression');
	await editor.getByRole('textbox', { name: 'Accent 1 hex', exact: true }).fill('#123456');
	await page.screenshot({ path: testInfo.outputPath('theme-editor-after.png') });
	await testInfo.attach('shared theme editor', {
		path: testInfo.outputPath('theme-editor-after.png'),
		contentType: 'image/png',
	});
	await editor.getByRole('button', { name: 'Apply to Presentation', exact: true }).click();
	await expect(editor).toHaveCount(0);
	await launch.click();
	await expect(name).toHaveValue('Shared Theme Regression');
	await expect(editor.getByRole('textbox', { name: 'Accent 1 hex', exact: true })).toHaveValue(
		'#123456',
	);
	await editor.getByRole('button', { name: 'Close', exact: true }).click();
	const bytes = await downloadBytes(await savePptxViaBackstage(page));
	const xml = await readZipPartText(bytes, 'ppt/theme/theme1.xml');
	expect(xml).toContain('Shared Theme Regression');
	expect(xml).toMatch(/<a:accent1>\s*<a:srgbClr val="123456"/u);
});

test('theme editor keeps actions reachable in a narrow viewport', async ({ page }) => {
	await loadDeck(page);
	await ribbonTab(page, 'Design').click();
	await page.getByRole('button', { name: 'Edit Theme', exact: true }).click();
	await page.setViewportSize({ width: 760, height: 900 });
	const editor = page.locator('pptx-ui-theme-editor:not([inline])');
	const apply = editor.getByRole('button', { name: 'Apply to Presentation', exact: true });
	await expect(apply).toBeVisible();
	const box = await apply.boundingBox();
	expect(box!.height).toBeGreaterThanOrEqual(44);
	expect(box!.y + box!.height).toBeLessThanOrEqual(900);
	const dock = await editor.boundingBox();
	expect(dock!.x).toBeGreaterThanOrEqual(0);
	expect(dock!.x + dock!.width).toBeLessThanOrEqual(760);
	await editor.getByRole('textbox', { name: 'Theme name', exact: true }).press('Tab');
	await expect(editor.getByRole('button', { name: 'Office', exact: true })).toBeFocused();
	await page.emulateMedia({ forcedColors: 'active' });
	await expect(apply).toBeVisible();
	await editor.getByRole('button', { name: 'Close', exact: true }).click();
	await expect(editor).toHaveCount(0);
});
