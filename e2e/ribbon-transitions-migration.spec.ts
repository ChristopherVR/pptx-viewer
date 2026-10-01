import { writeFile } from 'node:fs/promises';

/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright API */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import JSZip from 'jszip';

import { savePptxViaBackstage } from './save-pptx';
import { loadDeck, ribbonTab, slideStage, thumbnail } from './support/deck';
import { downloadBytes } from './support/exports';

test.use({ viewport: { width: 1440, height: 900 } });

const GROUPS = ['transitions.preview', 'transitions.transitionToThisSlide', 'transitions.timing'];
const CONTROLS = [
	'transitions.preview.preview',
	'transitions.transitionToThisSlide.gallery',
	'transitions.timing.sound',
	'transitions.timing.duration',
	'transitions.timing.applyToAll',
	'transitions.timing.advanceOnClick',
	'transitions.timing.advanceAfter',
];

async function openTransitions(page: Page, path?: string) {
	await loadDeck(page, undefined, path);
	await ribbonTab(page, 'Transitions').click();
	return page.locator('pptx-ui-ribbon-transitions');
}

const preset = (host: ReturnType<Page['locator']>, name: string) =>
	host.getByRole('button', { name, exact: true });

async function savedSlide(
	page: Page,
	info: { outputPath: (name: string) => string },
	name: string,
) {
	const bytes = await downloadBytes(await savePptxViaBackstage(page));
	const saved = info.outputPath(name);
	await writeFile(saved, bytes);
	const zip = await JSZip.loadAsync(bytes);
	return { saved, xml: await zip.file('ppt/slides/slide1.xml')!.async('string') };
}

test('shared Transitions ribbon exposes every canonical group and control id once', async ({
	page,
}, info) => {
	const host = await openTransitions(page);
	await page.screenshot({ path: info.outputPath('transitions.png') });
	for (const id of GROUPS) {
		await expect(host.locator(`[data-ribbon-group="${id}"]`)).toHaveCount(1);
	}
	for (const id of CONTROLS) {
		await expect(host.locator(`[data-ribbon-control="${id}"]`)).toHaveCount(1);
	}
	await expect(host.locator('.preset')).toHaveCount(9);
	await expect(preset(host, 'None')).toHaveAttribute('aria-pressed', 'true');
});

test('presets, timing and sound edit the deck, undo and survive save and reload', async ({
	page,
}, info) => {
	const host = await openTransitions(page);
	// Keyboard activation of a gallery preset.
	await preset(host, 'Push').focus();
	await page.keyboard.press('Space');
	await expect(preset(host, 'Push')).toHaveAttribute('aria-pressed', 'true');
	await expect(preset(host, 'None')).toHaveAttribute('aria-pressed', 'false');
	const duration = host.locator('input[title="Transition duration in seconds"]');
	await duration.fill('2.5');
	await duration.blur();
	await expect(duration).toHaveValue('2.5');
	const after = host.getByRole('checkbox', { name: 'After:', exact: true });
	await after.check();
	const seconds = host.locator('input[title="Advance after specified duration"]');
	await expect(seconds).toBeEnabled();
	await seconds.fill('00:04.00');
	await seconds.blur();
	await expect(seconds).toHaveValue('00:04.00');
	await host.getByRole('combobox', { name: 'Sound:', exact: true }).selectOption('chime');
	await page.screenshot({ path: info.outputPath('transitions-applied.png') });

	// Undo reverts the most recent native commit; redo restores it.
	const undo = page.getByRole('button', { name: /^Undo\b/u }).first();
	await expect(undo).toBeEnabled();
	await undo.click();
	await ribbonTab(page, 'Transitions').click();
	await expect(preset(host, 'Push')).toHaveAttribute('aria-pressed', 'true');
	await expect(host.getByRole('combobox', { name: 'Sound:', exact: true })).toHaveValue('none');
	await page
		.getByRole('button', { name: /^Redo\b/u })
		.first()
		.click();
	await expect(host.getByRole('combobox', { name: 'Sound:', exact: true })).toHaveValue('chime');

	const { saved, xml } = await savedSlide(page, info, 'transitions-edit.pptx');
	expect(xml).toMatch(/<p:push\b/u);
	expect(xml).toMatch(/advTm="4000"/u);
	expect(xml).toMatch(/CHIMES\.WAV/u);
	const reloaded = page.locator('pptx-ui-ribbon-transitions');
	await loadDeck(page, saved);
	await ribbonTab(page, 'Transitions').click();
	await expect(preset(reloaded, 'Push')).toHaveAttribute('aria-pressed', 'true');
	await expect(reloaded.locator('input[title="Transition duration in seconds"]')).toHaveValue(
		'2.5',
	);
	await expect(reloaded.getByRole('checkbox', { name: 'After:', exact: true })).toBeChecked();
	await expect(reloaded.locator('input[title="Advance after specified duration"]')).toHaveValue(
		'00:04.00',
	);
});

