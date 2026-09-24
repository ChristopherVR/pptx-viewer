/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Draw-tab highlighter blend mode, run identically across every framework
 * demo.
 *
 * A real highlighter darkens wherever two strokes cross, because the marker
 * ink itself is translucent and multiplies against whatever is underneath it
 * (including another highlighter stroke). Two of the five bindings (Svelte,
 * vanilla) used to fake this with `mix-blend-mode: multiply` on the WHOLE
 * per-element `<svg>` container, keyed off `inkTool === 'highlighter'`. That
 * composites the element's already-flattened output against the page
 * backdrop exactly once; it does nothing for two strokes sharing that same
 * container; they still plain alpha-composite against each other, so
 * crossing highlighter strokes never actually darkened where they overlapped.
 *
 * The fix moves `mix-blend-mode` onto each stroke's OWN paint element (the
 * shared `InkStrokeView.blendMode` field, `packages/shared/src/render/
 * ink-stroke-view.ts`), so this spec asserts the blend mode lives on the
 * per-stroke shape, not on the ink element's outer `<svg>`.
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

async function armHighlighterTool(page: Page): Promise<void> {
	await openRibbonTab(page, 'Draw');
	await page.getByRole('button', { name: 'Highlighter', exact: true }).click();
}

/** Draw one straight mouse-dragged stroke from `(x0, y)` to `(x1, y)`. */
async function drawHorizontalStroke(page: Page, y: number, x0: number, x1: number): Promise<void> {
	await page.mouse.move(x0, y);
	await page.mouse.down();
	await page.mouse.move((x0 + x1) / 2, y, { steps: 4 });
	await page.mouse.move(x1, y, { steps: 4 });
	await page.mouse.up();
}

/** Draw one straight mouse-dragged stroke from `(x, y0)` to `(x, y1)`. */
async function drawVerticalStroke(page: Page, x: number, y0: number, y1: number): Promise<void> {
	await page.mouse.move(x, y0);
	await page.mouse.down();
	await page.mouse.move(x, (y0 + y1) / 2, { steps: 4 });
	await page.mouse.move(x, y1, { steps: 4 });
	await page.mouse.up();
}

/**
 * Committed ink elements' own SVG containers, on the ACTIVE slide only.
 *
 * Scoped to `[data-pptx-viewport]` for the same reason `contentpart-ink.spec.ts`
 * scopes to it: Angular, Svelte and Vanilla render live slide thumbnails, so an
 * unscoped locator would also match every thumbnail's copy of the same stroke.
 * Scoped to `ink-` element ids so a neighbouring shape's own outline overlay (a
 * real `<svg>` too) is never mistaken for a Draw-tab ink element.
 */
function inkSvgs(page: Page) {
	return viewport(page).locator('[data-element-id*="ink-"] svg');
}

test.describe('Draw tool: highlighter blend mode', () => {
	test("applies multiply blend mode to each stroke shape, never to the element's outer svg", async ({
		page,
	}) => {
		await newBlankPresentation(page);
		await armHighlighterTool(page);

		const box = (await viewport(page).boundingBox())!;
		const midY = box.y + box.height / 2;
		const midX = box.x + box.width / 2;

		// Two crossing strokes: a real highlighter darkens at their intersection,
		// which requires the blend mode on each stroke, not their shared container.
		await drawHorizontalStroke(page, midY, midX - 60, midX + 60);
		await drawVerticalStroke(page, midX, midY - 60, midY + 60);

		const svgs = inkSvgs(page);
		await expect(svgs).toHaveCount(2);

		for (const svg of await svgs.all()) {
			// The outer <svg> container itself must never carry the blend mode:
			// that was the exact bug (container-level compositing hides
			// stroke-on-stroke darkening).
			const svgBlend = await svg.evaluate((el) => getComputedStyle(el).mixBlendMode);
			expect(svgBlend).not.toBe('multiply');

			// Each stroke's own paint shape (a plain <path> for a mouse-dragged,
			// non-pressure-varying stroke) must carry it.
			const strokeShape = svg.locator('path, g').first();
			const strokeBlend = await strokeShape.evaluate((el) => getComputedStyle(el).mixBlendMode);
			expect(strokeBlend).toBe('multiply');
		}
	});

	test('a plain pen stroke never gets multiply blend mode', async ({ page }) => {
		await newBlankPresentation(page);
		await openRibbonTab(page, 'Draw');
		await page.getByRole('button', { name: 'Pen', exact: true }).click();

		const box = (await viewport(page).boundingBox())!;
		const midY = box.y + box.height / 2;
		const midX = box.x + box.width / 2;
		await drawHorizontalStroke(page, midY, midX - 60, midX + 60);

		const svg = inkSvgs(page).first();
		await expect(svg).toBeVisible();
		const strokeShape = svg.locator('path, g').first();
		const strokeBlend = await strokeShape.evaluate((el) => getComputedStyle(el).mixBlendMode);
		expect(strokeBlend).not.toBe('multiply');
	});
});
