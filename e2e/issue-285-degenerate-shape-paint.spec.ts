/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Issue #285: the element wrapper clamped width/height to a 12px minimum "so
 * a degenerate shape stays selectable", applied unconditionally including in
 * read-only rendering. A solid fill paints as the wrapper's own
 * `background-color`, so a 1-pt horizontal rule (~1.33px tall) painted as a
 * 12-15px solid bar instead of a hairline.
 *
 * The fix keeps the painted box at the element's authored size always
 * (verified here as an aspect-ratio invariant, so the assertion holds at
 * whatever zoom level the canvas happens to be at) and moves grabbability
 * padding to a separate, interaction-only `[data-pptx-hit-target]` overlay
 * that every binding renders as an extra child of the shape wrapper.
 *
 * Run: bunx playwright test issue-285-degenerate-shape-paint
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { inspector, resetTabSession } from './support/deck';

const FIXTURE = resolve(
	fileURLToPath(new URL('./fixtures/degenerate-shape.pptx', import.meta.url)),
);

/** The degenerate rule (500pt wide, 1pt tall), authored first on the slide. */
function ruleOnCanvas(page: Page) {
	return page.locator('[data-pptx-viewport] [data-element-id$="-shape-0"]').first();
}

/** The ordinary-proportioned control shape, authored second. */
function wideNormalOnCanvas(page: Page) {
	return page.locator('[data-pptx-viewport] [data-element-id$="-shape-1"]').first();
}

async function loadFixture(page: Page): Promise<void> {
	await page.setViewportSize({ width: 1500, height: 1000 });
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(FIXTURE);
	await ruleOnCanvas(page).waitFor();
}

test.describe('degenerate shape paint (issue #285)', () => {
	test('paints the rule at its authored aspect ratio, never padded into a bar', async ({
		page,
	}) => {
		await loadFixture(page);

		const ruleBox = await ruleOnCanvas(page).boundingBox();
		const controlBox = await wideNormalOnCanvas(page).boundingBox();
		if (!ruleBox || !controlBox) {
			throw new Error('a fixture shape has no bounding box');
		}

		// Authored aspect ratio is 500:1 for the rule and 500:120 (~4.17:1) for
		// the control, whatever the canvas zoom happens to be (a uniform scale
		// preserves the ratio). The old bug clamped the rule's painted height to
		// a 12px floor while its width kept scaling with zoom, so the ratio
		// collapsed toward the control's own ratio (or below it) instead of
		// staying two orders of magnitude more elongated.
		const ruleRatio = ruleBox.width / ruleBox.height;
		const controlRatio = controlBox.width / controlBox.height;
		expect(ruleRatio).toBeGreaterThan(controlRatio * 20);
		// A generous absolute floor too, independent of the control shape.
		expect(ruleRatio).toBeGreaterThan(100);
	});

	test('stays selectable via a hit target that extends past the thin painted box', async ({
		page,
	}) => {
		await loadFixture(page);

		const hitTarget = ruleOnCanvas(page).locator('[data-pptx-hit-target]');
		const ruleBox = await ruleOnCanvas(page).boundingBox();
		const hitBox = await hitTarget.boundingBox();
		if (!ruleBox || !hitBox) {
			throw new Error('the rule or its hit target has no bounding box');
		}

		// The hit target must be visibly bigger than the (now correctly thin)
		// painted box in the degenerate axis, and centred over it.
		expect(hitBox.height).toBeGreaterThan(ruleBox.height * 2);

		// Click 2px inside the hit target's own top edge: inside its rendered
		// area, but above the rule's own (thin) box, which native focus/click
		// event bubbling reaches only via the hit target.
		const x = hitBox.x + hitBox.width / 2;
		const y = hitBox.y + 2;
		expect(y).toBeLessThan(ruleBox.y);
		await page.mouse.click(x, y);

		await expect(inspector(page)).toBeVisible();
	});
});
