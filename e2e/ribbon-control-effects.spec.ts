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

import { SAMPLE_DECK, inspector, loadDeck, slideElements, slideStage } from './support/deck';

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

	test('Apply to All puts the timing on every slide', async ({ page }) => {
		await loadDeck(page, SAMPLE_DECK);
		await openRibbonTab(page, 'Transitions');

		await page.getByRole('button', { name: 'Wipe', exact: true }).first().click();

		// A preset click is the ACTIVE slide only. Svelte and Vanilla rendered
		// Apply to All as an arming CHECKBOX instead of PowerPoint's button, so the
		// same click meant "this slide" or "the whole deck" depending on which
		// binding the user happened to be running.
		const picked = await readDeckJson(page);
		expect(picked.slides?.[0]?.transition?.type).toBe('wipe');
		expect(picked.slides?.[1]?.transition?.type).toBeUndefined();

		// Reading the deck goes through the File backstage, which leaves the ribbon
		// on the File tab; come back to Transitions the way a user would.
		await openRibbonTab(page, 'Transitions');
		await page.getByRole('button', { name: 'Apply to All', exact: true }).first().click();

		const applied = await readDeckJson(page);
		expect(applied.slides?.length).toBeGreaterThan(1);
		for (const slide of applied.slides ?? []) {
			expect(slide.transition?.type).toBe('wipe');
		}
	});

	test('Preview replays the transition on the stage', async ({ page }) => {
		await loadDeck(page, SAMPLE_DECK);
		await openRibbonTab(page, 'Transitions');

		await page.getByRole('button', { name: 'Push', exact: true }).first().click();
		// A long duration so the replay is still running when the assertion polls;
		// the marker is removed the moment the animation ends.
		const duration = page.locator('input[title="Transition duration in seconds"]').first();
		await duration.fill('5');
		await duration.blur();

		await page.getByRole('button', { name: 'Preview', exact: true }).first().click();

		// The one hook all five bindings publish while a preview is playing. A
		// Preview button wired to nothing (Vanilla), or one that quietly
		// re-committed the values the slide already had (React/Vue/Svelte), never
		// sets it - and neither does Angular's, which used to start the show.
		await expect(slideStage(page)).toHaveAttribute('data-pptx-transition-preview', 'push');

		// And it is a REPLAY, not an edit: the deck still says exactly what the
		// gallery click made it say.
		const deck = await readDeckJson(page);
		expect(deck.slides?.[0]?.transition).toMatchObject({ type: 'push', durationMs: 5000 });
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
		// No skip: Svelte's Select was a button that selected everything with no
		// "Select All" command behind it, and Vanilla's menu entry was a listbox
		// `role="option"`, so neither could be reached by the name every other
		// binding uses. Both are trigger + menu now, like React, Vue and Angular.
		await page.getByRole('button', { name: 'Select All', exact: true }).first().click();

		// Delete is the second, independent signal: a command that only LOOKS
		// like it selected everything leaves survivors behind.
		await slideStage(page).press('Delete');
		await expect(elements).toHaveCount(0);
	});
});

test.describe('design tab routes to the surface it names', () => {
	test('Slide Size opens the slide-size control, not Document Properties', async ({ page }) => {
		await loadDeck(page, SAMPLE_DECK);
		await openRibbonTab(page, 'Design');

		await page.getByRole('button', { name: 'Slide Size', exact: true }).first().click();

		// The SLIDE SIZE card lives in the inspector's deck panel in all five
		// bindings; `[data-pptx-inspector]` is the neutral marker they all emit.
		await expect(inspector(page).getByText('Slide Size', { exact: true })).toBeVisible();
		// Three bindings pointed this button at the Document Properties dialog,
		// which has no slide-size control in it at all.
		await expect(page.getByRole('dialog', { name: /propert/iu })).toHaveCount(0);
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
