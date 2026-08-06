/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Desktop element-manipulation deep dive across every viewer binding.
 *
 * The resize/rotate/inline-edit/table-cell interactions were previously
 * e2e-covered only under mobile emulation (mobile-manipulation, mobile-table);
 * this spec drives the same shared pipeline with a real desktop mouse:
 *
 *   1. Resize - drag the SE corner handle, assert the committed box, Ctrl+Z.
 *   2. Rotate - drag the rotate knob a quarter turn, assert the committed
 *      `rotate(...)` transform, Ctrl+Z.
 *   3. Inline text edit - dblclick, type, commit by clicking empty canvas,
 *      assert it persists across selection changes.
 *   4. Table cell edit - dblclick a cell on the table slide, type, commit by
 *      clicking outside.
 *
 * Contract notes (all verified against every binding):
 *  - Geometry is asserted in layout `offset*` coordinates (the stage's
 *    unscaled slide space), read just before asserting, like the mobile spec.
 *  - The SE handle is grabbed 3px INSIDE the element's bottom-right corner:
 *    every binding centres a >= 10 screen-px handle on the corner (Vue sizes
 *    its handles against the inverse stage zoom so they no longer shrink with
 *    it), so corner-3px sits inside all five hit areas.
 *  - The rotate knob is found by its unified accessible name "Rotate element"
 *    (`pptx.selectionOverlay.rotate`, the shared contract all five bindings
 *    use), scoped to the viewport so ribbon controls can never shadow it.
 *  - Inline-edit asserts the typed text is APPENDED (caret at the END of the
 *    seeded text): all five bindings share `placeCaretAtEnd` (or Angular's
 *    textarea `setSelectionRange(end, end)`), so "TARGET" + typed " DESKTOP"
 *    must commit as "TARGET DESKTOP", never " DESKTOPTARGET".
 *
 * Run: bunx playwright test desktop-manipulation
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { goToSlide } from './support/context-menu';
import {
	fixture,
	loadDeck,
	SAMPLE_DECK,
	slideElements,
	slideStage,
	viewport,
} from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

const SHAPES_DECK = fixture('format-painter.pptx');
const TABLE_SLIDE = 5;
const TABLE_CELL_TEXT = 'Starter';

/** Load the two-shape fixture and return its SOURCE/TARGET text boxes. */
async function openShapes(page: Page): Promise<{ source: Locator; target: Locator }> {
	await loadDeck(page, SHAPES_DECK);
	const source = slideElements(page).filter({ hasText: 'SOURCE' }).first();
	const target = slideElements(page).filter({ hasText: 'TARGET' }).first();
	await source.waitFor();
	await target.waitFor();
	await page.waitForTimeout(400);
	return { source, target };
}

/** A mouse drag from (x1,y1) to (x2,y2) through the shared pointer pipeline. */
async function drag(
	page: Page,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	steps = 12,
): Promise<void> {
	await page.mouse.move(x1, y1);
	await page.mouse.down();
	for (let i = 1; i <= steps; i++) {
		await page.mouse.move(
			Math.round(x1 + ((x2 - x1) * i) / steps),
			Math.round(y1 + ((y2 - y1) * i) / steps),
		);
	}
	await page.mouse.up();
}

/** Layout geometry in the stage's unscaled slide-coordinate space. */
function geomOf(locator: Locator) {
	return locator.evaluate((el) => {
		const e = el as HTMLElement;
		return { left: e.offsetLeft, top: e.offsetTop, width: e.offsetWidth, height: e.offsetHeight };
	});
}

/** Select `target` with a single click on its centre. */
async function select(page: Page, target: Locator): Promise<void> {
	const box = (await target.boundingBox())!;
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	await page.waitForTimeout(250);
}

/** The committed inline rotation in degrees, or null when none is applied. */
async function rotationOf(target: Locator): Promise<number | null> {
	const transform = await target.evaluate((el) => (el as HTMLElement).style.transform);
	const match = /rotate\((?<deg>[-\d.]+)deg\)/u.exec(transform);
	return match?.groups?.deg === undefined ? null : Number(match.groups.deg);
}

