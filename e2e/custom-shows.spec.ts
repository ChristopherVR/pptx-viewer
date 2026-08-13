/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Custom shows: what a deck defines, and which of them it opens into.
 *
 * Before this spec there was ZERO e2e coverage for custom shows: `grep -rli
 * "custom.show" e2e/*.spec.ts` matched nothing across all 82 specs. That is
 * how three separate defects stayed invisible to CI at once.
 *
 *   - Angular never seeded its custom-show list from the file and never saved
 *     it, and mapped shows to slide ARCHIVE PATHS where relationship ids are
 *     required (a package PowerPoint rejects).
 *   - The "Set Up Slide Show > Custom show" radio was decorative in all five
 *     bindings: `p:showPr/p:custShow/@id` was parsed and serialised, and then
 *     no presentation controller read it back, so a deck authored to open into
 *     one specific show played the whole deck instead.
 *   - `PptxData.headerFooter` was read from `p:presentation/p:hf`, an element
 *     the OOXML schema does not allow and no real deck has ever contained, so
 *     the footer a deck defines never reached the canvas.
 *
 * The deck is `header-footer-shows.pptx`, authored by PowerPoint itself: its
 * slide master carries the footer/date TEXT (which is where PowerPoint keeps
 * it), it defines "Short Show" (slides 1 and 3) and "Reverse" (3, 2, 1), and
 * its `p:showPr` selects "Short Show". So "does the show run" is answerable
 * without touching any binding's chrome: press forward on slide 1 and see
 * whether slide 2 is skipped.
 *
 * Run: bunx playwright test custom-shows
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { fixture, resetTabSession } from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

const DECK = fixture('header-footer-shows.pptx');

const TITLES = ['Alpha Slide', 'Beta Slide', 'Gamma Slide'] as const;

/** Enter presentation mode through either the status bar or legacy Present button. */
async function enterPresentation(page: Page): Promise<void> {
	const slideShowButtons = page.getByRole('button', { name: /^slide show$/iu });
	if ((await slideShowButtons.count()) > 0) {
		await slideShowButtons.last().click();
		return;
	}
	await page
		.getByRole('button', { name: /present/iu })
		.first()
		.click();
}

/** Load the deck and enter presentation mode, landing on slide 1. */
async function openInPresentMode(page: Page): Promise<void> {
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(DECK);
	await page.locator('[data-element-id]').filter({ hasText: TITLES[0] }).first().waitFor();
	await enterPresentation(page);
	await page.waitForTimeout(700);
}

/**
 * The title of whichever slide is on screen right now.
 *
 * Read off the live `[data-element-id]` nodes rather than a slide index,
 * because the bindings disagree about whether the index a presentation reports
 * is the DECK position or the position within the running show, and this spec
 * is about what the room sees.
 */
async function visibleTitle(page: Page): Promise<string> {
	for (const title of TITLES) {
		const node = page.locator('[data-element-id]').filter({ hasText: title });
		const count = await node.count();
		for (let index = 0; index < count; index += 1) {
			if (await node.nth(index).isVisible()) {
				return title;
			}
		}
	}
	return 'none';
}

/*
 * Both assertions are BEHAVIOURAL rather than about chrome, on purpose.
 *
 * The first draft asserted that the show names were findable as text once the
 * deck loaded. React and Vue put them in a toolbar select at load, so it
 * passed there, while Svelte and Vanilla only reveal them inside a dialog the
 * user has to open, so it failed on both for a reason that was about menu
 * placement and nothing else. Menu placement is not what these three defects
 * were, and a spec that five bindings cannot satisfy without agreeing on their
 * chrome is a parity spec about the wrong thing.
 *
 * Playing the show exercises the same wiring end to end and cannot be faked: a
 * binding that never seeds its custom-show list (Angular), or that parses
 * `p:showPr/p:custShow/@id` and then ignores it (all five), presents the whole
 * deck and lands on Beta.
 */
test.describe('custom shows', () => {
	test('a deck authored to open into a custom show plays only that show', async ({ page }) => {
		await openInPresentMode(page);
		expect(await visibleTitle(page)).toBe(TITLES[0]);

		await page.keyboard.press('PageDown');
		await page.waitForTimeout(700);

		// "Short Show" is slides 1 and 3, so forward from slide 1 must SKIP
		// slide 2. Playing the whole deck (the old behaviour) lands on Beta.
		expect(await visibleTitle(page)).toBe(TITLES[2]);
	});

	test('the show never visits a slide outside its membership', async ({ page }) => {
		await openInPresentMode(page);
		const seen: string[] = [await visibleTitle(page)];
		for (let step = 0; step < 3; step += 1) {
			await page.keyboard.press('PageDown');
			await page.waitForTimeout(500);
			seen.push(await visibleTitle(page));
		}
		// Beta is in the deck but not in "Short Show". Reaching it at any point
		// means the show is not driving playback.
		expect(seen).not.toContain(TITLES[1]);
		expect(seen).toContain(TITLES[0]);
		expect(seen).toContain(TITLES[2]);
	});
});

/*
 * Deliberately NOT asserted here: that the deck's footer TEXT reaches the
 * canvas. It does not, and the cause is upstream of any binding. PowerPoint
 * keeps the footer string on the slide MASTER and leaves each slide's `ftr`
 * placeholder empty to inherit it; our loader drops an empty placeholder shape
 * entirely, so slide 1 of this deck parses to three elements (title, slide
 * number, date) and no footer at all. Fixing that needs placeholder-text
 * inheritance for `ftr` / `dt` / `hdr` at parse time, which in turn needs the
 * placeholder type on `PptxElement`. Tracked as remaining work; the
 * header/footer ROUND TRIP is covered by
 * `packages/core/.../PptxHandlerRuntimeHeaderFooterAndSlideSize.test.ts` and
 * confirmed against PowerPoint through COM.
 */
