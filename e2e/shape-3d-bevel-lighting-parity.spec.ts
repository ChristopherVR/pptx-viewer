/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Bevel lighting (`a:sp3d/a:bevelT`/`a:bevelB`), checked identically in every
 * binding.
 *
 * Closes the first of the three "3-D shapes and scenes" limitations
 * (`docs/guide/limitations.md`): a bevel used to be a CSS `box-shadow` inset
 * layer (`visual-3d.ts`'s `getBevelStyle`/`get3DBevelShadow`); it is now a
 * real SVG lighting `<filter>` (`feDiffuseLighting`/`feSpecularLighting` over
 * a height map built from the shape's own alpha silhouette) - see
 * `packages/shared/src/render/visual-3d-bevel-lighting.ts`'s module doc
 * comment for the full design and the COM comparison table.
 *
 * The filter is emitted in TWO independent places that must agree: the
 * shape's own CSS `filter` carries a `url(#bevel-light-<id>)` reference
 * (`getComputed3dStyle`/`apply3dEffects`), and each binding's
 * `ShapeEffectOverlay`-equivalent independently calls `getBevelLightingSvgFilter`
 * again to inject the matching `<filter>` markup (mirroring the pre-existing
 * soft-edge filter's two-step pattern). This spec asserts both halves land in
 * ALL FIVE bindings, run per Playwright project (`--project=react` /
 * `vue` / `angular` / `vanilla` / `svelte`), so a binding that wires the CSS
 * reference but forgets the `<defs>` injection (or vice versa) - which
 * renders as a silently MISSING bevel, worse than the old box-shadow
 * fallback it replaced - fails here instead of only in a screenshot.
 *
 * A `material`/profile combination calibration could not beat the legacy
 * box-shadow baseline for (currently just `metal`/`circle`) ROUTES to that
 * legacy model instead (`visual-3d-bevel-lighting-routing.ts`); this spec
 * checks both paths: the non-routed `matte`/`circle` shape gets the real
 * filter, and the routed `metal`/`circle` shape does NOT.
 *
 * Run: bunx playwright test shape-3d-bevel-lighting-parity
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

/** What the bevel lighting filter wiring looks like for one rendered element. */
interface BevelFilterState {
	/** The largest matching element's own CSS `filter`. */
	filterCss: string;
	/** Whether a `<filter id="bevel-light-<full-id>">` exists ANYWHERE in the document. */
	defFound: boolean;
	/** That `<filter>`'s markup contains the real lighting primitives, not a placeholder. */
	hasLightingPrimitives: boolean;
}

/**
 * Read the bevel-lighting wiring for the largest element with this id suffix,
 * so a slide-rail thumbnail copy can never win (mirrors `shape-3d-compound
 * .spec.ts`'s `paintOf`). The `<filter>` def is looked up GLOBALLY by the
 * element's own full `data-element-id` (not nested under the host node): the
 * five bindings place the hidden `<svg><defs>` differently relative to the
 * element's own box (sibling vs. nested), so asserting on the deterministic
 * id is the only binding-neutral way to find it.
 */
async function bevelFilterStateOf(page: Page, idSuffix: string): Promise<BevelFilterState | null> {
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
		const fullId = best.dataset.elementId ?? '';
		const filterCss = getComputedStyle(best).filter;
		const def = document.getElementById(`bevel-light-${fullId}`);
		const markup = def?.outerHTML ?? '';
		return {
			filterCss,
			defFound: Boolean(def),
			hasLightingPrimitives:
				markup.includes('feDiffuseLighting') && markup.includes('feSpecularLighting'),
		};
	}, idSuffix);
}

test.describe('bevel lighting SVG filter', () => {
	// `shape-9` ("Matte Bevel Block", circle + matte, NOT routed - see
	// scripts/make-shape-3d-fixture.mjs) gets the real SVG lighting filter.
	test('a non-routed bevelled shape gets a real lighting <filter>, referenced by its own CSS filter', async ({
		page,
	}) => {
		await loadDeck(page);

		const state = await bevelFilterStateOf(page, 'shape-9');
		expect(state).not.toBeNull();
		expect(state!.filterCss).toContain('url(');
		expect(state!.filterCss).toMatch(/bevel-light/u);
		expect(state!.defFound).toBe(true);
		expect(state!.hasLightingPrimitives).toBe(true);
	});

	// `shape-0` ("Bevel Block") carries a wide circle bevel + metal material:
	// exactly the `metal`/`circle` pair `visual-3d-bevel-lighting-routing.ts`
	// routes to the legacy `box-shadow` model (calibration could not beat that
	// baseline for this combination - see that module's doc comment), so it
	// must NOT get the SVG lighting filter.
	test('a routed (metal + circle) bevelled shape falls back to the legacy box-shadow, not the SVG filter', async ({
		page,
	}) => {
		await loadDeck(page);

		const state = await bevelFilterStateOf(page, 'shape-0');
		expect(state).not.toBeNull();
		expect(state!.filterCss).not.toMatch(/bevel-light/u);
		expect(state!.defFound).toBe(false);
	});

	// `shape-1` ("Flat Block") has no `a:sp3d` at all: no bevel filter of any
	// kind should be wired for it.
	test('a shape with no bevel gets no bevel-lighting filter', async ({ page }) => {
		await loadDeck(page);

		const state = await bevelFilterStateOf(page, 'shape-1');
		expect(state).not.toBeNull();
		expect(state!.filterCss).not.toMatch(/bevel-light/u);
		expect(state!.defFound).toBe(false);
	});
});
