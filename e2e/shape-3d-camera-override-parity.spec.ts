/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Explicit `a:camera/a:rot` (lat/lon/rev) overrides, checked identically in
 * every binding.
 *
 * Closes the third of the three "3-D shapes and scenes" limitations
 * (`docs/guide/limitations.md`): `getCameraTransform` used to fall back to a
 * hand-tuned `rotateX`/`rotateY` + centred CSS `perspective()` approximation
 * whenever an explicit override was present, even for a recognised preset
 * with ground truth otherwise. It now builds the SAME kind of exact
 * `matrix3d(...)` homography the preset table uses, via
 * `packages/shared/src/render/visual-3d-camera-parametric.ts`'s general
 * camera function - see that module's doc comment for the COM validation
 * (sub-pixel for identity/single-axis, a documented larger residual for a
 * genuinely combined multi-axis pose) and `e2e/fixtures/shape-3d-camera-
 * override.pptx` / `scripts/make-camera-override-fixture.mjs` for the fixture
 * (also the discovery that `a:camera/@prst` is a REQUIRED attribute in real
 * PowerPoint, so every case here carries `orthographicFront` alongside its
 * `a:rot` override).
 *
 * Every case is measured against `shape-3` (a plain, camera-less control of
 * the same authored size), the same "3D differs from flat, by the shape
 * predicted" convention `shape-3d-compound.spec.ts` uses.
 *
 * Run: bunx playwright test shape-3d-camera-override-parity
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { resetTabSession } from './support/deck';

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/shape-3d-camera-override.pptx', import.meta.url)),
);

const LOAD_TIMEOUT_MS = 60_000;

async function loadDeck(page: Page): Promise<void> {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[aria-label="Go to slide 1"]').first().waitFor({ timeout: LOAD_TIMEOUT_MS });
	await page.waitForTimeout(1200);
}

interface BoxAndTransform {
	width: number;
	height: number;
	transform: string;
	transformOrigin: string;
}

/** The largest element's rendered box + computed transform, by id suffix (mirrors sibling 3D specs). */
async function boxAndTransformOf(page: Page, idSuffix: string): Promise<BoxAndTransform | null> {
	return page.evaluate((suffix) => {
		let best: HTMLElement | undefined;
		let bestArea = 0;
		for (const node of document.querySelectorAll<HTMLElement>('[data-element-id]')) {
			if (!(node.dataset.elementId ?? '').endsWith(suffix)) {
				continue;
			}
			const box = node.getBoundingClientRect();
			if (box.width * box.height > bestArea) {
				bestArea = box.width * box.height;
				best = node;
			}
		}
		if (!best) {
			return null;
		}
		const box = best.getBoundingClientRect();
		const style = getComputedStyle(best);
		return {
			width: box.width,
			height: box.height,
			transform: style.transform,
			transformOrigin: style.transformOrigin,
		};
	}, idSuffix);
}

/**
 * Whether `getComputedStyle().transform` reflects a REAL applied transform,
 * as opposed to no transform at all (`none`) or a literal 2D identity.
 *
 * A homography with no projective/skew terms (the pure single-axis case;
 * see `visual-3d-camera-parametric.ts`'s `projectCorner` doc comment: the
 * primary cosine term has none) embeds as a `matrix3d(...)` whose z-row/
 * column are all identity, and Chrome's CSSOM serializes THAT back as the
 * shorter 2D `matrix(...)` form, not `matrix3d(...)` - both are legitimate
 * serializations of a real transform, so this checks "a transform is
 * applied", not the specific 2D-vs-3D wire format.
 */
function hasRealTransform(transform: string): boolean {
	return transform !== 'none' && transform !== 'matrix(1, 0, 0, 1, 0, 0)';
}

test.describe('explicit camera override (a:camera/a:rot)', () => {
	// `shape-0`: prst="orthographicFront" + a real lon=25deg override.
	// COM-measured (see visual-3d-camera-parametric.ts) to be a pure symmetric
	// width scale (cos(25deg) ~= 0.906) with NO keystone/skew: the rendered
	// width should shrink relative to the flat control while height stays
	// unchanged. Since this homography has no projective/skew terms at all,
	// Chrome's CSSOM reports it as a 2D `matrix(...)`, not `matrix3d(...)`
	// (see `hasRealTransform`'s doc comment) - the width-shrink-with-
	// unchanged-height signature is what actually distinguishes the new
	// model from the old rotateX/rotateY + perspective() approximation,
	// which always keystoned instead.
	test('a single-axis yaw override shrinks width symmetrically with unchanged height', async ({
		page,
	}) => {
		await loadDeck(page);

		const control = await boxAndTransformOf(page, 'shape-3');
		const yawed = await boxAndTransformOf(page, 'shape-0');
		expect(control).not.toBeNull();
		expect(yawed).not.toBeNull();
		expect(hasRealTransform(yawed!.transform)).toBe(true);
		expect(yawed!.transformOrigin).toMatch(/^0px 0px/u);

		const widthRatio = yawed!.width / control!.width;
		const heightRatio = yawed!.height / control!.height;
		// cos(25deg) ~= 0.906; allow generous tolerance for layout rounding.
		expect(widthRatio).toBeGreaterThan(0.8);
		expect(widthRatio).toBeLessThan(0.98);
		expect(heightRatio).toBeGreaterThan(0.95);
		expect(heightRatio).toBeLessThan(1.05);
	});

	// `shape-2`: a near-zero override (lat=1/60000deg, lon=rev=0) must render
	// (visually) as the identity: same size as the flat control.
	test('a near-zero override renders as the identity, matching the flat control size', async ({
		page,
	}) => {
		await loadDeck(page);

		const control = await boxAndTransformOf(page, 'shape-3');
		const identity = await boxAndTransformOf(page, 'shape-2');
		expect(control).not.toBeNull();
		expect(identity).not.toBeNull();

		expect(identity!.width / control!.width).toBeGreaterThan(0.97);
		expect(identity!.width / control!.width).toBeLessThan(1.03);
		expect(identity!.height / control!.height).toBeGreaterThan(0.97);
		expect(identity!.height / control!.height).toBeLessThan(1.03);
	});

	// `shape-1`: a combined lat+lon+rev override. Not claimed to be COM-exact
	// (see the module doc comment's larger residual for this case), but it
	// MUST still differ visibly from both the flat control and the pure-yaw
	// case, and MUST still carry a real transform with transform-origin 0 0 -
	// proving the parametric path (not the old legacy fallback) is in play.
	test('a combined multi-axis override is a distinct transform, different from both the control and pure yaw', async ({
		page,
	}) => {
		await loadDeck(page);

		const control = await boxAndTransformOf(page, 'shape-3');
		const combined = await boxAndTransformOf(page, 'shape-1');
		const yawed = await boxAndTransformOf(page, 'shape-0');
		expect(control).not.toBeNull();
		expect(combined).not.toBeNull();
		expect(yawed).not.toBeNull();

		expect(hasRealTransform(combined!.transform)).toBe(true);
		expect(combined!.transformOrigin).toMatch(/^0px 0px/u);
		expect(combined!.transform).not.toBe(control!.transform);
		expect(combined!.transform).not.toBe(yawed!.transform);
	});
});
