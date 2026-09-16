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
import { readFile, writeFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import JSZip from 'jszip';

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
	test('selection controls keep their screen size as slide zoom changes', async ({ page }) => {
		const target = await openTarget(page);
		await select(page, target);
		const controls = viewport(page).getByRole('button', {
			name: /^(?:resize [nesw]{1,2}|rotate element)$/iu,
		});
		const sizes = () =>
			controls.evaluateAll((buttons) =>
				buttons.map((button) => {
					const { width, height } = button.getBoundingClientRect();
					return { width, height };
				}),
			);
		const before = await sizes();
		expect(before).toHaveLength(9);
		const initialWidth = (await target.boundingBox())!.width;
		for (let index = 0; index < 2; index++) {
			await page
				.getByRole('button', { name: /^zoom in$/iu })
				.first()
				.click();
		}
		await expect
			.poll(async () => (await target.boundingBox())!.width)
			.toBeGreaterThan(initialWidth * 1.1);
		for (const direction of ['in', 'out'] as const) {
			if (direction === 'out') {
				for (let index = 0; index < 3; index++) {
					await page
						.getByRole('button', { name: /^zoom out$/iu })
						.first()
						.click();
				}
				await expect
					.poll(async () => (await target.boundingBox())!.width)
					.toBeLessThan(initialWidth);
			}
			const after = await sizes();
			expect(after).toHaveLength(before.length);
			for (let index = 0; index < before.length; index++) {
				expect(Math.abs(after[index].width - before[index].width)).toBeLessThan(0.5);
				expect(Math.abs(after[index].height - before[index].height)).toBeLessThan(0.5);
			}
		}
	});

	test('corner controls remain centred on the shape corners', async ({ page }) => {
		const target = await openTarget(page);
		await select(page, target);
		const shape = (await target.boundingBox())!;

		for (const [handle, xFraction, yFraction] of [
			['nw', 0, 0],
			['ne', 1, 0],
			['sw', 0, 1],
			['se', 1, 1],
		] as const) {
			const control = viewport(page).getByRole('button', {
				name: new RegExp(`^resize ${handle}$`, 'iu'),
			});
			await expect(control).toBeVisible();
			const box = (await control.boundingBox())!;
			// A general button minimum size must not enlarge the hit box on only
			// one side of its visible dot, displacing its centre from the corner.
			expect(Math.abs(box.x + box.width / 2 - (shape.x + shape.width * xFraction))).toBeLessThan(2);
			expect(Math.abs(box.y + box.height / 2 - (shape.y + shape.height * yFraction))).toBeLessThan(
				2,
			);
		}
	});

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

test.describe('rotation keeps the initial grab offset', () => {
	for (const coarse of [false, true]) {
		test.describe(coarse ? 'coarse controls' : 'fine controls', () => {
			test.use({ hasTouch: coarse, viewport: { width: coarse ? 760 : 1440, height: 1000 } });
			for (const rotation of [0, 43, 359]) {
				test(`off-center grab on a ${rotation} degree short text box`, async ({
					page,
				}, testInfo) => {
					const zip = await JSZip.loadAsync(await readFile(SHAPES_DECK));
					const path = 'ppt/slides/slide1.xml';
					zip.file(
						path,
						(await zip.file(path)!.async('string')).replace(/<p:sp>[\s\S]*?<\/p:sp>/gu, (shape) =>
							shape.includes('>TARGET<')
								? shape
										.replace(/<a:xfrm\b[^>]*>/u, `<a:xfrm rot="${rotation * 60000}">`)
										.replace(/<a:off\b[^>]*>/u, `<a:off x="${350 * 9525}" y="${250 * 9525}">`)
										.replace(/<a:ext\b[^>]*>/u, `<a:ext cx="${350 * 9525}" cy="${32 * 9525}">`)
								: shape,
						),
					);
					const deck = testInfo.outputPath('rotate-grab.pptx');
					await writeFile(deck, await zip.generateAsync({ type: 'nodebuffer' }));
					await loadDeck(page, deck);
					const target = slideElements(page).filter({ hasText: 'TARGET' }).first();
					const knob = viewport(page)
						.getByRole('button', { name: /^rotate element$/iu })
						.first();
					const angle = () =>
						target.evaluate((element) => {
							const matrix = new DOMMatrix(getComputedStyle(element).transform);
							return ((Math.atan2(matrix.b, matrix.a) * 180) / Math.PI + 360) % 360;
						});
					const expectAngle = async (expected: number) => {
						await expect
							.poll(async () => Math.abs((((await angle()) - expected + 540) % 360) - 180))
							.toBeLessThan(1.5);
					};
					// Compact layouts do not all expose toolbar zoom controls.
					for (const zoom of coarse ? ['fit'] : ['fit', 'in', 'out']) {
						if (zoom !== 'fit') {
							await page
								.getByRole('button', { name: zoom === 'in' ? /^zoom in$/iu : /^zoom out$/iu })
								.first()
								.click();
							if (zoom === 'out') {
								// Undo the zoom-in step, then exercise a scale below fit.
								await page
									.getByRole('button', { name: /^zoom out$/iu })
									.first()
									.click();
							}
							await page.waitForTimeout(150);
						}
						// Undo may clear selection; reselect before measuring the next zoom.
						if (!(await knob.isVisible())) {
							await select(page, target);
						}
						const shape = (await target.boundingBox())!;
						const control = (await knob.boundingBox())!;
						const center = { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
						const start = {
							x: control.x + control.width / 2 + Math.min(5, control.width / 4),
							y: control.y + control.height / 2,
						};
						const ownsPress = await knob.evaluate(
							(button, point) =>
								document.elementFromPoint(point.x, point.y)?.closest('button') === button,
							start,
						);
						expect(ownsPress).toBe(true);
						// An off-center tap is not a rotation gesture.
						await page.mouse.click(start.x, start.y);
						await expectAngle(rotation);
						const end = { x: start.x + 8, y: start.y + 4 };
						const delta =
							((Math.atan2(end.y - center.y, end.x - center.x) -
								Math.atan2(start.y - center.y, start.x - center.x)) *
								180) /
							Math.PI;
						const expected = (((rotation + delta) % 360) + 360) % 360;
						await page.mouse.move(start.x, start.y);
						await page.mouse.down();
						await page.mouse.move(end.x, end.y);
						await expectAngle(expected);
						await page.mouse.up();
						await expectAngle(expected);
						await page
							.getByRole('button', { name: /^undo$/iu })
							.first()
							.click();
						await expectAngle(rotation);
					}
				});
			}
		});
	}
});
