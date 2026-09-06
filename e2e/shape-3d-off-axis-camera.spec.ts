/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Off-axis camera presets (`perspectiveHeroicLeftFacing` /
 * `perspectiveContrastingLeftFacing`), checked identically in every binding.
 *
 * 2026-09 wave 1: a COM measurement (`Shape.ThreeD.SetPresetCamera` +
 * `Slide.Export`, pixel-scanned bounding box + centroid) found the whole
 * `perspective*` family's `rotateX`/`rotateY` signs backwards, corrected with
 * a hand-tuned `rotateX`/`rotateY` + COM-calibrated `perspective-origin`.
 *
 * 2026-09 wave 2 (this spec): that rotateX/rotateY + perspective-origin model
 * is REPLACED for every `perspective*`/`isometric*` preset (and made an
 * explicit identity for `oblique*`/`legacyOblique*`/`legacyPerspective*`/
 * `orthographicFront`) with a COM-measured EXACT `matrix3d(...)` homography
 * -- see `packages/shared/src/render/visual-3d-camera-homography.ts`'s module
 * doc comment for the full measurement (a convex-hull fit over a flat
 * square's projected corners under every preset) and why a centred rotation +
 * perspective can never reproduce a genuine off-axis vanishing point. There
 * is no more separate `perspective-origin` CSS property for these presets:
 * the off-axis shift is baked into the matrix3d's own translation terms, and
 * `transform-origin` is pinned to `0 0` instead of the CSS default `50% 50%`.
 *
 * `e2e/fixtures/shape-3d-compound.pptx` (built by
 * `scripts/make-shape-3d-fixture.mjs`) carries a `perspectiveHeroicLeftFacing`
 * block (`shape-6`) and a `perspectiveContrastingLeftFacing` block
 * (`shape-7`). This spec pins the computed `transform`/`transform-origin` for
 * both, so all five demos agree and a future regression (a binding reverting
 * to the old rotate-based model, or dropping the matrix3d/transform-origin
 * plumbing when it spreads the shared descriptor) fails here rather than only
 * looking "a bit off" in a screenshot.
 *
 * Run: bunx playwright test shape-3d-off-axis-camera
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { resetTabSession } from './support/deck';

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/shape-3d-compound.pptx', import.meta.url)),
);

const LOAD_TIMEOUT_MS = 60_000;

async function loadDeck(page: Page): Promise<void> {
	await page.setViewportSize({ width: 1600, height: 1000 });
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[aria-label="Go to slide 1"]').first().waitFor({ timeout: LOAD_TIMEOUT_MS });
	await page.waitForTimeout(1200);
}

/** Computed `transform` + `transform-origin` for one element, by id suffix. */
interface CameraPaint {
	transform: string;
	transformOrigin: string;
}

/**
 * Read the computed style of the largest element with this id suffix, so a
 * slide-rail thumbnail can never win (mirrors `shape-3d-compound.spec.ts`'s
 * `paintOf`).
 */
async function cameraPaintOf(page: Page, idSuffix: string): Promise<CameraPaint | null> {
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
		const style = getComputedStyle(best);
		return { transform: style.transform, transformOrigin: style.transformOrigin };
	}, idSuffix);
}

/**
 * Extract the 16 numbers of a resolved `matrix3d(...)` transform (what
 * `getComputedStyle().transform` reports for ANY transform, including one
 * authored as a literal `matrix3d(...)` string, which is exactly how a
 * COM-measured homography-driven camera preset is expressed; see
 * `visual-3d-camera-homography.ts`'s `homographyToMatrix3d`).
 */
function matrix3dValues(transform: string): number[] {
	const match = /matrix3d\(([^)]+)\)/u.exec(transform);
	if (!match) {
		throw new Error(`expected a matrix3d(...) transform, got: ${transform}`);
	}
	return match[1].split(',').map((v) => Number.parseFloat(v.trim()));
}

/**
 * `m31` (0-based index 3 in the column-major 16-value list): the homography's
 * `h31` term (how much the projective divide `w` changes with `x`), embedded
 * by `homographyToMatrix3d`. This is the off-axis-camera "which way does the
 * vanishing point lean" term; both `*LeftFacing` presets measured a negative
 * `h31` (see `visual-3d-camera-homography.ts`'s `CAMERA_HOMOGRAPHY_MAP`).
 */
function m31Of(transform: string): number {
	return matrix3dValues(transform)[3];
}

/**
 * Which extrusion side panels (top/bottom/left/right) rendered for the
 * largest element with this id suffix, across ANY of the five bindings'
 * class/attribute conventions (react: `extrusion-3d-panel--<side>`; vue:
 * `pptx-vue-extrusion-3d-panel--<side>`; angular:
 * `pptx-ng-extrusion-3d-panel--<side>`; vanilla:
 * `pptxv-extrusion-3d-panel--<side>`; svelte: `data-side="<side>"`).
 */
