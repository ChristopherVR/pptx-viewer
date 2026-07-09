/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * 3D SmartArt (`smartArt3D`) E2E coverage.
 *
 * The opt-in vanilla-Three.js SmartArt renderer (`pptx-viewer-shared/smartart-3d`)
 * has no live UI toggle: every binding reads it once, at mount, from the
 * `?smartArt3D=1` query string (see the demo entry points: `demos/demo-react/main.tsx`,
 * `demos/demo-vue/src/App.vue`, `demos/demo-angular/src/app.component.ts`) and threads
 * it down as a fixed boolean prop for the life of the page. So
 * "toggling 3D on/off" for a user is a page load with (or without) that query
 * param, not a runtime switch; these specs model it that way:
 *
 *  - `?smartArt3D=1` + insert a Cycle/Hierarchy SmartArt -> a `<canvas>` (the
 *    mounted WebGL scene) should appear for that element with a non-zero size.
 *  - no query param (default) + insert the same presets -> NO canvas should
 *    ever appear; the plain SVG renderer should render instead (this is the
 *    "3D off falls back to 2D" contract).
 *  - within a single 3D-enabled page, switching the inspector's layout type
 *    (Cycle -> Hierarchy) forces `SmartArt3DScene` to tear down the old
 *    `WebGLRenderer` and mount a fresh one (its mount effect keys off the 3D
 *    model identity). Asserting exactly one canvas survives the switch is the
 *    practical proxy for "no orphaned canvas/WebGL contexts" available at this
 *    architecture: there is no live "flip the flag" control on the same page
 *    to more directly exercise mount/unmount, but every renderer wrapper
 *    (`SmartArt3DScene.tsx` / `SmartArt3DRenderer.vue` / the Angular
 *    `smart-art-3d-renderer.component.ts`) disposes on that same effect, so
 *    this exercises the identical cleanup path a live toggle would.
 *
 * Locator notes (all discovered by running this spec against real dev servers,
 * not assumed):
 *  - `data-element-id` (not `data-pptx-element`) is the cross-framework anchor
 *    for locating the inserted element, matching the precedent set in
 *    `chart-rendering.spec.ts`: React/Angular's 3D SmartArt wrapper additionally
 *    emits `data-pptx-element`, but Vue's does not.
 *  - Vue (and possibly other bindings) renders the Slides sidebar thumbnails
 *    through the *same* element-renderer tree, so a naive `[data-element-id="x"]`
 *    query can match more than one node (the live slide *and* its thumbnail).
 *    Every query here is therefore scoped inside `[data-pptx-viewport]`, the
 *    neutral hook (see `playwright.config.ts`'s file docstring) for the single
 *    main editing canvas.
 *  - Ribbon tabs ("Insert", "Home", ...) are plain `<button>` elements with no
 *    `role="tab"` in any of the three bindings (verified directly; the
 *    `getByRole('tab', ...)` helper in `smartart-insert-edit.spec.ts` does not
 *    match anything and silently no-ops), so tab switching goes through
 *    `getByRole('button', ...)` here instead.
 *  - The 2D fallback SVG renderer only carries a `data-testid="smartart-*"`
 *    hook in React; Vue's `SmartArtRenderer.vue` has no such attribute. The
 *    fallback assertion below checks for a generic `<svg>` (present in all
 *    three) rather than the React-only testid.
 *
 * WebGL-in-headless-Chromium note: a probe runs once in `beforeAll` and the
 * canvas-mounting tests are skipped with a clear reason if it comes back
 * negative, since headless WebGL support is a known source of CI flakiness.
 * In this environment Playwright's bundled Chromium exposes WebGL out of the
 * box via SwiftShader with *default* launch args (no `--use-gl=...` override
 * was necessary), so no launch-arg change was made to `playwright.config.ts`.
 * If this ever reports unavailable in some other environment, these tests
 * will skip themselves with a visible reason rather than fail red.
 *
 * Run: bunx playwright test smartart-3d
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const fixturePath = resolve(fileURLToPath(new URL('./fixtures/sample-deck.pptx', import.meta.url)));

// ── WebGL capability probe ───────────────────────────────────────────────────

let webglAvailable = true;
let webglProbeInfo = '';

test.beforeAll(async ({ browser }) => {
	const page = await browser.newPage();
	const result = await page.evaluate(() => {
		const canvas = document.createElement('canvas');
		const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
		if (!gl) {
			return { ok: false, renderer: '' };
		}
		const dbg = gl.getExtension('WEBGL_debug_renderer_info');
		const renderer = dbg
			? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
			: String(gl.getParameter(gl.RENDERER));
		return { ok: true, renderer };
	});
	await page.close();
	webglAvailable = result.ok;
	webglProbeInfo = result.renderer;
	// eslint-disable-next-line no-console
	console.log(
		webglAvailable
			? `[smartart-3d e2e] WebGL probe OK: ${webglProbeInfo}`
			: '[smartart-3d e2e] WebGL probe FAILED: headless Chromium has no WebGL context in ' +
					'this environment. Canvas-mounting assertions below will be skipped (see spec header).',
	);
});

/** Skip a test with a clear, visible reason when this environment has no WebGL. */
function requireWebGL(): void {
	test.skip(!webglAvailable, 'headless Chromium has no WebGL context in this environment');
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** The single main editing canvas, excluding the Slides sidebar thumbnails. */
function viewport(page: Page): Locator {
	return page.locator('[data-pptx-viewport]');
}

/** Load the sample deck, optionally opting into the 3D SmartArt renderer. */
async function loadDeck(page: Page, options: { threeD?: boolean } = {}): Promise<void> {
	await page.goto(options.threeD ? '/?smartArt3D=1' : '/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[data-pptx-element="true"]').first().waitFor();
	await page.waitForTimeout(500);
}

/**
 * Switch to the Insert ribbon tab. All three bindings render ribbon tabs as
 * plain `<button>` elements (no `role="tab"`), so the accessible name is
 * queried via the `button` role.
 */
async function switchToInsertTab(page: Page): Promise<void> {
	const insertTab = page.getByRole('button', { name: 'Insert' });
	await insertTab.click();
	await page.waitForTimeout(200);
}

/** Open the Insert SmartArt dialog. */
async function openSmartArtDialog(page: Page): Promise<void> {
	await switchToInsertTab(page);
	await page.getByRole('button', { name: 'SmartArt' }).click();
	await page.waitForTimeout(300);
}

/**
 * Pick a category + the first preset in its gallery, then confirm insertion.
 * Vue/Angular tag gallery items `role="option"`; React's are plain buttons, so
 * fall back to a positional pick within the (already category-filtered)
 * gallery grid, mirroring `smartart-insert-edit.spec.ts`.
 */
async function insertFirstPresetInCategory(page: Page, categoryName: RegExp): Promise<void> {
	const dialog = page.getByRole('dialog', { name: /Insert SmartArt/iu });
	await expect(dialog).toBeVisible();

	const category = dialog.getByRole('button', { name: categoryName });
	await category.click();
	await page.waitForTimeout(200);

	const galleryItem = dialog.getByRole('option').first();
	if (await galleryItem.isVisible()) {
		await galleryItem.click();
	} else {
		// React gallery items are unadorned buttons; the sidebar (List, Process,
		// Cycle, Hierarchy, Relationship, ...) precedes the gallery grid, so the
		// first preset button is the one right after the now-active category.
		const galleryButtons = dialog
			.locator('div.flex-1.overflow-y-auto button')
			.filter({ hasText: /./u });
		await galleryButtons.first().click();
	}
	await page.waitForTimeout(100);

	const insertBtn = dialog.getByRole('button', { name: /^Insert$/iu });
	await insertBtn.click();
	await page.waitForTimeout(600);
}

/** Snapshot every element's `data-element-id` in the main editing canvas. */
async function elementIds(page: Page): Promise<string[]> {
	return viewport(page)
		.locator('[data-element-id]')
		.evaluateAll((els) =>
			els.map((e) => e.getAttribute('data-element-id')).filter((v) => v !== null),
		);
}

/** The id that appeared after `before` was captured (the newly-inserted element). */
function newElementId(before: string[], after: string[]): string {
	const beforeSet = new Set(before);
	const added = after.filter((id) => !beforeSet.has(id));
	expect(added.length).toBeGreaterThan(0);
	return added[added.length - 1]!;
}

/** The main-canvas wrapper for a given element id (never a sidebar thumbnail). */
function elementInViewport(page: Page, id: string): Locator {
	return viewport(page).locator(`[data-element-id="${id}"]`).first();
}

/**
 * Open the inspector panel if it isn't already showing. Angular auto-opens
 * on selection. React and Vue both default the format panel to open and
 * expose an independent open/close toggle (not tied to selection), so
 * blindly clicking "Toggle inspector" would close an already-open panel
 * instead of opening one - only toggle when the panel isn't visible.
 *
 * Vue's SmartArt inspector content carries a `data-testid` the panel wrapper
 * itself doesn't, so check for that where available; React has no such
 * testid, so fall back to the panel wrapper's own `role="complementary"`
 * `aria-label="Properties"` (same contract inspector-responsiveness.spec.ts
 * relies on).
 */
async function openInspector(page: Page, project: string): Promise<void> {
	if (project === 'angular') {
		return;
	}
	const alreadyOpen =
		project === 'vue'
			? await page
					.locator('[data-testid="smartart-layouts"], [data-testid="smartart-panel"]')
					.first()
					.isVisible()
			: await page.getByRole('complementary', { name: 'Properties' }).isVisible();
	if (alreadyOpen) {
		return;
	}
	const label = project === 'react' ? 'Toggle inspector panel' : 'Toggle inspector';
	const toggleBtn = page.getByRole('button', { name: label });
	if (await toggleBtn.isVisible()) {
		await toggleBtn.click();
		await page.waitForTimeout(200);
	}
}

function projectName(page: Page): string {
	const url = page.url();
	if (url.includes('4173')) {
		return 'react';
	}
	if (url.includes('4175')) {
		return 'vue';
	}
	if (url.includes('4174')) {
		return 'angular';
	}
	return 'react';
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('3D SmartArt (smartArt3D opt-in)', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	test('mounts the WebGL canvas for a Cycle-layout SmartArt', async ({ page }) => {
		requireWebGL();

		const pageErrors: string[] = [];
		page.on('pageerror', (err) => pageErrors.push(String(err)));

		await loadDeck(page, { threeD: true });
		const before = await elementIds(page);

		await openSmartArtDialog(page);
		await insertFirstPresetInCategory(page, /^Cycle$/iu);

		const after = await elementIds(page);
		const id = newElementId(before, after);

		const canvas = elementInViewport(page, id).locator('canvas');
		await expect(canvas).toBeVisible({ timeout: 5000 });

		const box = await canvas.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.width).toBeGreaterThan(0);
		expect(box!.height).toBeGreaterThan(0);

		expect(pageErrors, `unexpected page errors: ${pageErrors.join('; ')}`).toHaveLength(0);
	});

	test('mounts the WebGL canvas for a Hierarchy-layout SmartArt', async ({ page }) => {
		requireWebGL();

		const pageErrors: string[] = [];
		page.on('pageerror', (err) => pageErrors.push(String(err)));

		await loadDeck(page, { threeD: true });
		const before = await elementIds(page);

		await openSmartArtDialog(page);
		await insertFirstPresetInCategory(page, /^Hierarchy$/iu);

		const after = await elementIds(page);
		const id = newElementId(before, after);

		const canvas = elementInViewport(page, id).locator('canvas');
		await expect(canvas).toBeVisible({ timeout: 5000 });

		const box = await canvas.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.width).toBeGreaterThan(0);
		expect(box!.height).toBeGreaterThan(0);

		expect(pageErrors, `unexpected page errors: ${pageErrors.join('; ')}`).toHaveLength(0);
	});

	test('falls back to the 2D SVG renderer with no canvas when smartArt3D is off', async ({
		page,
	}) => {
		await loadDeck(page, { threeD: false });
		const before = await elementIds(page);

		await openSmartArtDialog(page);
		await insertFirstPresetInCategory(page, /^Cycle$/iu);

		const after = await elementIds(page);
		const id = newElementId(before, after);
		const el = elementInViewport(page, id);

		// The plain SVG renderer should be present (all three bindings render the
		// 2D SmartArt diagram as inline SVG)...
		await expect(el.locator('svg').first()).toBeVisible({ timeout: 5000 });

		// ...and no canvas (no WebGL context) should ever have been created for it.
		await expect(el.locator('canvas')).toHaveCount(0);
	});

	test('switching layout while in 3D mode replaces the canvas without leaking one', async ({
		page,
	}) => {
		requireWebGL();

		await loadDeck(page, { threeD: true });
		const before = await elementIds(page);

		await openSmartArtDialog(page);
		await insertFirstPresetInCategory(page, /^Cycle$/iu);

		const after = await elementIds(page);
		const id = newElementId(before, after);
		const el = elementInViewport(page, id);

		await expect(el.locator('canvas')).toBeVisible({ timeout: 5000 });
		await expect(el.locator('canvas')).toHaveCount(1);

		// Select the element (auto-selected on insert already, but click defensively
		// in case selection was lost) and open the inspector's layout switcher.
		await el.click();
		await page.waitForTimeout(200);
		const project = projectName(page);
		await openInspector(page, project);
		await page.waitForTimeout(300);

		const hierarchyByTestId = page.locator('[data-testid="smartart-layout-hierarchy"]');
		const hierarchyByTitle = page.getByRole('button', { name: /^Hierarchy$/iu });
		const switchTarget = (await hierarchyByTestId.isVisible())
			? hierarchyByTestId
			: hierarchyByTitle;
		await switchTarget.click();
		await page.waitForTimeout(600);

		// Exactly one canvas should remain: the old WebGL scene must have been
		// disposed (its cleanup effect runs on the model-identity change), not
		// left mounted alongside a freshly-created one.
		const canvasesAfterSwitch = el.locator('canvas');
		await expect(canvasesAfterSwitch).toHaveCount(1, { timeout: 5000 });

		const box = await canvasesAfterSwitch.first().boundingBox();
		expect(box).not.toBeNull();
		expect(box!.width).toBeGreaterThan(0);
		expect(box!.height).toBeGreaterThan(0);
	});
});
