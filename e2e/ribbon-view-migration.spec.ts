/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright API */
import { expect, test } from '@playwright/test';

import { loadDeck, ribbonTab } from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

const GROUPS = [
	'view.presentationViews',
	'view.masterViews',
	'view.show',
	'view.zoom',
	'view.window',
];
const CONTROLS = [
	'view.presentationViews.normal',
	'view.presentationViews.slideSorter',
	'view.presentationViews.outline',
	'view.presentationViews.readingView',
	'view.masterViews.slideMaster',
	'view.masterViews.handoutMaster',
	'view.masterViews.notesMaster',
	'view.show.ruler',
	'view.show.gridlines',
	'view.show.guides',
	'view.show.snapToGrid',
	'view.show.selectionPane',
	'view.show.eyedropper',
	'view.show.snapToShape',
	'view.show.addGuide',
	'view.zoom.zoom',
	'view.zoom.fitToWindow',
	'view.window.templateEditing',
	'view.window.macros',
];

async function openView(page: import('@playwright/test').Page) {
	await loadDeck(page);
	await ribbonTab(page, 'View').click();
	return page.locator('pptx-ui-ribbon-view');
}

test('shared View ribbon exposes every canonical group and control id once', async ({
	page,
}, info) => {
	const view = await openView(page);
	await page.screenshot({ path: info.outputPath('view.png') });
	for (const id of GROUPS) {
		await expect(view.locator(`[data-ribbon-group="${id}"]`)).toHaveCount(1);
	}
	for (const id of CONTROLS) {
		await expect(view.locator(`[data-ribbon-control="${id}"]`)).toHaveCount(1);
	}
	for (const id of [
		'view.masterViews.handoutMaster',
		'view.masterViews.notesMaster',
		'view.zoom.zoom',
		'view.window.macros',
	]) {
		await expect(view.locator(`[data-ribbon-control="${id}"] button`)).toBeDisabled();
	}
});

test('Show toggles drive the native rulers, pressed state and keyboard activation', async ({
	page,
}) => {
	const view = await openView(page);
	const rulers = view.getByRole('checkbox', { name: 'Rulers', exact: true });
	await expect(rulers).not.toBeChecked();
	await expect(page.locator('[data-pptx-ruler]:visible')).toHaveCount(0);
	await rulers.focus();
	await page.keyboard.press('Space');
	await expect(rulers).toBeChecked();
	await expect(page.locator('[data-pptx-ruler]:visible')).toHaveCount(2);
	await rulers.click();
	await expect(rulers).not.toBeChecked();
	await expect(page.locator('[data-pptx-ruler]:visible')).toHaveCount(0);
	const snap = view.getByRole('button', { name: 'Snap to Shape', exact: true });
	const before = await snap.getAttribute('aria-pressed');
	await snap.click();
	await expect(snap).toHaveAttribute('aria-pressed', before === 'true' ? 'false' : 'true');
});

test('presentation views and template editing reflect native state', async ({ page }) => {
	const view = await openView(page);
	await view.getByRole('button', { name: 'Outline View', exact: true }).click();
	await expect(page.getByRole('region', { name: 'Outline View', exact: true })).toBeVisible();
	await page
		.getByRole('region', { name: 'Outline View', exact: true })
		.getByRole('button', { name: 'Normal view', exact: true })
		.click();
	await expect(page.getByRole('region', { name: 'Outline View', exact: true })).toHaveCount(0);
	await ribbonTab(page, 'View').click();
	await view.getByRole('button', { name: 'Normal', exact: true }).click();
	const template = view.getByRole('button', { name: 'Templates Off', exact: true });
	await template.click();
	await expect(view.getByRole('button', { name: 'Templates On', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true',
	);
});

test('persisted viewer options survive a reload', async ({ page }) => {
	const view = await openView(page);
	const grid = view.getByRole('checkbox', { name: 'Grid', exact: true });
	const initial = await grid.isChecked();
	await grid.click();
	await expect(grid).toBeChecked({ checked: !initial });
	await loadDeck(page);
	await ribbonTab(page, 'View').click();
	await expect(
		page.locator('pptx-ui-ribbon-view').getByRole('checkbox', { name: 'Grid', exact: true }),
	).toBeChecked({ checked: !initial });
	await page
		.locator('pptx-ui-ribbon-view')
		.getByRole('checkbox', { name: 'Grid', exact: true })
		.click();
});

test('View groups and controls retain public customization IDs', async ({ page }) => {
	const customization = {
		ribbon: {
			hiddenButtons: ['view.show.guides', 'view.show.addGuide', 'view.zoom.fitToWindow'],
		},
	};
	await loadDeck(
		page,
		undefined,
		`/?customization=${encodeURIComponent(JSON.stringify(customization))}`,
	);
	await ribbonTab(page, 'View').click();
	for (const id of customization.ribbon.hiddenButtons) {
		await expect(page.locator(`[data-ribbon-control="${id}"]`)).toBeHidden();
	}
	await expect(page.locator('[data-ribbon-control="view.show.ruler"]')).toBeVisible();
});

test.describe('touch View controls', () => {
	test.use({ hasTouch: true });
	test('targets, theme tokens, focus and forced colors remain usable', async ({ page }) => {
		await loadDeck(page);
		await ribbonTab(page, 'View').tap();
		const view = page.locator('pptx-ui-ribbon-view');
		await view.evaluate((host) => host.style.setProperty('--pptx-primary', '#123456'));
		await page.setViewportSize({ width: 900, height: 900 });
		const reading = view.getByRole('button', { name: 'Reading View', exact: true });
		const box = await reading.boundingBox();
		expect(box!.height).toBeGreaterThanOrEqual(44);
		const rulerRow = view.locator('[data-ribbon-control="view.show.ruler"]');
		expect((await rulerRow.boundingBox())!.height).toBeGreaterThanOrEqual(44);
		await reading.focus();
		await expect(reading).toBeFocused();
		await page.emulateMedia({ forcedColors: 'active' });
		await expect(reading).toBeVisible();
	});
});