async function extrusionPanelSidesOf(page: Page, idSuffix: string): Promise<string[]> {
	const sides = await page.evaluate((suffix) => {
		let host: HTMLElement | undefined;
		let bestArea = 0;
		for (const node of document.querySelectorAll<HTMLElement>('[data-element-id]')) {
			if (!(node.dataset.elementId ?? '').endsWith(suffix)) {
				continue;
			}
			const box = node.getBoundingClientRect();
			if (box.width * box.height > bestArea) {
				bestArea = box.width * box.height;
				host = node;
			}
		}
		const found: string[] = [];
		if (!host) {
			return found;
		}
		const candidates = host.querySelectorAll<HTMLElement>('[class*="extrusion"], [data-side]');
		for (const el of candidates) {
			if (el.dataset.side) {
				found.push(el.dataset.side);
				continue;
			}
			const match = /extrusion-3d-panel--(top|bottom|left|right)/u.exec(el.className);
			if (match) {
				found.push(match[1]);
			}
		}
		return found;
	}, idSuffix);
	return [...new Set(sides)].sort();
}

/**
 * The resolved `clip-path` of the extrusion side panel for the given side, on
 * the largest element with this id suffix, or `null` if no such panel is
 * found (or it never got a `clip-path` at all: an unmeasured preset falls
 * back to the legacy rotate/translateZ composition with no `clip-path`, see
 * `packages/shared/src/render/visual-3d-extrusion-panels.ts`).
 */
async function extrusionPanelClipPathOf(
	page: Page,
	idSuffix: string,
	side: string,
): Promise<string | null> {
	return page.evaluate(
		({ suffix, side: wantedSide }) => {
			let host: HTMLElement | undefined;
			let bestArea = 0;
			for (const node of document.querySelectorAll<HTMLElement>('[data-element-id]')) {
				if (!(node.dataset.elementId ?? '').endsWith(suffix)) {
					continue;
				}
				const box = node.getBoundingClientRect();
				if (box.width * box.height > bestArea) {
					bestArea = box.width * box.height;
					host = node;
				}
			}
			if (!host) {
				return null;
			}
			const candidates = host.querySelectorAll<HTMLElement>('[class*="extrusion"], [data-side]');
			for (const el of candidates) {
				const elSide =
					el.dataset.side ?? /extrusion-3d-panel--(top|bottom|left|right)/u.exec(el.className)?.[1];
				if (elSide !== wantedSide) {
					continue;
				}
				const clipPath = getComputedStyle(el).clipPath;
				return clipPath && clipPath !== 'none' ? clipPath : null;
			}
			return null;
		},
		{ suffix: idSuffix, side },
	);
}

test.describe('off-axis camera presets (perspectiveHeroic*/perspectiveContrasting*)', () => {
	test('perspectiveHeroicLeftFacing and perspectiveContrastingLeftFacing share the same off-axis lean, both pinned to transform-origin 0 0', async ({
		page,
	}) => {
		await loadDeck(page);

		const heroic = await cameraPaintOf(page, 'shape-6');
		const contrasting = await cameraPaintOf(page, 'shape-7');
		expect(heroic).not.toBeNull();
		expect(contrasting).not.toBeNull();

		// Both are "LeftFacing" presets: COM-measured with a negative h31 (see
		// `CAMERA_HOMOGRAPHY_MAP`), so their matrices' m31 sign must agree.
		const heroicM31 = m31Of(heroic!.transform);
		const contrastingM31 = m31Of(contrasting!.transform);
		expect(Math.sign(heroicM31)).toBe(Math.sign(contrastingM31));
		expect(heroicM31).not.toBe(0);

		// A COM-measured exact matrix3d requires transform-origin 0 0 (see
		// `homographyToMatrix3d`'s doc comment): the default 50%/50% would
		// pivot the whole projective divide around the wrong point.
		expect(heroic!.transformOrigin).toMatch(/^0px 0px/u);
		expect(contrasting!.transformOrigin).toMatch(/^0px 0px/u);
	});

	test('perspectiveContrastingLeftFacing has a visibly stronger off-axis skew than perspectiveHeroicLeftFacing', async ({
		page,
	}) => {
		await loadDeck(page);

		const contrasting = await cameraPaintOf(page, 'shape-7');
		const heroic = await cameraPaintOf(page, 'shape-6');
		expect(contrasting).not.toBeNull();
		expect(heroic).not.toBeNull();

		// `CAMERA_HOMOGRAPHY_MAP`: perspectiveContrastingLeftFacing's h31
		// (-0.067802) has a smaller magnitude than
		// perspectiveHeroicLeftFacing's h31 (-0.137299), but Contrasting's
		// skew term h12 (-0.046552, index 4) is much larger in magnitude than
		// Heroic's (0.029147) -- Contrasting is the more visually skewed of
		// the two "LeftFacing" pair. Assert on the skew term rather than a
		// brittle exact value.
		const contrastingSkew = Math.abs(matrix3dValues(contrasting!.transform)[4]);
		const heroicSkew = Math.abs(matrix3dValues(heroic!.transform)[4]);
		expect(contrastingSkew).toBeGreaterThan(heroicSkew);
	});

	// 2026-09 extrusion-panel-side wave: `shape-6` now carries a real 36pt
	// extrusion (see `scripts/make-shape-3d-fixture.mjs`'s `heroic` shape).
	// Re-ground-truthed 2026-09 full-preset wave (edge-band ink analysis, see
	// `packages/shared/src/render/visual-3d-panel-sides-perspective.ts`'s
	// `MEASURED_PERSPECTIVE_PANEL_SIDES` doc comment): `perspectiveHeroicLeftFacing`
	// shows ONLY the bottom extrusion panel, not bottom+right as an earlier,
	// coarser measurement pass found.
	test('perspectiveHeroicLeftFacing shows only the COM-measured bottom extrusion panel', async ({
		page,
	}) => {
		await loadDeck(page);

		const sides = await extrusionPanelSidesOf(page, 'shape-6');
		expect(sides).toStrictEqual(['bottom']);
	});
});

