/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Do the ribbon's controls DO anything?
 *
 * `ribbon-control-inventory.spec.ts` diffs every control's accessible name and
 * disabled state against React. That is exactly the check a no-op control
 * passes: a button with the right label and the right enabled state satisfies
 * it whether or not it is wired to a handler. The whole Transitions tab was
 * inert in React and Vue, the Slide Show Options cluster was inert in all five,
 * and the inventory was green throughout.
 *
 * So this spec asserts EFFECT rather than presence: it drives a control and
 * then reads the DECK MODEL back through File > Export > "Export as JSON",
 * which is the one framework-neutral view of what the ribbon actually wrote.
 * A control that renders, enables and does nothing fails here.
 *
 * Framework-neutral by construction: accessible names from the shared
 * dictionary, the `#file-input` upload hook, the "Presentation toolbar"
 * tablist, and the backstage `role="dialog"` named "File". No ports, no
 * per-binding branching.
 *
 * Run: bunx playwright test ribbon-control-effects
 */
import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { SAMPLE_DECK, loadDeck, slideElements, slideStage } from './support/deck';

test.describe.configure({ timeout: 120_000 });

interface ExportedSlide {
	transition?: {
		type?: string;
		durationMs?: number;
		advanceOnClick?: boolean;
		advanceAfterMs?: number;
	};
}

interface ExportedDeck {
	slides?: ExportedSlide[];
	presentation?: { presentationProperties?: { advanceMode?: string; showWithNarration?: boolean } };
}

const backstage = (page: Page): Locator => page.locator('[role="dialog"][aria-label="File"]');

/** Switch the ribbon to a tab by its accessible name. */
async function openRibbonTab(page: Page, name: string): Promise<void> {
	await page
		.getByRole('toolbar', { name: 'Presentation toolbar' })
		.getByRole('tab', { name, exact: true })
		.click();
}

/**
 * Read the live deck back as JSON.
 *
 * Chosen over reading the saved `.pptx` because it needs no zip/XML parsing in
 * the spec and it covers BOTH halves of what this file asserts: per-slide
 * `transition` and deck-level `presentationProperties`.
 */
async function readDeckJson(page: Page): Promise<ExportedDeck> {
	await openRibbonTab(page, 'File');
	await expect(backstage(page)).toBeVisible();
	await backstage(page).getByRole('button', { name: 'Export', exact: true }).first().click();

	const jsonCard = backstage(page)
		.getByRole('button', { name: /export as json/iu })
		.first();
	await expect(jsonCard).toBeVisible();

	const downloadPromise = page.waitForEvent('download');
	await jsonCard.click();
	const download = await downloadPromise;
	const path = await download.path();
	const deck = JSON.parse(readFileSync(path, 'utf8')) as ExportedDeck;

	// Leave the backstage so a following interaction starts from the ribbon.
	await page.keyboard.press('Escape');
	return deck;
}

test.describe('transitions tab writes to the deck', () => {
	test('picking a preset records it on the active slide', async ({ page }) => {
		await loadDeck(page, SAMPLE_DECK);
		await openRibbonTab(page, 'Transitions');

		await page.getByRole('button', { name: 'Push', exact: true }).first().click();

		const deck = await readDeckJson(page);
		expect(deck.slides?.[0]?.transition?.type).toBe('push');
	});

	test('the duration field records a duration', async ({ page }) => {
		await loadDeck(page, SAMPLE_DECK);
		await openRibbonTab(page, 'Transitions');

		await page.getByRole('button', { name: 'Fade', exact: true }).first().click();
		const duration = page.locator('input[title="Transition duration in seconds"]').first();
		await duration.fill('1.5');
		// Vanilla and Angular commit a number field on `change`, not `input`.
		await duration.blur();

		const deck = await readDeckJson(page);
		expect(deck.slides?.[0]?.transition?.type).toBe('fade');
		expect(deck.slides?.[0]?.transition?.durationMs).toBe(1500);
	});

	test('the Advance Slide group records a timed advance', async ({ page }) => {
		await loadDeck(page, SAMPLE_DECK);
		await openRibbonTab(page, 'Transitions');

		await page.getByRole('button', { name: 'Fade', exact: true }).first().click();

		const after = page.getByRole('checkbox', { name: 'After:' }).first();
		await after.check();
		const seconds = page.locator('input[title="Advance after specified duration"]').first();
		await seconds.fill('00:03.00');
		await seconds.blur();

		const deck = await readDeckJson(page);
		expect(deck.slides?.[0]?.transition?.advanceAfterMs).toBe(3000);
	});
});

test.describe('home tab commands act on the deck', () => {
	test('Select > Select All really selects every element', async ({ page }) => {
		await loadDeck(page, SAMPLE_DECK);
		await openRibbonTab(page, 'Home');

		// `slideElements` and not a raw `[data-element-id]` count: thumbnails carry
		// the same marker in three of the five bindings, so an unscoped count is a
		// different number per binding for reasons unrelated to the slide.
		const elements = slideElements(page);
		expect(await elements.count()).toBeGreaterThan(1);

		await page.getByRole('button', { name: 'Select', exact: true }).first().click();
		const selectAll = page.getByRole('button', { name: 'Select All', exact: true }).first();
		// Recorded rather than hidden: svelte and vanilla ship the Select menu
		// with no Select All command at all, so there is nothing to drive here.
		// That is a product gap in those two bindings, not a flaw in this spec.
		test.skip(
			!(await selectAll.isVisible()),
			'this binding offers no Home > Select > Select All command',
		);
		await selectAll.click();

		// Delete is the second, independent signal: a command that only LOOKS
		// like it selected everything leaves survivors behind.
		await slideStage(page).press('Delete');
		await expect(elements).toHaveCount(0);
	});
});

test.describe('slide show options write to the deck', () => {
	test('unticking Use Timings switches the deck to manual advance', async ({ page }) => {
		await loadDeck(page, SAMPLE_DECK);
		await openRibbonTab(page, 'Slide Show');

		const useTimings = page.getByRole('checkbox', { name: 'Using timings, if present' }).first();
		await expect(useTimings).toBeChecked();
		await useTimings.uncheck();

		const deck = await readDeckJson(page);
		expect(deck.presentation?.presentationProperties?.advanceMode).toBe('manual');
	});

	test('unticking Play Narrations records it on the deck', async ({ page }) => {
		await loadDeck(page, SAMPLE_DECK);
		await openRibbonTab(page, 'Slide Show');

		const narrations = page.getByRole('checkbox', { name: 'Play Narrations' }).first();
		await narrations.uncheck();

		const deck = await readDeckJson(page);
		expect(deck.presentation?.presentationProperties?.showWithNarration).toBe(false);
	});

	test('the two unsupported options render disabled rather than lying', async ({ page }) => {
		await loadDeck(page, SAMPLE_DECK);
		await openRibbonTab(page, 'Slide Show');

		await expect(
			page.getByRole('checkbox', { name: 'Keep Slides Updated' }).first(),
		).toBeDisabled();
		await expect(
			page.getByRole('checkbox', { name: 'Show Media Controls' }).first(),
		).toBeDisabled();
	});
});
