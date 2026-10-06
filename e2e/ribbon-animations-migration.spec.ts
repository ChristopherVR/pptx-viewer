import { writeFile } from 'node:fs/promises';

/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright API */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import JSZip from 'jszip';

import { savePptxViaBackstage } from './save-pptx';
import {
	elementWithText,
	fixture,
	inspector,
	loadDeck,
	ribbonTab,
	SAMPLE_DECK,
	selectElement,
} from './support/deck';
import { downloadBytes } from './support/exports';

test.use({ viewport: { width: 1440, height: 900 } });

const DECK = fixture('ribbon-galleries.pptx');
const SHAPE_TEXT = 'GALLERY SHAPE';
const GROUPS = [
	'animations.preview',
	'animations.animation',
	'animations.motionPath',
	'animations.advancedAnimation',
	'animations.timing',
];
const CONTROLS = [
	'animations.preview.preview',
	'animations.animation.gallery',
	'animations.animation.effectOptions',
	'animations.motionPath.gallery',
	'animations.advancedAnimation.addAnimation',
	'animations.advancedAnimation.animationPane',
	'animations.advancedAnimation.trigger',
	'animations.advancedAnimation.animationPainter',
	'animations.advancedAnimation.remove',
	'animations.timing.start',
	'animations.timing.duration',
];

async function openAnimations(page: Page, select = false, deck = DECK) {
	await loadDeck(page, deck);
	if (select) {
		await selectElement(page, elementWithText(page, SHAPE_TEXT));
	}
	await ribbonTab(page, 'Animations').click();
	return page.locator('pptx-ui-ribbon-animations');
}

async function savedSlideXml(page: Page): Promise<{ path: string; xml: string }> {
	const bytes = await downloadBytes(await savePptxViaBackstage(page));
	const zip = await JSZip.loadAsync(bytes);
	const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
	return { path: 'ppt/slides/slide1.xml', xml };
}

test('shared Animations ribbon exposes every canonical group and control id once', async ({
	page,
}, info) => {
	// The shared demo deck matches the recorded baseline captures.
	const animations = await openAnimations(page, false, SAMPLE_DECK);
	await page.screenshot({ path: info.outputPath('animations.png') });
	for (const id of GROUPS) {
		await expect(animations.locator(`[data-ribbon-group="${id}"]`)).toHaveCount(1);
	}
	for (const id of CONTROLS) {
		await expect(animations.locator(`[data-ribbon-control="${id}"]`)).toHaveCount(1);
	}
	// Without a selection every authoring control is disabled; the pane is not.
	for (const id of [
		'animations.preview.preview',
		'animations.advancedAnimation.addAnimation',
		'animations.advancedAnimation.remove',
		'animations.advancedAnimation.animationPainter',
	]) {
		await expect(animations.locator(`[data-ribbon-control="${id}"] button`)).toBeDisabled();
	}
	await expect(
		animations.locator('[data-ribbon-control="animations.advancedAnimation.animationPane"] button'),
	).toBeEnabled();
	await expect(animations.getByRole('button', { name: 'Fly In', exact: true })).toBeDisabled();
	await expect(
		animations.locator('[data-ribbon-control="animations.timing.duration"]'),
	).toBeDisabled();
});

async function addFlyIn(page: Page) {
	const animations = await openAnimations(page, true);
	const flyIn = animations.getByRole('button', { name: 'Fly In', exact: true });
	await expect(flyIn).toBeEnabled();
	await flyIn.focus();
	await page.keyboard.press('Space');
	return animations;
}

test('adding an effect from the gallery reaches the deck and the Animation Pane', async ({
	page,
}) => {
	const animations = await addFlyIn(page);
	// The ribbon never leaves the selection: Preview becomes usable.
	await expect(
		animations.locator('[data-ribbon-control="animations.preview.preview"] button'),
	).toBeEnabled();
	const pane = animations.locator(
		'[data-ribbon-control="animations.advancedAnimation.animationPane"] button',
	);
	if (!(await inspector(page).isVisible())) {
		await pane.click();
	}
	await expect(inspector(page)).toBeVisible();
	await expect(pane).toHaveAttribute('aria-pressed', 'true');
	const { xml } = await savedSlideXml(page);
	expect(xml).toContain('<p:timing');
	expect(xml).toMatch(/presetClass="entr"/u);
	expect(xml).toMatch(/presetID="2"/u);
});

test('undo removes the added effect from the saved deck', async ({ page }) => {
	await addFlyIn(page);
	const undo = page.getByRole('button', { name: 'Undo', exact: true }).first();
	await expect(undo).toBeEnabled();
	await undo.click();
	// Saving while the undo is still in flight loses it, and every poll would save again:
	// wait for the UI to show the undo (Redo becomes available), then save once.
	await expect(page.getByRole('button', { name: 'Redo', exact: true }).first()).toBeEnabled();
	expect((await savedSlideXml(page)).xml).not.toContain('<p:timing');
});