// 2026-09 full-preset extrusion-panel wave: every camera family that can show
// extrusion ink (`perspective*`, `isometric*`, `oblique*`/`legacyOblique*`/
// `legacyPerspective*`) now has a COM-measured `PANEL_DEPTH_SKEW_MAP` entry,
// so its panel is built as an explicit projected quadrilateral
// (`computeHomographyPanelQuad`) rather than the legacy degenerate
// rotate/translateZ composition. This block pins a `clip-path: polygon(...)`
// for one representative preset per family, so a regression that drops a
// binding back to the legacy composition (no `clip-path` at all) or loses the
// shared `PANEL_DEPTH_SKEW_MAP` plumbing fails here across all five bindings.
test.describe('extrusion panel clip-path quadrilateral (one preset per camera family)', () => {
	test('perspective family (perspectiveHeroicLeftFacing, shape-6): bottom panel has a 4-point clip-path polygon', async ({
		page,
	}) => {
		await loadDeck(page);

		const clipPath = await extrusionPanelClipPathOf(page, 'shape-6', 'bottom');
		expect(clipPath).not.toBeNull();
		expect(clipPath).toMatch(/^polygon\(/u);
		// 4 comma-separated point pairs.
		const pointCount = (clipPath!.match(/-?[\d.]+px\s+-?[\d.]+px/gu) ?? []).length;
		expect(pointCount).toBe(4);
	});

	// The bevelled block (`shape-0`, `isometricTopUp`) is COM-measured to show
	// a RIGHT panel, not the `bottom` an earlier, coarser measurement pass
	// mislabelled it as (see `MEASURED_ISOMETRIC_PANEL_SIDES`'s doc comment);
	// it now carries a matching `PANEL_DEPTH_SKEW_MAP` entry for that side.
	test('isometric family (isometricTopUp, shape-0): right panel has a 4-point clip-path polygon', async ({
		page,
	}) => {
		await loadDeck(page);

		const sides = await extrusionPanelSidesOf(page, 'shape-0');
		expect(sides).toStrictEqual(['right']);

		const clipPath = await extrusionPanelClipPathOf(page, 'shape-0', 'right');
		expect(clipPath).not.toBeNull();
		expect(clipPath).toMatch(/^polygon\(/u);
		const pointCount = (clipPath!.match(/-?[\d.]+px\s+-?[\d.]+px/gu) ?? []).length;
		expect(pointCount).toBe(4);
	});

	// `obliqueBottomRight` (`shape-8`): the one family neither of the other two
	// presets above exercises (a legacy WordArt-era "extrusion direction"
	// camera whose front face never rotates at all; see
	// `visual-3d-camera-homography.ts`'s module doc comment).
	test('oblique family (obliqueBottomRight, shape-8): bottom panel has a 4-point clip-path polygon', async ({
		page,
	}) => {
		await loadDeck(page);

		const sides = await extrusionPanelSidesOf(page, 'shape-8');
		expect(sides).toStrictEqual(['bottom']);

		const clipPath = await extrusionPanelClipPathOf(page, 'shape-8', 'bottom');
		expect(clipPath).not.toBeNull();
		expect(clipPath).toMatch(/^polygon\(/u);
		const pointCount = (clipPath!.match(/-?[\d.]+px\s+-?[\d.]+px/gu) ?? []).length;
		expect(pointCount).toBe(4);
	});
});
