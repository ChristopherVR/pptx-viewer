/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * What a CLICK means during a running slide show, run identically against every
 * framework demo.
 *
 * The reporter's deck (`e2e/fixtures/solution-explorer.pptx`) is driven
 * entirely from the slide: a wheel of eight `ppaction://hlinksldjump` slices
 * (plus eight matching labels and an "Explore solution" button) each jump to
 * their own slide, and slides 3-14 carry a `<p159:morph/>` transition that
 * sweeps a red arrow round the hub to the newly selected slice.
 *
 * Three distinct defects made that unusable, all pinned here:
 *
 *  1. Only React had an element-level action handler at all, so in Vue,
 *     Angular, Vanilla and Svelte a click on a slice ADVANCED the show by one
 *     slide instead of jumping to the slice's own slide.
 *  2. Only React made a running show's scenery pointer-transparent. The deck
 *     paints a 675px decorative ring OVER the eight slices, so in the other
 *     four the ring swallowed every click and the slices could not be hit even
 *     once the handler existed.
 *  3. Angular's `goToSlide` (which zoom tiles and now action jumps use)
 *     committed without a transition, so a jump cut straight to the target and
 *     the arrow teleported instead of travelling.
 *
 * Everything is asserted on the framework-neutral contract (`#file-input`,
 * `[data-element-id]`, `[aria-roledescription="slide"]`), so the same spec runs
 * against all five demos.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/solution-explorer.pptx', import.meta.url)),
);

/** The deck is 5 MB with a real video; give the initial parse room on CI. */
const LOAD_TIMEOUT_MS = 60_000;

/**
 * 1-based slide the show is on, read off the `ppt/slides/slideN.xml-…` element
 * ids of the largest painted stage. Slide counters differ per binding; element
 * ids do not.
 */
async function visibleSlideNumber(page: Page): Promise<number> {
	return page.evaluate(() => {
		const stages = [...document.querySelectorAll('[aria-roledescription="slide"]')]
			.filter((node) => node.getBoundingClientRect().width > 300)
			.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width);
		for (const stage of stages) {
			const tally = new Map<number, number>();
			for (const node of stage.querySelectorAll('[data-element-id]')) {
				const match = (node.getAttribute('data-element-id') ?? '').match(/slide(\d+)\.xml/u);
				if (match) {
					tally.set(Number(match[1]), (tally.get(Number(match[1])) ?? 0) + 1);
				}
			}
			const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
			if (top) {
				return top[0];
			}
		}
		return 0;
	});
}

/** Load the deck, park on slide 3 (the first morph slide), start the show. */
async function startShowOnWheel(page: Page): Promise<void> {
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[aria-label="Go to slide 14"]').first().waitFor({ timeout: LOAD_TIMEOUT_MS });
	await page.waitForTimeout(1200);
	await page.locator('[aria-label="Go to slide 3"]').first().click();
	await page.waitForTimeout(700);
	await page
		.getByRole('button', { name: /^present$|slide show/iu })
		.first()
		.click();
	await page.waitForTimeout(1600);
}

/** Click the centre of a rendered element on the topmost (show) stage. */
async function clickElement(page: Page, elementId: string): Promise<void> {
	const box = await page.locator(`[data-element-id="${elementId}"]`).last().boundingBox();
	expect(box, `${elementId} is rendered`).not.toBeNull();
	await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
}

test.describe('slide-show action clicks', () => {
	test('a wheel slice jumps to ITS slide instead of advancing the show', async ({ page }) => {
		await startShowOnWheel(page);
		expect(await visibleSlideNumber(page)).toBe(3);

		// "Free-form: Shape 174" carries `ppaction://hlinksldjump` -> slide9.xml.
		// Advancing would land on slide 4, which is what every non-React binding
		// used to do.
		await clickElement(page, 'ppt/slides/slide3.xml-shape-4');
		await expect
			.poll(async () => visibleSlideNumber(page), {
				message: 'the slice jumps to its own slide',
				timeout: 8000,
			})
			.toBe(9);
	});

	test('a slice label and the centre button follow their own links', async ({ page }) => {
		await startShowOnWheel(page);
		// "TextBox 206" -> slide4.xml.
		await clickElement(page, 'ppt/slides/slide3.xml-shape-20');
		await expect.poll(async () => visibleSlideNumber(page), { timeout: 8000 }).toBe(4);

		await startShowOnWheel(page);
		// "Rectangle 4" ("Explore solution") -> slide12.xml.
		await clickElement(page, 'ppt/slides/slide3.xml-shape-26');
		await expect.poll(async () => visibleSlideNumber(page), { timeout: 8000 }).toBe(12);
	});

	test('the decorative ring over the wheel does not swallow the click', async ({ page }) => {
		await startShowOnWheel(page);

		// The 675px "Graphic 23" ring is painted above the eight slices. In a
		// running show only action shapes take the pointer, so hit-testing the
		// slice's centre must reach the SLICE, not the ring.
		const hit = await page.evaluate(() => {
			// The LAST match is the show's stage: a binding that keeps its editor
			// canvas mounted underneath renders the same element id twice.
			const matches = [
				...document.querySelectorAll('[data-element-id="ppt/slides/slide3.xml-shape-4"]'),
			];
			const slice = matches[matches.length - 1];
			if (!slice) {
				return 'missing';
			}
			const box = slice.getBoundingClientRect();
			const node = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
			return node?.closest('[data-pptx-action]')?.getAttribute('data-element-id') ?? 'none';
		});
		expect(hit, 'an action shape is on top at the slice centre').not.toBe('none');
	});

	test('an action jump plays the target slide’s morph transition', async ({ page }) => {
		await startShowOnWheel(page);
		await clickElement(page, 'ppt/slides/slide3.xml-shape-4');

		// The ring is the same picture on both slides, rotated 45deg per step, so
		// the morph rotates it. A jump that skipped the transition cut straight to
		// the final angle and the arrow teleported.
		await expect
			.poll(
				async () =>
					page.evaluate(
						() =>
							[...document.querySelectorAll<HTMLElement>('[data-element-id]')].filter((node) =>
								getComputedStyle(node).animationName.includes('pptx-morph'),
							).length,
					),
				{ message: 'the jump animates with per-element morph keyframes', timeout: 8000 },
			)
			.toBeGreaterThan(0);
	});

	test('a click on inert slide content still advances the show', async ({ page }) => {
		await startShowOnWheel(page);
		// A far corner of the stage carries only the background picture.
		await page.mouse.click(60, 700);
		await expect
			.poll(async () => visibleSlideNumber(page), {
				message: 'click-to-advance still works on scenery',
				timeout: 8000,
			})
			.toBe(4);
	});

	test('a slide authored advClick="0" advTm still advances on its timer', async ({ page }) => {
		await page.goto('/');
		await page.locator('#file-input').setInputFiles(fixturePath);
		await page
			.locator('[aria-label="Go to slide 14"]')
			.first()
			.waitFor({ timeout: LOAD_TIMEOUT_MS });
		await page.waitForTimeout(1200);
		await page.locator('[aria-label="Go to slide 1"]').first().click();
		await page.waitForTimeout(600);
		await page
			.getByRole('button', { name: /^present$|slide show/iu })
			.first()
			.click();

		// Slide 1 is `advClick="0" advTm="10"`: a click must NOT advance it, but
		// the 10 ms timer must, so the show never sits there unresponsive.
		await expect
			.poll(async () => visibleSlideNumber(page), {
				message: 'the authored 10 ms timing advances the slide',
				timeout: 8000,
			})
			.toBe(2);
	});
});
