/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const fixturePath = resolve(fileURLToPath(new URL('./fixtures/sample-deck.pptx', import.meta.url)));

/**
 * Text-rendering parity, run identically against every framework demo.
 *
 * PowerPoint font sizes are authored as a px value in the parsed model, and the
 * viewers render them as a unitless CSS `px` size. A binding that instead emits
 * `Npt` inflates every glyph by ~1.33× (96/72), which overflows text boxes and
 * breaks visual parity with the reference React renderer (e.g. the title's two
 * lines overlapping the subtitle on slide 1 of the sample deck).
 *
 * These assertions read the *computed* font size off the neutral
 * `[data-pptx-element="true"]` DOM contract, so they are framework-agnostic and
 * catch any reintroduction of the pt/px inflation in React, Vue, or Angular.
 *
 * Reference sizes are taken from the React renderer (the source of truth) for
 * `sample-deck.pptx` slide 1.
 */

/** Upload the sample deck and wait for slide 1's title to render. */
async function openDeck(page: Page): Promise<void> {
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[data-pptx-element="true"]').filter({ hasText: 'Project' }).first().waitFor();
}

/**
 * Largest computed font-size (in px) among the text-bearing descendants of the
 * `[data-pptx-element]` whose text contains `needle`. Reads only neutral DOM, so
 * it works against any framework binding.
 */
async function largestFontPx(page: Page, needle: string): Promise<number> {
	return page.evaluate((text) => {
		const el = [...document.querySelectorAll('[data-pptx-element="true"]')].find((e) =>
			e.textContent?.includes(text),
		);
		if (!el) {
			throw new Error(`no slide element containing "${text}"`);
		}
		let max = 0;
		for (const node of el.querySelectorAll('*')) {
			const hasOwnText = [...node.childNodes].some(
				(c) => c.nodeType === Node.TEXT_NODE && c.textContent?.trim(),
			);
			if (hasOwnText) {
				const fs = Number.parseFloat(getComputedStyle(node).fontSize);
				if (fs > max) {
					max = fs;
				}
			}
		}
		return max;
	}, needle);
}

test.describe('text rendering (font-size parity)', () => {
	test('renders authored px font sizes without pt inflation', async ({ page }) => {
		await openDeck(page);

		// 54pt-as-px title. The pt-inflation bug rendered this at 72px.
		expect(await largestFontPx(page, 'Project')).toBeCloseTo(54, 0);
		// Subtitle + caption confirm the whole text scale (not just the title) is
		// in px — an inflated binding would scale all three up by 96/72.
		expect(await largestFontPx(page, 'Product Overview')).toBeCloseTo(20, 0);
		expect(await largestFontPx(page, 'Q2 2026')).toBeCloseTo(16, 0);
	});

	test('multi-line title fits within its text box (no overflow)', async ({ page }) => {
		await openDeck(page);

		// The title is a two-line block ("Project" / "Atlas"). With correct px
		// sizing + line spacing it fits its authored box; the inflation bug pushed
		// the second line out of the box and over the subtitle.
		const overflow = await page.evaluate(() => {
			const el = [...document.querySelectorAll('[data-pptx-element="true"]')].find((e) =>
				e.textContent?.includes('Project'),
			);
			if (!el) {
				throw new Error('no title element');
			}
			// The text block is the deepest element that fills the box and clips
			// overflow; compare its scroll vs client height directly.
			let worst = 0;
			for (const node of [el, ...el.querySelectorAll('*')]) {
				const over = (node as HTMLElement).scrollHeight - (node as HTMLElement).clientHeight;
				if ((node as HTMLElement).clientHeight > 0 && over > worst) {
					worst = over;
				}
			}
			return worst;
		});
		// Allow a couple of px for sub-pixel rounding / descenders.
		expect(overflow).toBeLessThanOrEqual(4);
	});
});
