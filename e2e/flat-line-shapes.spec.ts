/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * A `prstGeom line` with `cy="0"` or `cx="0"` must still be drawn.
 *
 * A zero-sized viewBox or `<svg>` box disables SVG rendering, so the stroke-only
 * outline of such a line must not get one.
 *
 * `flat-line-shapes.pptx` (generate-flat-line-shapes-fixture.ts) has a green
 * diagonal control line, a red horizontal line and a blue vertical line.
 * Each is checked by counting its stroke colour in a screenshot of the area
 * around it, since the DOM box of a flat line is legitimately zero on one axis.
 *
 * Run: bunx playwright test flat-line-shapes
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { fixture, loadDeck } from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

const DECK = fixture('flat-line-shapes.pptx');

/** Margin around the element box, so a stroke on a zero-height box is inside the clip. */
const PAD = 8;

/** Pixels within `tolerance` of `rgb` in a screenshot of the `index`th shape on the canvas. */
async function strokePixels(
	page: Page,
	index: number,
	rgb: [number, number, number],
	tolerance = 60,
): Promise<number> {
	const shape = page.locator(`[data-pptx-viewport] [data-element-id$="-shape-${index}"]`).first();
	await shape.waitFor({ state: 'attached' });
	const box = await shape.boundingBox();
	if (!box) {
		throw new Error(`shape ${index} has no bounding box`);
	}
	const png = await page.screenshot({
		clip: {
			x: box.x - PAD,
			y: box.y - PAD,
			width: box.width + PAD * 2,
			height: box.height + PAD * 2,
		},
	});
	// Decode in the page: a canvas does it without an image library.
	return page.evaluate(
		async ({ src, target, tol }) => {
			const img = new Image();
			img.src = src;
			await img.decode();
			const canvas = document.createElement('canvas');
			canvas.width = img.width;
			canvas.height = img.height;
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				return 0;
			}
			ctx.drawImage(img, 0, 0);
			const data = ctx.getImageData(0, 0, img.width, img.height).data;
			let count = 0;
			for (let i = 0; i < data.length; i += 4) {
				if (
					Math.abs(data[i] - target[0]) <= tol &&
					Math.abs(data[i + 1] - target[1]) <= tol &&
					Math.abs(data[i + 2] - target[2]) <= tol
				) {
					count += 1;
				}
			}
			return count;
		},
		{ src: `data:image/png;base64,${png.toString('base64')}`, target: rgb, tol: tolerance },
	);
}

test.describe('flat line shapes', () => {
	test('draws horizontal and vertical lines like the diagonal one', async ({ page }) => {
		await loadDeck(page, DECK);

		// Each line is hundreds of pixels long at any usable zoom; a missing
		// line leaves no pixel of its colour at all.
		expect(await strokePixels(page, 0, [0, 170, 0])).toBeGreaterThan(50);
		expect(await strokePixels(page, 1, [255, 0, 0])).toBeGreaterThan(50);
		expect(await strokePixels(page, 2, [0, 0, 255])).toBeGreaterThan(50);
	});
});
