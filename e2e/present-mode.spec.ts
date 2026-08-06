/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Slide-show behaviour every binding must share (issue #106).
 *
 * The show used to inherit editing rules in the React binding: the editor's fit
 * scale is capped at 1 so a slide never zooms past 100% while you edit, which
 * left a 1280x720 deck at native size on a larger display and made the
 * transition overlay (which fitted the whole canvas area) play at a different
 * size from the slide underneath it. These lock in the corrected behaviour and
 * PowerPoint's navigation keys.
 */

const deck = resolve(fileURLToPath(new URL('./fixtures/sample-deck.pptx', import.meta.url)));

/** Load the fixture and start the slide show. */
async function startShow(page: Page): Promise<void> {
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
 * "which slide is showing" probe (slide counters differ per binding, and deck
 * text can contain "n / m" strings of its own).
 *
 * The show stage is found by the shared `data-pptx-presenting` marker that
 * every binding's presenting stage carries (stamped by
 * `applyRenderedElementAccessibility`, or directly where a binding renders its
 * accessibility in the view layer). Reading ONLY the marker is the contract:
 * the still-mounted editor canvas and the thumbnails mirror the active slide
 * index, so a looser probe could read those and pass without a show at all.
 */
async function visibleSlideText(page: Page): Promise<string> {
	return page.evaluate(() => {
		const stage = [...document.querySelectorAll('[data-pptx-presenting]')]
			.filter((node) => node.getBoundingClientRect().width > 200)
			.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
		return stage ? (stage.textContent ?? '').replace(/\s+/gu, ' ').trim().slice(0, 40) : '';
	});
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