test('a redone effect survives save and reload and previews on the saved deck', async ({
	page,
}, info) => {
	await addFlyIn(page);
	await page.getByRole('button', { name: 'Undo', exact: true }).first().click();
	await page.getByRole('button', { name: 'Redo', exact: true }).first().click();
	const saved = info.outputPath('animation-edit.pptx');
	const bytes = await downloadBytes(await savePptxViaBackstage(page));
	await writeFile(saved, bytes);
	const zip = await JSZip.loadAsync(bytes);
	expect(await zip.file('ppt/slides/slide1.xml')!.async('string')).toMatch(/presetID="2"/u);

	await loadDeck(page, saved);
	await selectElement(page, elementWithText(page, SHAPE_TEXT));
	await ribbonTab(page, 'Animations').click();
	// The saved effect is the selection's own: Preview starts a real CSS animation.
	await page.evaluate(() => {
		document.documentElement.removeAttribute('data-ribbon-animation-preview');
		const record = (event: AnimationEvent) => {
			document.documentElement.setAttribute('data-ribbon-animation-preview', event.animationName);
			document.removeEventListener('animationstart', record, true);
		};
		document.addEventListener('animationstart', record, true);
	});
	await page
		.locator('[data-ribbon-control="animations.preview.preview"]')
		.getByRole('button')
		.click();
	await expect(page.locator('html')).toHaveAttribute('data-ribbon-animation-preview', /^pptx-/u);
});

test('a motion path from the gallery is written to the deck', async ({ page }) => {
	const animations = await openAnimations(page, true);
	await animations
		.locator('[data-ribbon-control="animations.motionPath.gallery"] button')
		.first()
		.click();
	const { xml } = await savedSlideXml(page);
	expect(xml).toContain('<p:animMotion');
});

test('Animations controls retain public customization IDs', async ({ page }) => {
	const customization = {
		ribbon: {
			hiddenButtons: ['animations.advancedAnimation.addAnimation', 'animations.timing.start'],
			hiddenGroups: ['animations.motionPath'],
		},
	};
	await loadDeck(
		page,
		DECK,
		`/?customization=${encodeURIComponent(JSON.stringify(customization))}`,
	);
	await ribbonTab(page, 'Animations').click();
	await expect(
		page.locator('[data-ribbon-control="animations.advancedAnimation.addAnimation"]'),
	).toBeHidden();
	await expect(page.locator('[data-ribbon-control="animations.timing.start"]')).toBeHidden();
	await expect(page.locator('[data-ribbon-group="animations.motionPath"]')).toBeHidden();
	await expect(page.locator('[data-ribbon-control="animations.timing.duration"]')).toBeVisible();
	await expect(page.locator('[data-ribbon-group="animations.animation"]')).toBeVisible();
});

test.describe('touch Animations controls', () => {
	test.use({ hasTouch: true });
	test('targets, focus, theme tokens and forced colors remain usable', async ({ page }) => {
		// No canvas selection: the Animation Pane is the one command that never needs one.
		const animations = await openAnimations(page);
		await page.setViewportSize({ width: 900, height: 900 });
		const flyIn = animations.getByRole('button', { name: 'Fly In', exact: true });
		const box = await flyIn.boundingBox();
		expect(box!.height).toBeGreaterThanOrEqual(44);
		const pane = animations.locator(
			'[data-ribbon-control="animations.advancedAnimation.animationPane"] button',
		);
		const paneBox = await pane.boundingBox();
		expect(paneBox!.height).toBeGreaterThanOrEqual(44);
		await pane.focus();
		// Keyboard modality makes the focus ring visible.
		await page.keyboard.press('Shift+Tab');
		await page.keyboard.press('Tab');
		await expect(pane).toBeFocused();
		await expect(pane).toHaveCSS('outline-style', 'solid');
		await animations.evaluate((host) => host.style.setProperty('--pptx-primary', '#123456'));
		if ((await pane.getAttribute('aria-pressed')) !== 'true') {
			await pane.tap();
		}
		await expect(pane).toHaveAttribute('aria-pressed', 'true');
		await expect(pane).toHaveCSS('color', 'rgb(18, 52, 86)');
		await page.emulateMedia({ forcedColors: 'active' });
		await expect(flyIn).toBeVisible();
		await expect(
			animations.locator('[data-ribbon-control="animations.animation.gallery"]'),
		).toHaveCSS('border-top-style', 'solid');
	});
});
