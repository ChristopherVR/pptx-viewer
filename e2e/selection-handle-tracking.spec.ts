/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * The selection handles must follow the shape DURING a gesture, not only once
 * it is committed on pointer-up.
 *
 * A binding that previews a drag or resize by writing the element's inline
 * style directly (React does, for frame-rate) has to mirror the same values
 * onto its handle overlay, or the handles sit at the old box until release
 * while the shape moves underneath them. PR #199 fixed exactly that lag in
 * React; this spec pins the contract for all five bindings by measuring the
 * rotate knob, which every binding centres above the shape's top edge, while
 * the mouse button is still held down.
 *
 * Contract notes:
 *  - The knob is found by its unified accessible name "Rotate element"
 *    (`pptx.selectionOverlay.rotate`), scoped to the viewport like
 *    `desktop-manipulation` does.
 *  - The mid-gesture assertion compares SCREEN boxes (`boundingBox`), which is
 *    what the user sees, and tolerates a few pixels: knob sizes differ per
 *    binding, and its centre is what must ride on the shape's centre line.
 *
 * Run: bunx playwright test selection-handle-tracking
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { fixture, loadDeck, slideElements, viewport } from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

const SHAPES_DECK = fixture('format-painter.pptx');

/** How far the knob's centre may sit from the shape's centre line, in screen px. */
const ALIGN_TOLERANCE = 6;

async function openTarget(page: Page): Promise<Locator> {
	await loadDeck(page, SHAPES_DECK);
	const target = slideElements(page).filter({ hasText: 'TARGET' }).first();
	await target.waitFor();
	await page.waitForTimeout(400);
	return target;
}

async function select(page: Page, target: Locator): Promise<Locator> {
	const box = (await target.boundingBox())!;
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	await page.waitForTimeout(250);
	const knob = viewport(page)
		.getByRole('button', { name: /^rotate element$/iu })
		.first();
	await expect(knob).toBeVisible();
	return knob;
}

/** Press at (x1,y1) and move to (x2,y2) in steps WITHOUT releasing. */
async function dragHold(page: Page, x1: number, y1: number, x2: number, y2: number): Promise<void> {
	const steps = 10;
	await page.mouse.move(x1, y1);
	await page.mouse.down();
	for (let i = 1; i <= steps; i++) {
		await page.mouse.move(
			Math.round(x1 + ((x2 - x1) * i) / steps),
			Math.round(y1 + ((y2 - y1) * i) / steps),
		);
	}
	// Let the binding paint the preview frame before measuring.
	await page.waitForTimeout(150);
}

/** Assert the knob sits centred above the shape's CURRENT screen box. */
async function expectKnobOnShape(knob: Locator, target: Locator, what: string): Promise<void> {
	const shape = (await target.boundingBox())!;
	const knobBox = (await knob.boundingBox())!;
	const knobCx = knobBox.x + knobBox.width / 2;
	const shapeCx = shape.x + shape.width / 2;
	expect(
		Math.abs(knobCx - shapeCx),
		`${what}: the rotate knob must stay on the shape's centre line (knob ${knobCx.toFixed(1)} vs shape ${shapeCx.toFixed(1)})`,
	).toBeLessThan(ALIGN_TOLERANCE);
	expect(
		knobBox.y + knobBox.height / 2,
		`${what}: the rotate knob must sit above the shape, not inside its old box`,
	).toBeLessThan(shape.y + ALIGN_TOLERANCE);
}

test.describe('selection handles track the live gesture', () => {
	test('the handles ride along with a body drag before pointer-up', async ({ page }) => {
		const target = await openTarget(page);
		const knob = await select(page, target);
		await expectKnobOnShape(knob, target, 'at rest');

		const before = (await target.boundingBox())!;
		const cx = before.x + before.width / 2;
		const cy = before.y + before.height / 2;
		await dragHold(page, cx, cy, cx + 120, cy + 60);

		const during = (await target.boundingBox())!;
		expect(during.x - before.x, 'the shape itself must preview the drag').toBeGreaterThan(60);
		await expectKnobOnShape(knob, target, 'mid-drag');

		await page.mouse.up();
		await page.waitForTimeout(250);
		await expectKnobOnShape(knob, target, 'after commit');
	});

	test('the handles follow a corner resize before pointer-up', async ({ page }) => {
		const target = await openTarget(page);
		const knob = await select(page, target);

		const before = (await target.boundingBox())!;
		// 3px inside the bottom-right corner sits inside every binding's SE
		// handle hit area (see desktop-manipulation).
		const hx = before.x + before.width - 3;
		const hy = before.y + before.height - 3;
		await dragHold(page, hx, hy, hx + 140, hy + 40);

		const during = (await target.boundingBox())!;
		expect(during.width - before.width, 'the shape itself must preview the resize').toBeGreaterThan(
			60,
		);
		// A wider shape has a new centre line; the knob must have moved to it.
		await expectKnobOnShape(knob, target, 'mid-resize');

		await page.mouse.up();
		await page.waitForTimeout(250);
		await expectKnobOnShape(knob, target, 'after commit');
	});
});
