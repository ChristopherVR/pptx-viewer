import { writeFile } from 'node:fs/promises';

/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright API */
import { expect, test } from '@playwright/test';
import JSZip from 'jszip';

import { savePptxViaBackstage } from './save-pptx';
import { elementsOfType, loadDeck, ribbonTab, viewport } from './support/deck';
import { downloadBytes } from './support/exports';

test.use({ viewport: { width: 1440, height: 900 } });
test('shared Draw choices retain native ink, undo and saved strokes', async ({ page }, info) => {
	await loadDeck(page);
	await ribbonTab(page, 'Draw').click();
	const draw = page.locator('pptx-ui-ribbon-draw');
	await draw.getByRole('button', { name: 'Pen', exact: true }).focus();
	await page.keyboard.press('Space');
	await expect(draw.getByRole('button', { name: 'Pen', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true',
	);
	await draw.locator('summary').click();
	await draw.getByRole('button', { name: 'Red', exact: true }).click();
	await expect(draw.locator('details')).not.toHaveAttribute('open');
	await draw.locator('select').selectOption('16');
	await expect(draw.locator('input[type=range]')).toHaveValue('16');
	await page.screenshot({ path: info.outputPath('draw.png') });
	const canvas = await viewport(page).boundingBox();
	const x = canvas!.x + canvas!.width / 2,
		y = canvas!.y + canvas!.height / 2;
	await page.mouse.move(x - 60, y);
	await page.mouse.down();
	await page.mouse.move(x + 60, y + 20, { steps: 8 });
	await page.mouse.up();
	await expect(elementsOfType(page, 'ink drawing')).toHaveCount(1);
	await draw.getByRole('button', { name: 'Select', exact: true }).click();
	await expect(draw.getByRole('button', { name: 'Select', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true',
	);
	await expect(page.getByRole('button', { name: 'Undo', exact: true }).first()).toBeEnabled();
	await page.keyboard.press('Control+z');
	await expect(elementsOfType(page, 'ink drawing')).toHaveCount(0);
	await page.keyboard.press('Control+y');
	await expect(elementsOfType(page, 'ink drawing')).toHaveCount(1);
	const saved = info.outputPath('draw-edit.pptx');
	const bytes = await downloadBytes(await savePptxViaBackstage(page));
	await writeFile(saved, bytes);
	const zip = await JSZip.loadAsync(bytes);
	const ink = await zip.file('ppt/ink/ink1.xml')!.async('string');
	expect(ink).toMatch(/name="width" value="16"/u);
	expect(ink).toMatch(/name="color" value="#ff0000"/u);
	await loadDeck(page, saved);
	// PowerPoint stores authored strokes as editable InkML content parts.
	const savedStroke = viewport(page)
		.getByRole('group', { name: 'Content part', exact: true })
		.locator('svg [stroke="#ff0000"], svg [fill="#ff0000"]');
	// A native release-pressure sample can render as circles instead of a path.
	await expect(savedStroke.first()).toBeVisible();
});

test('Draw tools and settings retain public customization IDs', async ({ page }) => {
	const customization = {
		ribbon: { hiddenButtons: ['draw.tools.freeform', 'draw.tools.penColor'] },
	};
	await loadDeck(
		page,
		undefined,
		`/?customization=${encodeURIComponent(JSON.stringify(customization))}`,
	);
	await ribbonTab(page, 'Draw').click();
	await expect(page.locator('[data-ribbon-control="draw.tools.freeform"]')).toBeHidden();
	await expect(page.locator('[data-ribbon-control="draw.tools.penColor"]')).toBeHidden();
	await expect(page.locator('[data-ribbon-control="draw.tools.penWidth"]')).toBeVisible();
});

test.describe('touch Draw controls', () => {
	test.use({ hasTouch: true });
	test('color choices, focus and forced colors remain reachable', async ({ page }) => {
		await loadDeck(page);
		await ribbonTab(page, 'Draw').tap();
		const draw = page.locator('pptx-ui-ribbon-draw');
		await draw.evaluate((host) => host.style.setProperty('--pptx-primary', '#123456'));
		await expect(draw.getByRole('button', { name: 'Select', exact: true })).toHaveCSS(
			'color',
			'rgb(18, 52, 86)',
		);
		await page.setViewportSize({ width: 900, height: 900 });
		const trigger = draw.locator('summary');
		await trigger.tap();
		const red = draw.getByRole('button', { name: 'Red', exact: true });
		const box = await red.boundingBox();
		expect(box!.width).toBeGreaterThanOrEqual(44);
		expect(box!.height).toBeGreaterThanOrEqual(44);
		await page.emulateMedia({ forcedColors: 'active' });
		await expect(red).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(trigger).toBeFocused();
		await expect(draw.locator('details')).not.toHaveAttribute('open');
	});
});
