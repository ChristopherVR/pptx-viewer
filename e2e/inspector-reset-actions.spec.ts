/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * #398: every binding offers the same inspector Reset and Clear actions, with
 * the same gating and the same undoable behaviour.
 *
 * The audit behind #386 found that Svelte and Vanilla were missing Reset Crop,
 * Reset trim, Clear series colour and the inspector Clear Background, that
 * Svelte hard-coded an English "Reset picture", and that React, Vue and
 * Angular gated Reset Picture three different ways. The shared contract is
 * `inspector-reset-actions` in pptx-viewer-shared; this spec fails when any
 * binding drifts from it.
 *
 * The fixture carries one of each target: a picture with an effect and a crop,
 * an audio clip trimmed by 500 ms, a chart with coloured series, and a solid
 * slide background.
 *
 * Run: bunx playwright test inspector-reset-actions
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { fixture, inspector, loadDeck, slideElements, slideStage } from './support/deck';

const FIXTURE = fixture('inspector-reset-actions.pptx');

/** Authoring order on the slide: anchor shape, picture, audio, chart. */
const PICTURE = 1;
const AUDIO = 2;
const CHART = 3;

const undoButton = (page: Page): Locator => page.getByRole('button', { name: /^undo/iu }).first();

const action = (page: Page, name: string): Locator =>
	inspector(page).getByRole('button', { name, exact: true }).filter({ visible: true });

/** The Crop Left control (a slider or a number field, depending on the binding). */
const cropLeft = (page: Page): Locator => inspector(page).getByLabel('Crop Left').first();

async function select(page: Page, index: number): Promise<void> {
	const target = slideElements(page).nth(index);
	for (let attempt = 0; attempt < 4; attempt++) {
		const box = await target.boundingBox();
		if (!box) {
			throw new Error(`element ${index} has no bounding box`);
		}
		// The chart is clicked in its bottom-right corner so a bar or the title
		// does not turn the click into a chart-part selection, and the audio
		// icon in its top-left corner so the click misses the player controls.
		const [dx, dy] =
			index === CHART
				? [box.width - 6, box.height - 6]
				: index === AUDIO
					? [6, 6]
					: [box.width / 2, box.height / 2];
		await page.mouse.click(box.x + dx, box.y + dy);
		if (await inspector(page).isVisible()) {
			return;
		}
	}
	await expect(inspector(page)).toBeVisible();
}

async function deselect(page: Page): Promise<void> {
	const box = await slideStage(page).boundingBox();
	if (!box) {
		throw new Error('the stage has no bounding box');
	}
	await page.mouse.click(box.x + box.width - 8, box.y + box.height / 2);
}

test.beforeEach(async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await loadDeck(page, FIXTURE);
	await slideElements(page).nth(CHART).waitFor();
	await page.waitForFunction(() => document.fonts.status === 'loaded');
});

test.describe('inspector reset and clear actions', () => {
	test('Reset Picture is enabled for an adjusted picture, undoable, then disabled', async ({
		page,
	}) => {
		await select(page, PICTURE);
		await expect(action(page, 'Reset Picture')).toBeEnabled();

		await action(page, 'Reset Picture').click();
		await expect(undoButton(page)).toBeEnabled();
		await select(page, PICTURE);
		await expect(action(page, 'Reset Picture')).toBeDisabled();

		await undoButton(page).click();
		await select(page, PICTURE);
		await expect(action(page, 'Reset Picture')).toBeEnabled();
	});

	test('Reset Crop is offered for a picture and is one undo step', async ({ page }) => {
		await select(page, PICTURE);
		await expect(action(page, 'Reset Crop')).toBeEnabled();
		await expect(cropLeft(page)).toHaveValue('10');

		await action(page, 'Reset Crop').click();
		await expect(undoButton(page)).toBeEnabled();
		await select(page, PICTURE);
		await expect(cropLeft(page)).toHaveValue('0');

		await undoButton(page).click();
		await select(page, PICTURE);
		await expect(cropLeft(page)).toHaveValue('10');
	});

	test('Reset trim appears only for a trimmed clip and is undoable', async ({ page }) => {
		await select(page, PICTURE);
		await expect(action(page, 'Reset trim')).toHaveCount(0);

		await select(page, AUDIO);
		await expect(action(page, 'Reset trim')).toHaveCount(1);
		await action(page, 'Reset trim').click();
		await expect(undoButton(page)).toBeEnabled();
		await select(page, AUDIO);
		await expect(action(page, 'Reset trim')).toHaveCount(0);

		await undoButton(page).click();
		await select(page, AUDIO);
		await expect(action(page, 'Reset trim')).toHaveCount(1);
	});

	test('Clear series colour clears one series colour and is undoable', async ({ page }) => {
		await select(page, CHART);
		const clear = action(page, 'Clear series colour');
		await expect(clear.first()).toBeVisible();
		const before = await clear.count();
		expect(before).toBeGreaterThan(0);

		await clear.first().click();
		await expect(undoButton(page)).toBeEnabled();
		await expect(clear).toHaveCount(before - 1);

		await undoButton(page).click();
		await select(page, CHART);
		await expect(clear).toHaveCount(before);
	});

	test('Clear Background clears the slide background and is undoable', async ({ page }) => {
		await deselect(page);
		await expect(action(page, 'Clear Background')).toBeEnabled();

		await action(page, 'Clear Background').click();
		await expect(undoButton(page)).toBeEnabled();
		await expect(action(page, 'Clear Background')).toHaveCount(0);

		await undoButton(page).click();
		await deselect(page);
		await expect(action(page, 'Clear Background')).toBeEnabled();
	});
});