test('Apply to All reaches other slides while a preset stays on the active slide', async ({
	page,
}) => {
	const host = await openTransitions(page);
	await preset(host, 'Wipe').click();
	await thumbnail(page, 2).click();
	await ribbonTab(page, 'Transitions').click();
	await expect(preset(host, 'None')).toHaveAttribute('aria-pressed', 'true');
	await thumbnail(page, 1).click();
	await ribbonTab(page, 'Transitions').click();
	await expect(preset(host, 'Wipe')).toHaveAttribute('aria-pressed', 'true');
	await host.getByRole('button', { name: 'Apply to All', exact: true }).click();
	await thumbnail(page, 2).click();
	await ribbonTab(page, 'Transitions').click();
	await expect(preset(host, 'Wipe')).toHaveAttribute('aria-pressed', 'true');
});

test('Preview replays the transition on the stage without editing the deck', async ({ page }) => {
	const host = await openTransitions(page);
	await preset(host, 'Push').click();
	const duration = host.locator('input[title="Transition duration in seconds"]');
	await duration.fill('5');
	await duration.blur();
	await host.getByRole('button', { name: 'Preview', exact: true }).click();
	await expect(slideStage(page)).toHaveAttribute('data-pptx-transition-preview', 'push');
	await expect(preset(host, 'Push')).toHaveAttribute('aria-pressed', 'true');
});

test('Transitions controls retain public customization IDs', async ({ page }) => {
	const customization = {
		ribbon: {
			hiddenButtons: [
				'transitions.timing.sound',
				'transitions.timing.duration',
				'transitions.preview.preview',
			],
		},
	};
	await openTransitions(
		page,
		`/?customization=${encodeURIComponent(JSON.stringify(customization))}`,
	);
	for (const id of customization.ribbon.hiddenButtons) {
		await expect(page.locator(`[data-ribbon-control="${id}"]`)).toBeHidden();
	}
	await expect(page.locator('[data-ribbon-control="transitions.timing.applyToAll"]')).toBeVisible();
	await expect(
		page.locator('[data-ribbon-control="transitions.transitionToThisSlide.gallery"]'),
	).toBeVisible();
});

test.describe('touch Transitions controls', () => {
	test.use({ hasTouch: true });
	test('targets, theme tokens, focus and forced colors remain usable', async ({ page }, info) => {
		await loadDeck(page);
		await ribbonTab(page, 'Transitions').tap();
		const host = page.locator('pptx-ui-ribbon-transitions');
		await host.evaluate((el) => el.style.setProperty('--pptx-primary', '#123456'));
		await page.setViewportSize({ width: 900, height: 900 });
		const none = preset(host, 'None');
		await expect(none).toHaveCSS('color', 'rgb(18, 52, 86)');
		const box = await preset(host, 'Fade').boundingBox();
		expect(box!.height).toBeGreaterThanOrEqual(44);
		const duration = await host
			.locator('input[title="Transition duration in seconds"]')
			.boundingBox();
		expect(duration!.height).toBeGreaterThanOrEqual(44);
		await page.screenshot({ path: info.outputPath('transitions-touch.png') });
		await preset(host, 'Fade').tap();
		await expect(preset(host, 'Fade')).toHaveAttribute('aria-pressed', 'true');
		await preset(host, 'Cut').focus();
		await expect(preset(host, 'Cut')).toBeFocused();
		await page.emulateMedia({ forcedColors: 'active' });
		await expect(preset(host, 'Fade')).toBeVisible();
	});
});
