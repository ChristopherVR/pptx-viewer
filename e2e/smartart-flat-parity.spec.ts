/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
/**
 * SmartArt flat-path parity against PowerPoint's own ground truth deck
 * (`fixtures/three-d-parity/three-d-smartart.pptx`, Simple Fill style), run
 * identically against every framework demo on the 2D path (`?smartArt3D=0`).
 *
 * - Basic Pyramid (slide 57): each tier is a `trapezoid` at `adj 95238`. The
 *   ECMA-376 preset measures the top inset on the SHORT side, so a wide tier
 *   keeps a top edge as wide as the tier above it. The old preset scaled the
 *   inset by the width, turning every tier into a near-triangle: a point a
 *   third of the way in, just under the top edge, fell outside the fill.
 * - Basic Venn (slide 71): the circles are cached as `accent1` at
 *   `a:alpha 50000`, which PowerPoint blends where they overlap. The alpha
 *   used to be dropped, painting four opaque discs.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { resetTabSession, thumbnail } from './support/deck';

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/three-d-parity/three-d-smartart.pptx', import.meta.url)),
);

const SLIDE_COUNT = 112;

async function openSlide(page: Page, slideNumber: number): Promise<void> {
	await resetTabSession(page);
	await page.goto('/?smartArt3D=0');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[data-pptx-viewport] [data-element-id]').first().waitFor({ timeout: 30_000 });
	// The 112-slide rail is virtualised in some bindings: scroll its scroller
	// to the target's share of the deck until that thumbnail mounts.
	await thumbnail(page, 1).evaluate(
		(node, [n, total]) => {
			let el: HTMLElement | null = node as HTMLElement;
			while (
				el &&
				!(
					el.scrollHeight > el.clientHeight + 4 &&
					/auto|scroll/u.test(getComputedStyle(el).overflowY)
				)
			) {
				el = el.parentElement;
			}
			if (el) {
				el.scrollTop = (el.scrollHeight * (n - 1)) / total;
			}
		},
		[slideNumber, SLIDE_COUNT] as const,
	);
	const thumb = thumbnail(page, slideNumber);
	await thumb.scrollIntoViewIfNeeded();
	await thumb.click();
}

test.describe('smartArt flat path matches PowerPoint', () => {
	test.setTimeout(90_000);

	test('basic pyramid tiers keep a wide top edge', async ({ page }) => {
		await openSlide(page, 57);
		const tiers = page.locator('[data-pptx-viewport] svg path');
		await expect(tiers).toHaveCount(4, { timeout: 15_000 });
		const inside = await tiers.evaluateAll((paths) =>
			paths.slice(1).map((node) => {
				const path = node as SVGPathElement;
				const box = path.getBBox();
				const point = path.ownerSVGElement!.createSVGPoint();
				point.x = box.x + box.width * 0.3;
				point.y = box.y + box.height * 0.05;
				return path.isPointInFill(point);
			}),
		);
		expect(inside).toStrictEqual([true, true, true]);
	});

	test('basic venn circles are semi-transparent', async ({ page }) => {
		await openSlide(page, 71);
		const circles = page.locator('[data-pptx-viewport] svg ellipse');
		await expect(circles).toHaveCount(4, { timeout: 15_000 });
		const opacities = await circles.evaluateAll((nodes) =>
			nodes.map((node) => getComputedStyle(node).fillOpacity),
		);
		expect(opacities).toStrictEqual(['0.5', '0.5', '0.5', '0.5']);
	});
});
