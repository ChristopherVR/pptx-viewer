/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Live pen-tilt preview, run identically across every framework demo.
 *
 * While a pen/stylus stroke is still in progress (before `pointerup`), the
 * Draw tool's live preview must already show the SAME calligraphic tilt-nib
 * geometry (ellipses widened perpendicular to the lean direction) a
 * COMMITTED stroke gets, not a plain constant-width path that only gains its
 * lean once the stroke is released. Before the shared `buildLiveInkStrokeView`
 * decision function existed, every binding's Draw overlay built its live
 * preview from a hand-rolled polyline `d` string and stopped there, so the
 * calligraphic lean only ever appeared after `pointerup` committed the stroke
 * and it round-tripped through `buildInkGroupStrokes`.
 *
 * Framework-neutral by construction: `page.mouse` cannot express
 * `PointerEvent.tiltX`/`tiltY` at all, so this dispatches a real synthetic
 * `PointerEvent` at whatever element the browser reports as topmost at a
 * point inside the canvas viewport, rather than depending on a specific DOM
 * class name for the overlay (the five bindings do not share one, and one of
 * them - vanilla - had no live-preview overlay at all before this feature).
 * Asserting on `<ellipse>` (the tilt-nib shape every binding's renderer uses)
 * scoped to the neutral `[data-pptx-viewport]` locator is therefore the same
 * check regardless of which binding is under test.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { openRibbonTab, resetTabSession, viewport } from './support/deck';

async function newBlankPresentation(page: Page): Promise<void> {
	// Forget any restored session first, or the deck reopens straight into the
	// viewer and the landing page's "New Presentation" button never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page
		.getByRole('button', { name: /new presentation/iu })
		.first()
		.click();
	await expect(viewport(page)).toBeVisible();
}

interface TiltPointerInit {
	tiltX: number;
	tiltY: number;
}

/**
 * Dispatch a real `PointerEvent` (carrying `tiltX`/`tiltY`, which no
 * Playwright input API can express) at the browser's own topmost element for
 * a viewport-relative `(x, y)`, so it bubbles through whichever binding's own
 * pointerdown/pointermove listener actually owns the Draw-tool gesture.
 */
async function dispatchTiltPointer(
	page: Page,
	type: 'pointerdown' | 'pointermove' | 'pointerup',
	x: number,
	y: number,
	tilt: TiltPointerInit,
): Promise<void> {
	await page.evaluate(
		(args) => {
			const target = document.elementFromPoint(args.x, args.y);
			if (!target) {
				throw new Error(`no element at (${args.x}, ${args.y})`);
			}
			const event = new PointerEvent(args.type, {
				bubbles: true,
				cancelable: true,
				composed: true,
				pointerId: 1,
				pointerType: 'pen',
				clientX: args.x,
				clientY: args.y,
				// Held constant across both dispatches in every test below so a
				// pressure-circle decision (a DIFFERENT shape, `<circle>`, not
				// `<ellipse>`) can never be mistaken for the tilt-nib assertion.
				pressure: 0.5,
				tiltX: args.tiltX,
				tiltY: args.tiltY,
			});
			target.dispatchEvent(event);
		},
		{ type, x, y, tiltX: tilt.tiltX, tiltY: tilt.tiltY },
	);
}

async function armPenTool(page: Page): Promise<void> {
	await openRibbonTab(page, 'Draw');
	await page.getByRole('button', { name: 'Pen', exact: true }).click();
}

/** A horizontal start/end pair across the middle of the canvas viewport. */
async function strokeLine(page: Page): Promise<{ y: number; x0: number; x1: number }> {
	const box = (await viewport(page).boundingBox())!;
	return {
		y: box.y + box.height / 2,
		x0: box.x + box.width / 2 - 60,
		x1: box.x + box.width / 2 + 60,
	};
}

test.describe('Draw tool: live pen-tilt preview', () => {
	test('shows calligraphic nib ellipses while the stroke is still in progress, before pointerup', async ({
		page,
	}) => {
		await newBlankPresentation(page);
		await armPenTool(page);
		const { y, x0, x1 } = await strokeLine(page);

		await dispatchTiltPointer(page, 'pointerdown', x0, y, { tiltX: 0, tiltY: 0 });
		await dispatchTiltPointer(page, 'pointermove', x1, y, { tiltX: 45, tiltY: -20 });

		// Mid-gesture: no `pointerup` yet. The live preview must already have
		// decided on tilt-nib ellipses, not a plain path.
		await expect(viewport(page).locator('svg ellipse')).not.toHaveCount(0);

		await dispatchTiltPointer(page, 'pointerup', x1, y, { tiltX: 45, tiltY: -20 });

		// The committed stroke keeps the same calligraphic look (already fixed in
		// an earlier wave); this just confirms release does not lose it.
		await expect(viewport(page).locator('svg ellipse')).not.toHaveCount(0);
	});

	test('shows a plain path (no nib ellipses) for a stroke reporting no tilt', async ({ page }) => {
		await newBlankPresentation(page);
		await armPenTool(page);
		const { y, x0, x1 } = await strokeLine(page);

		await dispatchTiltPointer(page, 'pointerdown', x0, y, { tiltX: 0, tiltY: 0 });
		await dispatchTiltPointer(page, 'pointermove', x1, y, { tiltX: 0, tiltY: 0 });

		await expect(viewport(page).locator('svg ellipse')).toHaveCount(0);

		await dispatchTiltPointer(page, 'pointerup', x1, y, { tiltX: 0, tiltY: 0 });
		await expect(viewport(page).locator('svg ellipse')).toHaveCount(0);
	});
});