test.describe('desktop manipulation (mouse)', () => {
	test('resize: dragging the SE corner handle grows the shape, Ctrl+Z restores it', async ({
		page,
	}) => {
		const { target } = await openShapes(page);

		await select(page, target);
		const before = await geomOf(target);

		// Grab 3px inside the bottom-right corner (see file header) and pull
		// out by 70 screen px on both axes.
		const box = (await target.boundingBox())!;
		const hx = box.x + box.width - 3;
		const hy = box.y + box.height - 3;
		await drag(page, hx, hy, hx + 70, hy + 70);
		await page.waitForTimeout(300);

		const after = await geomOf(target);
		// Grew substantially on both axes (70 screen px is >30 layout px at any
		// fit-to-window zoom of this deck), top-left anchored, and it RESIZED
		// rather than moved.
		expect(after.width - before.width).toBeGreaterThan(30);
		expect(after.height - before.height).toBeGreaterThan(30);
		expect(Math.abs(after.left - before.left)).toBeLessThan(8);
		expect(Math.abs(after.top - before.top)).toBeLessThan(8);

		await page.keyboard.press('Control+z');
		await expect
			.poll(async () => Math.abs((await geomOf(target)).width - before.width))
			.toBeLessThan(2);
		await expect
			.poll(async () => Math.abs((await geomOf(target)).height - before.height))
			.toBeLessThan(2);
		expect(Math.abs((await geomOf(target)).left - before.left)).toBeLessThan(2);
		expect(Math.abs((await geomOf(target)).top - before.top)).toBeLessThan(2);
	});

	test('rotate: dragging the rotate handle commits a rotation, Ctrl+Z removes it', async ({
		page,
	}) => {
		const { target } = await openShapes(page);

		await select(page, target);
		expect(await rotationOf(target)).toBeNull();

		// The unified accessible name (shared `pptx.selectionOverlay.rotate`);
		// scoping to the viewport keeps ribbon controls out.
		const knob = viewport(page)
			.getByRole('button', { name: /^rotate element$/iu })
			.first();
		await expect(knob).toBeVisible();

		const elBox = (await target.boundingBox())!;
		const cx = elBox.x + elBox.width / 2;
		const cy = elBox.y + elBox.height / 2;
		const knobBox = (await knob.boundingBox())!;

		// Swing the knob from "up" to the element's right side: ~90 degrees.
		await drag(page, knobBox.x + knobBox.width / 2, knobBox.y + knobBox.height / 2, cx + 140, cy);
		await page.waitForTimeout(300);

		const deg = await rotationOf(target);
		expect(deg).not.toBeNull();
		expect(deg!).toBeGreaterThan(45);
		expect(deg!).toBeLessThan(135);

		await page.keyboard.press('Control+z');
		// Undone: either the inline transform is gone or it is back to 0deg.
		await expect
			.poll(async () => {
				const undone = await rotationOf(target);
				return undone === null || Math.abs(undone) < 1;
			})
			.toBe(true);
	});

	test('inline text edit: dblclick, type, commit on empty canvas, persists', async ({ page }) => {
		const { source, target } = await openShapes(page);

		const box = (await target.boundingBox())!;
		await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
		const editor = page.locator('[data-inline-editor]');
		await editor.waitFor();

		await page.keyboard.type(' DESKTOP');
		// Commit by clicking an empty canvas region below the shapes (they sit
		// in the slide's top area). Box-relative so it stays inside the slide.
		const stageBox = (await slideStage(page).boundingBox())!;
		await page.mouse.click(stageBox.x + stageBox.width * 0.5, stageBox.y + stageBox.height * 0.9);

		await expect(editor).toBeHidden();
		// Caret-at-end contract: the typed text is APPENDED after the seed text.
		await expect(target).toContainText('TARGET DESKTOP');

		// Persists across selection changes: select the other shape, then
		// deselect on empty canvas, and the committed text must survive both.
		await select(page, source);
		await expect(target).toContainText('DESKTOP');
		await page.mouse.click(stageBox.x + stageBox.width * 0.5, stageBox.y + stageBox.height * 0.9);
		await page.waitForTimeout(250);
		await expect(target).toContainText('DESKTOP');
	});

	test('table cell edit: dblclick a cell, type, commit by clicking outside', async ({ page }) => {
		await loadDeck(page, SAMPLE_DECK);
		await goToSlide(page, TABLE_SLIDE);

		const cell = viewport(page).locator('td').filter({ hasText: TABLE_CELL_TEXT }).first();
		await cell.waitFor();
		const cellBox = (await cell.boundingBox())!;
		await page.mouse.dblclick(cellBox.x + cellBox.width / 2, cellBox.y + cellBox.height / 2);

		const input = page.locator('td input[type="text"]');
		await expect(input).toBeVisible();

		// The cell editor auto-selects its text, so typing replaces it.
		await page.keyboard.type('Freebie');
		// Commit by clicking OUTSIDE the table, on an empty slide region.
		const stageBox = (await slideStage(page).boundingBox())!;
		await page.mouse.click(stageBox.x + stageBox.width * 0.9, stageBox.y + stageBox.height * 0.95);

		await expect(input).toBeHidden();
		await expect(viewport(page).locator('td').filter({ hasText: 'Freebie' }).first()).toBeVisible();
	});
});
