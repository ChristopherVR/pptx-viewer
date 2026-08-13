/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { resetTabSession } from './support/deck';
import { presentingStageText } from './support/slide-text';

/**
 * Slide-show behaviour every binding must share (issue #106).
 *
 * The show used to inherit editing rules in the React binding: the editor's fit
 * scale is capped at 1 so a slide never zooms past 100% while you edit, which
 * left a 1280x720 deck at native size on a larger display and made the
 * transition overlay (which fitted the whole canvas area) play at a different
 * size from the slide underneath it. These lock in the corrected behaviour and
 * PowerPoint's navigation keys.
 *
 * They also pin the chrome rule: a running show shows no editing chrome in any
 * binding. See 'a running show carries no editor chrome' for what that means and
 * why "covered by an opaque overlay" is not the same thing.
 */

const deck = resolve(fileURLToPath(new URL('./fixtures/sample-deck.pptx', import.meta.url)));

/** Load the fixture and start the slide show. */
async function startShow(page: Page): Promise<void> {
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(deck);
	await page.locator('[data-pptx-element="true"]').first().waitFor();
	await page.waitForTimeout(600);
	await page
		.getByRole('button', { name: /^present$|slide show/iu })
		.first()
		.click();
	// Fullscreen + entrance animations settle before measuring.
	await page.waitForTimeout(1500);
}

/**
 * Text of the RUNNING SHOW's slide surface, used as a binding-neutral
 * "which slide is showing" probe.
 *
 * See {@link presentingStageText}: the scrape has to skip the stage's own
 * `<style>` children, or it reads the injected hit-test / morph-keyframe CSS
 * as the slide's text and reports the same string on every slide.
 */
async function visibleSlideText(page: Page): Promise<string> {
	return presentingStageText(page);
}

test('the slide show fills the display instead of sitting at native size', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await startShow(page);

	const fill = await page.evaluate(() => {
		// The largest landscape box on screen is the slide surface.
		const boxes = [...document.querySelectorAll('div,section')]
			.map((node) => node.getBoundingClientRect())
			.filter((r) => r.width > 300 && r.height > 200 && r.width / r.height > 1.2)
			.sort((a, b) => b.width * b.height - a.width * a.height);
		const best = boxes[0];
		return best ? { width: best.width, viewport: window.innerWidth } : null;
	});

	expect(fill).not.toBeNull();
	// A 16:9 deck on a 16:10 display letterboxes vertically but must still use
	// the full width. Anything near the deck's own 1280px would be the old
	// capped-at-100% behaviour.
	expect(fill!.width).toBeGreaterThan(fill!.viewport * 0.95);
});

test('slide content is inert while presenting', async ({ page }) => {
	await startShow(page);

	// No resize/rotate affordances may be reachable over a running show.
	await expect(page.getByLabel(/rotate/iu).filter({ visible: true })).toHaveCount(0);

	const draggable = await page.evaluate(
		() =>
			[...document.querySelectorAll('[data-pptx-element="true"]')].filter((node) => {
				const style = getComputedStyle(node);
				return style.pointerEvents !== 'none' && style.cursor === 'move';
			}).length,
	);
	expect(draggable).toBe(0);
});

test('a running show carries no editor chrome', async ({ page }) => {
	await startShow(page);

	// PowerPoint's slide show replaces the editor; it does not float over a live
	// one. Every binding must therefore take its chrome out of the layout, the
	// focus order and the accessibility tree while a show runs. Unmounting
	// (react, vue, angular, svelte) and `display: none` (vanilla) both satisfy
	// that; an opaque full-screen overlay with the editor still mounted behind it
	// does NOT, which is what Vue and Angular used to do: their inspector, slide
	// rail, notes pane and status bar stayed tab-focusable underneath the show,
	// so a keyboard or screen-reader user was walked through the whole editor
	// mid-presentation and could re-press the button that started the show.
	//
	// `visible` is the right test for all five: it is false both for a node that
	// was never rendered and for one hidden with `display: none`.
	await expect(page.locator('[data-pptx-inspector]').filter({ visible: true })).toHaveCount(0);

	// The ribbon, by its File tab. NOT by `role=toolbar` named "Presentation
	// toolbar": the show's own floating toolbar answers to that same name in
	// every binding (both read `pptx.toolbar.presentationToolbarAria`), so the
	// role would match show chrome as well as editor chrome.
	await expect(
		page.getByRole('tab', { name: 'File', exact: true }).filter({ visible: true }),
	).toHaveCount(0);

	// And the control that STARTED the show must not still be offering to start
	// it: this is the status bar / mobile top bar, which carry their own copy.
	await expect(
		page.getByRole('button', { name: /^present$|slide show/iu }).filter({ visible: true }),
	).toHaveCount(0);
});

test('PowerPoint navigation keys drive the show', async ({ page }) => {
	await startShow(page);

	const first = await visibleSlideText(page);
	expect(first).not.toBe('');

	// N advances (PowerPoint's primary "next"); it must not open presenter view.
	await page.keyboard.press('n');
	await page.waitForTimeout(900);
	const second = await visibleSlideText(page);
	expect(second).not.toBe(first);

	// P steps back.
	await page.keyboard.press('p');
	await page.waitForTimeout(900);
	expect(await visibleSlideText(page)).toBe(first);

	// End / Home jump to the last and first slides.
	await page.keyboard.press('End');
	await page.waitForTimeout(900);
	const last = await visibleSlideText(page);
	expect(last).not.toBe(first);

	await page.keyboard.press('Home');
	await page.waitForTimeout(900);
	expect(await visibleSlideText(page)).toBe(first);
});

test('a typed slide number jumps to that slide', async ({ page }) => {
	await startShow(page);
	const first = await visibleSlideText(page);

	await page.keyboard.press('End');
	await page.waitForTimeout(900);
	expect(await visibleSlideText(page)).not.toBe(first);

	// PowerPoint's "type a slide number, then Enter".
	await page.keyboard.press('1');
	await page.keyboard.press('Enter');
	await page.waitForTimeout(900);
	expect(await visibleSlideText(page)).toBe(first);
});
