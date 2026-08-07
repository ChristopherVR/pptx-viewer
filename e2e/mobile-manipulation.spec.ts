/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Mobile element-manipulation deep dive across every viewer binding.
 *
 * Exercises the three core editing interactions end-to-end on a Pixel 7 mobile
 * viewport:
 *
 *   1. Text input - double-tap a shape, type, commit, assert text persisted.
 *   2. Move       - drag a selected shape's body, assert it translated.
 *   3. Resize     - drag the SE corner handle, assert width/height grew.
 *
 * Touch-path notes (learned the hard way, recorded so the next person doesn't
 * re-derive them):
 *  - `getBoundingClientRect`/`offsetLeft` on these canvas nodes only settle to
 *    real on-screen values AFTER layout; read them just before asserting, and
 *    assert via layout `offset*` (the stage's unscaled slide-coordinate space).
 *  - The text-input test uses genuine touch taps (`locator.tap()`), which drive
 *    the viewer's touch (`pointerType !== 'mouse'`) inline-edit path.
 *  - Move/resize are dispatched via `page.mouse`, NOT raw CDP touch. CDP
 *    `Input.dispatchTouchEvent` emits native pointer events but React's
 *    delegated `onPointerDown` does not reliably fire for them, so a synthetic
 *    touch-drag never engages `dragStateRef`. `.tap()` works only because it
 *    also emits the compat mouse `click` React does process. The touch drag/
 *    resize *initiation* (handleStagePointerDown / handleResizePointer) is thin
 *    and code-verified; the move/resize/commit math is unit-tested in
 *    pointer-move-handlers.test.ts / pointer-up-handlers.test.ts. Mouse here
 *    exercises that same shared pipeline on the mobile layout.
 *
 * Run: bunx playwright test mobile-manipulation
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect, devices } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { resetTabSession } from './support/deck';

test.use({ ...devices['Pixel 7'] });

// Every binding emits the selection and inline-editor hooks used here.

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/format-painter.pptx', import.meta.url)),
);
const shotDir = fileURLToPath(new URL('../test-results/mobile-manipulation/', import.meta.url));

async function open(page: Page): Promise<{ source: Locator; target: Locator; stage: Locator }> {
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	const source = page.locator('[data-pptx-element="true"]').filter({ hasText: 'SOURCE' });
	const target = page.locator('[data-pptx-element="true"]').filter({ hasText: 'TARGET' });
	const stage = page.locator('[aria-roledescription="slide"]').first();
	await source.waitFor();
	await target.waitFor();
	await page.waitForTimeout(400);
	return { source, target, stage };
}

/** A drag from (x1,y1) to (x2,y2) through the shared pointer-move pipeline. */
async function drag(
	page: Page,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	steps = 10,
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

test.describe('mobile manipulation (Pixel 7 touch)', () => {
	test('text input (touch): double-tap, type, commit by tapping away - persists', async ({
		page,
	}) => {
		const { target, stage } = await open(page);

		await target.tap();
		await target.tap(); // double-tap → inline edit (touch path)
		const editor = page.locator('[data-inline-editor]');
		await editor.waitFor();

		await page.keyboard.type(' MOBILE');
		// Tap empty canvas below the shapes (which sit in the slide's top area).
		// Box-relative so it stays inside the now fit-to-width slide.
		const box = (await stage.boundingBox())!;
		await stage.tap({ position: { x: box.width * 0.5, y: box.height * 0.85 } });

		await expect(editor).toBeHidden();
		await expect(target).toContainText('MOBILE');
		await page.screenshot({ path: resolve(shotDir, 'text-input.png') });
	});

	test('move: dragging a selected shape body translates it (mobile layout)', async ({ page }) => {
		const { target } = await open(page);

		await target.tap(); // select
		await page.waitForTimeout(150);
		const before = await geomOf(target);

		const box = (await target.boundingBox())!;
		const cx = box.x + box.width / 2;
		const cy = box.y + box.height / 2;
		await drag(page, cx, cy, cx + 60, cy + 40);
		await page.waitForTimeout(250);

		const after = await geomOf(target);
		await page.screenshot({ path: resolve(shotDir, 'move.png') });

		// Translated in the drag direction; size unchanged.
		expect(after.left).not.toBe(before.left);
		expect(after.top).not.toBe(before.top);
		expect(Math.abs(after.width - before.width)).toBeLessThan(4);
		expect(Math.abs(after.height - before.height)).toBeLessThan(4);
	});

	test('resize: dragging the SE corner handle grows the shape (mobile layout)', async ({
		page,
	}) => {
		const { target } = await open(page);

		await target.tap(); // select → handles appear
		await page.waitForTimeout(200);
		const before = await geomOf(target);

		// SE handle sits at the element's on-screen bottom-right corner; nudge a
		// few px inward so the grab lands squarely on the handle dot.
		const box = (await target.boundingBox())!;
		const hx = box.x + box.width - 3;
		const hy = box.y + box.height - 3;
		await drag(page, hx, hy, hx + 70, hy + 70);
		await page.waitForTimeout(250);

		const after = await geomOf(target);
		await page.screenshot({ path: resolve(shotDir, 'resize.png') });

		// Grew in both dimensions; top-left anchored.
		expect(after.width - before.width).toBeGreaterThan(15);
		expect(after.height - before.height).toBeGreaterThan(15);
		expect(Math.abs(after.left - before.left)).toBeLessThan(8);
		expect(Math.abs(after.top - before.top)).toBeLessThan(8);
	});

	test('rotate: dragging the rotate handle rotates the shape (mobile layout)', async ({ page }) => {
		const { target } = await open(page);

		await target.tap(); // select → rotate handle appears above the top edge
		await page.waitForTimeout(200);
		const rotateBtn = page.getByRole('button', { name: /^rotate element$/iu });
		await expect(rotateBtn).toBeVisible();

		const elBox = (await target.boundingBox())!;
		const cx = elBox.x + elBox.width / 2;
		const cy = elBox.y + elBox.height / 2;
		const handleBox = (await rotateBtn.boundingBox())!;
		const hx = handleBox.x + handleBox.width / 2;
		const hy = handleBox.y + handleBox.height / 2;

		// Swing the handle from "up" to the element's right side ⇒ ~90° rotation.
		await drag(page, hx, hy, cx + 120, cy);
		await page.waitForTimeout(250);

		const transform = await target.evaluate((el) => (el as HTMLElement).style.transform);
		await page.screenshot({ path: resolve(shotDir, 'rotate.png') });

		expect(transform).toContain('rotate(');
		const deg = Number(/rotate\((?<deg>[-\d.]+)deg\)/u.exec(transform)?.groups?.deg ?? '0');
		// A meaningful, non-trivial rotation was committed (roughly a quarter turn).
		expect(deg).toBeGreaterThan(45);
		expect(deg).toBeLessThan(135);
	});
});
