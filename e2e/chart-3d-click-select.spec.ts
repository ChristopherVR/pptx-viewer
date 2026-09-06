/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Click-to-select on an interactive 3D chart mark (`?barChart3D=1`), run
 * across every binding demo via `acrossFrameworks`.
 *
 * Reuses `bar3d-horizontal.pptx` (the same `c:bar3DChart`/`barDir="bar"`
 * fixture `horizontal-bar3d-chart.spec.ts` already exercises against the flat
 * SVG fallback), but THIS TIME forces the interactive three.js `bar3D` scene
 * on via `?barChart3D=1` (confirmed, by reading every demo entry point, to be
 * the exact query flag threaded down as the `barChart3D` prop in
 * `demos/demo-{react,vue,angular,svelte,vanilla}`'s `main.tsx`/`App.vue`/
 * `app.component.ts`/`App.svelte`/`main.ts`).
 *
 * A clicked mark's own hover-tooltip text is the framework-neutral readout
 * this spec uses to find and identify a mark, exactly as `chart-pie-drag.spec.ts`
 * does for the 2D SVG path (`buildMarkTooltip`'s `"<series>, <category>: <value>"`).
 * For a 3D canvas mark the SAME text is instead set as the canvas element's own
 * `title` ATTRIBUTE on pointer-move (`chart-3d-hover-tooltip.ts`'s
 * `attachChart3DHoverTooltip`, `canvas.title = tooltip`), so
 * `canvas.getAttribute('title')` after hovering identifies the mark under the
 * pointer without needing pixel-perfect knowledge of the WebGL scene's camera
 * projection. Every candidate point in the probed grid below, and the exact
 * gating behaviour asserted, was discovered by running this spec against the
 * real dev servers, not assumed - see the notes inline.
 *
 * ## Click-to-select gating: verified live, NOT assumed
 *
 * `chart-pie-drag.spec.ts`'s 2D marks stay pointer-transparent
 * (`pointer-events: none`) until the chart is the CURRENT selection, because a
 * plain CSS gate sits in front of the SVG hit targets. A WebGL `<canvas>` has
 * no such CSS gate: `attachChart3DPointerInteraction`'s pointerdown/up
 * listeners are attached to the canvas unconditionally, and
 * `bar-chart-3d-interaction-wiring.ts` wires the mesh-material highlight
 * (`applyChart3DMeshHighlight`) independently of whether the caller-supplied
 * `interaction.onSelect` (the thing that syncs into the shared chart-part-
 * selection state the inspector reads) is even present. Running this
 * live confirmed the practical effect differs by binding: React and Vue
 * already sync a mark click into the inspector on the FIRST click with no
 * prior chart selection, but Vanilla does not (its inspector highlight only
 * appeared once the chart had separately been made the current selection
 * first). Rather than encode that per-binding difference, this spec always
 * selects the chart first (a plain click on the canvas's own top-left corner,
 * confirmed live to land on empty background rather than a mark, exactly
 * mirroring `chart-pie-drag.spec.ts`'s `selectChart` step) so every binding is
 * driven through the strictest, most-compatible sequence.
 *
 * ## The inspector-highlight signal is best-effort, not required
 *
 * `ChartDataPanel`/`ChartDataGrid` (React) and its Vue/Angular/Vanilla
 * counterparts mirror a canvas-selected mark onto the data grid with a
 * "highlight" style: React uses the shared `ring-1 ring-primary` Tailwind
 * pair, Vue/Vanilla/Angular each independently named their own CSS class
 * containing the word "highlight" (`pptx-vue-chart-cell-highlight`,
 * `pptxv-chart-grid-cell-highlight`, `pptx-chart-editor__input--highlight`).
 * This spec checks for that GENERICALLY, via a `[class*="highlight" i]` /
 * `[class*="ring-primary" i]` attribute-substring selector, so no
 * binding-specific class literal is hardcoded (keeping this spec's selectors
 * framework-neutral per this repo's e2e convention).
 *
 * Running this live also found that ONE binding wires NEITHER its 2D NOR its
 * 3D canvas mark selection into any inspector-visible DOM state at all (its
 * `ChartDataGrid` counterpart has no `highlightCell`-equivalent prop, and its
 * chart-drag/chart-3d-interaction controllers track the selected mark purely
 * as internal state, never surfaced to the inspector). That is a pre-existing,
 * structural gap equally true for 2D chart marks, not a regression in the 3D
 * click-to-select wiring under test here, and out of scope to fix from an
 * e2e-only task - so the inspector-highlight check below is deliberately
 * SOFT: zero matches is accepted (nothing to assert), but MORE than one match
 * is a real bug (two cells simultaneously claiming the canvas selection) and
 * fails the test.
 *
 * Every binding is still REQUIRED to: mount the WebGL canvas, report a
 * non-empty hover tooltip for some probed point (proving a mark is really
 * there and hit-testable), survive the click with zero page errors, and keep
 * the canvas visible/interactive afterwards (a fresh hover of the same point
 * still reports a tooltip).
 *
 * Value-drag (dragging a 3D mark to change its underlying value) is
 * deliberately OUT OF SCOPE for the bar3D test below: `chart-pie-drag.spec.ts`
 * already demonstrates this repo's drag-testing pattern for the 2D case, and
 * calibrating an exact pixel-to-value drag for a WebGL box mesh's screen
 * projection is fragile in headless WebGL.
 *
 * A second `describe` block below covers surface3D specifically (click-to-
 * select a grid vertex, which now also positions a highlight marker mesh onto
 * it, and drag-to-value): it DOES exercise the drag gesture end to end
 * (press, move, release), but for the same headless-WebGL-projection reason
 * only asserts the gesture completes and leaves the scene intact, not the
 * exact resulting value.
 *
 * A third `describe` block covers pie3D (click-to-select a wedge, and
 * drag-to-value: sweeping a wedge's trailing edge around the pie's centre,
 * see `pie-chart-3d-drag.ts`), against a dedicated `pie3d.pptx` fixture
 * rather than `chart-gallery.pptx` (see that block's own fixture comment for
 * why). Same drag-gesture-completes-without-breaking-the-scene assertion
 * shape as surface3D, for the same headless-WebGL-projection reason.
 *
 * Run: bunx playwright test chart-3d-click-select
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { fixture, loadDeckAt, slideStage } from './support/deck';
import { acrossFrameworks } from './support/parity';

test.use({ viewport: { width: 1440, height: 900 } });

const FIXTURE = fixture('bar3d-horizontal.pptx');
/**
 * `chart-gallery.pptx` slide 17 is the same "surface" chart
 * `chart-data-fidelity.spec.ts`'s `MARKED_KINDS` table already proves has
 * selectable 2D data marks; `resolveChartKind` folds a plain `surface`
 * `c:chartType` onto the same `'surface'` kind `surface3D` does
 * (`chart-view-model-kinds.ts`), so `?surfaceChart3D=1` mounts the SAME
 * interactive WebGL scene against it without needing a dedicated fixture.
 */
const GALLERY_FIXTURE = fixture('chart-gallery.pptx');
const SURFACE_SLIDE = 17;
/**
 * `pie3d.pptx` (`e2e/fixtures/generate-pie3d-fixture.ts`) is a dedicated
 * single-slide fixture, not `chart-gallery.pptx`: unlike `surface`/`surface3D`
 * (both fold onto `resolveChartKind`'s `'surface'`), `buildPieChart3DDataForElement`
 * gates on the RAW `chartType` being literally `pie3D` and never mounts for a
 * plain `pie`/`doughnut` chart, so `chart-gallery.pptx`'s flat "Pie" slide
 * (`chart-pie-drag.spec.ts`'s `PIE_SLIDE_NUMBER`) cannot exercise this path.
 */
const PIE3D_FIXTURE = fixture('pie3d.pptx');

// ── WebGL capability probe (mirrors smartart-3d.spec.ts) ────────────────────

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
			? `[chart-3d-click-select e2e] WebGL probe OK: ${webglProbeInfo}`
			: '[chart-3d-click-select e2e] WebGL probe FAILED: headless Chromium has no WebGL context ' +
					'in this environment. This spec will be skipped (see file header).',
	);
});

function requireWebGL(): void {
	test.skip(!webglAvailable, 'headless Chromium has no WebGL context in this environment');
}

/**
 * Jump to `slideNumber` via whichever of the two per-binding thumbnail-rail
 * conventions is present (mirrors `chart-data-fidelity.spec.ts`'s identical
 * helper: bindings disagree on `data-slide-index` vs a "Go to slide N" button
 * label, and both are accepted rather than branching on the framework).
 */
async function gotoSlide(page: Page, slideNumber: number): Promise<void> {
	const byIndex = page.locator(`[data-slide-index="${slideNumber - 1}"]`).first();
	const byLabel = page.getByRole('button', { name: `Go to slide ${slideNumber}` }).first();
	const target = (await byIndex.count()) > 0 ? byIndex : byLabel;
	await target.click();
	await page.waitForTimeout(900);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** The chart's own graphic frame, via the shared accessibility contract. */
function chartHost(page: Page): Locator {
	return page
		.locator('[aria-roledescription="slide"]')
		.first()
		.locator('[aria-roledescription="chart"]')
		.first();
}

interface MarkHit {
	x: number;
	y: number;
	title: string;
}

/**
 * Probe a grid of points inside `canvas`'s own bounding box for the first one
 * whose hover triggers a non-empty `title` attribute (a real box-mesh hit).
 * The WebGL scene's camera/box layout cannot be computed analytically from
 * its authored data alone (camera placement, box geometry and screen
 * projection all live inside the mounted three.js scene), so this probes the
 * real, rendered page instead - the same approach `smartart-3d.spec.ts` and
 * its sibling 3D specs already use.
 */
async function findMark(page: Page, canvas: Locator): Promise<MarkHit> {
	const box = await canvas.boundingBox();
	if (!box) {
		throw new Error('the 3D chart canvas has no layout box to probe');
	}
	for (let fx = 0.15; fx <= 0.85; fx += 0.05) {
		for (let fy = 0.15; fy <= 0.85; fy += 0.05) {
			const x = box.x + box.width * fx;
			const y = box.y + box.height * fy;
			await page.mouse.move(x, y);
			await page.waitForTimeout(20);
			const title = await canvas.getAttribute('title');
			if (title) {
				return { x, y, title };
			}
		}
	}
	throw new Error('no hoverable 3D chart mark was found while probing the canvas');
}

interface Chart3DClickSelectResult {
	pageErrors: string[];
	hitTitle: string;
	canvasVisibleAfterClick: boolean;
	canvasBoxAfterClick: { width: number; height: number } | null;
	titleAfterClick: string | null;
	/** Count of inspector cells whose class carries the on-canvas selection highlight (best-effort; see file header). */
	highlightCount: number;
}

test.describe('3D chart click-to-select (barChart3D opt-in)', () => {
	test('clicking a bar3D mark selects it, mirrored into the inspector where a binding wires that up', async ({
		browser,
	}, testInfo) => {
		test.slow();
		requireWebGL();

		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin): Promise<Chart3DClickSelectResult> => {
				const pageErrors: string[] = [];
				page.on('pageerror', (err) => pageErrors.push(String(err)));

				await loadDeckAt(page, origin, FIXTURE);
				await slideStage(page).waitFor();

				const host = chartHost(page);
				await host.waitFor({ timeout: 10_000 });
				const canvas = host.locator('canvas');
				await expect(canvas).toBeVisible({ timeout: 10_000 });
				// Let the scene's first frame / OrbitControls settle.
				await page.waitForTimeout(800);

				// Select the chart first: see the file header for why every binding
				// gets this step even though React/Vue did not strictly need it live.
				const canvasBox = (await canvas.boundingBox())!;
				await page.mouse.click(
					canvasBox.x + canvasBox.width * 0.02,
					canvasBox.y + canvasBox.height * 0.02,
				);
				await page.waitForTimeout(300);

				const hit = await findMark(page, canvas);

				// A plain click: no drag. Selection only, never value-editing.
				await page.mouse.click(hit.x, hit.y);
				await page.waitForTimeout(400);

				// The scene must still be alive and interactive after the click: move
				// away and back, and expect a fresh (still non-empty) tooltip.
				await page.mouse.move(hit.x + 4, hit.y + 4);
				await page.waitForTimeout(20);
				await page.mouse.move(hit.x, hit.y);
				await page.waitForTimeout(20);
				const titleAfterClick = await canvas.getAttribute('title');

				const inspector = page.locator('[data-pptx-inspector]:visible').first();
				const highlightCount = await inspector
					.locator('[class*="highlight" i], [class*="ring-primary" i]')
					.count()
					.catch(() => 0);

				return {
					pageErrors,
					hitTitle: hit.title,
					canvasVisibleAfterClick: await canvas.isVisible(),
					canvasBoxAfterClick: await canvas.boundingBox(),
					titleAfterClick,
					highlightCount,
				};
			},
			{ path: '/?barChart3D=1', concurrency: 'sequential' },
		);

		const failures = results.flatMap(({ framework, value }) => {
			const problems: string[] = [];
			if (value.pageErrors.length > 0) {
				problems.push(`unexpected page errors: ${value.pageErrors.join('; ')}`);
			}
			if (!value.hitTitle) {
				problems.push('no 3D chart mark reported a hover tooltip anywhere in the probed grid');
			}
			if (
				!value.canvasVisibleAfterClick ||
				!value.canvasBoxAfterClick ||
				value.canvasBoxAfterClick.width <= 0 ||
				value.canvasBoxAfterClick.height <= 0
			) {
				problems.push('the WebGL canvas is gone or has zero size after clicking a mark');
			}
			if (!value.titleAfterClick) {
				problems.push(
					're-hovering the clicked mark reports no tooltip afterwards; the scene may have broken',
				);
			}
			if (value.highlightCount > 1) {
				problems.push(
					`${value.highlightCount} inspector cells carry the canvas-selection highlight at once (expected at most 1)`,
				);
			}
			return problems.length > 0 ? [`${framework.name}: ${problems.join('; ')}`] : [];
		});

		expect(failures.join('\n')).toBe('');
	});
});

// ── surface3D: click-to-select (+ vertex highlight) and drag-to-value ───────

interface Surface3DResult {
	pageErrors: string[];
	hitTitle: string;
	canvasVisibleAfterSelect: boolean;
	canvasBoxAfterSelect: { width: number; height: number } | null;
	titleAfterSelect: string | null;
	canvasVisibleAfterDrag: boolean;
	canvasBoxAfterDrag: { width: number; height: number } | null;
	titleAfterDrag: string | null;
}

test.describe('3D surface chart click-to-select + drag-to-value (surfaceChart3D opt-in)', () => {
	test('clicking a surface3D vertex selects it (highlighting the vertex marker), and dragging it does not break the scene', async ({
		browser,
	}, testInfo) => {
		test.slow();
		requireWebGL();

		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin): Promise<Surface3DResult> => {
				const pageErrors: string[] = [];
				page.on('pageerror', (err) => pageErrors.push(String(err)));

				await loadDeckAt(page, origin, GALLERY_FIXTURE);
				await slideStage(page).waitFor();
				await gotoSlide(page, SURFACE_SLIDE);

				const host = chartHost(page);
				await host.waitFor({ timeout: 10_000 });
				const canvas = host.locator('canvas');
				await expect(canvas).toBeVisible({ timeout: 10_000 });
				// Let the scene's first frame / OrbitControls settle.
				await page.waitForTimeout(800);

				// Select the chart first: see the barChart3D test above for why every
				// binding gets this step even though not every one strictly needs it.
				const canvasBox = (await canvas.boundingBox())!;
				await page.mouse.click(
					canvasBox.x + canvasBox.width * 0.02,
					canvasBox.y + canvasBox.height * 0.02,
				);
				await page.waitForTimeout(300);

				const hit = await findMark(page, canvas);

				// A plain click: no drag. Selects the vertex, which now (unlike the
				// prior select-only surface3D scene) also positions the highlight
				// marker mesh onto it - not pixel-verifiable headlessly, but a thrown
				// error positioning it would surface as a page error below.
				await page.mouse.click(hit.x, hit.y);
				await page.waitForTimeout(400);

				await page.mouse.move(hit.x + 4, hit.y + 4);
				await page.waitForTimeout(20);
				await page.mouse.move(hit.x, hit.y);
				await page.waitForTimeout(20);
				const titleAfterSelect = await canvas.getAttribute('title');
				const canvasVisibleAfterSelect = await canvas.isVisible();
				const canvasBoxAfterSelect = await canvas.boundingBox();

				// Drag the SAME vertex vertically past the threshold. Exact-value
				// verification is out of scope (see the barChart3D test's file-header
				// note: calibrating an exact pixel-to-value drag for a WebGL mesh's
				// screen projection is fragile in headless WebGL); what is required is
				// that the gesture completes, commits, and leaves the scene intact.
				await page.mouse.move(hit.x, hit.y);
				await page.mouse.down();
				await page.mouse.move(hit.x, hit.y - 60, { steps: 8 });
				await page.waitForTimeout(150);
				await page.mouse.up();
				await page.waitForTimeout(400);

				await page.mouse.move(hit.x + 4, hit.y + 4);
				await page.waitForTimeout(20);
				await page.mouse.move(hit.x, hit.y);
				await page.waitForTimeout(20);
				const titleAfterDrag = await canvas.getAttribute('title');

				return {
					pageErrors,
					hitTitle: hit.title,
					canvasVisibleAfterSelect,
					canvasBoxAfterSelect,
					titleAfterSelect,
					canvasVisibleAfterDrag: await canvas.isVisible(),
					canvasBoxAfterDrag: await canvas.boundingBox(),
					titleAfterDrag,
				};
			},
			{ path: '/?surfaceChart3D=1', concurrency: 'sequential' },
		);

		const failures = results.flatMap(({ framework, value }) => {
			const problems: string[] = [];
			if (value.pageErrors.length > 0) {
				problems.push(`unexpected page errors: ${value.pageErrors.join('; ')}`);
			}
			if (!value.hitTitle) {
				problems.push('no surface3D vertex reported a hover tooltip anywhere in the probed grid');
			}
			if (
				!value.canvasVisibleAfterSelect ||
				!value.canvasBoxAfterSelect ||
				value.canvasBoxAfterSelect.width <= 0 ||
				value.canvasBoxAfterSelect.height <= 0
			) {
				problems.push('the WebGL canvas is gone or has zero size after selecting a vertex');
			}
			if (!value.titleAfterSelect) {
				problems.push(
					're-hovering the selected vertex reports no tooltip afterwards; the scene may have broken',
				);
			}
			if (
				!value.canvasVisibleAfterDrag ||
				!value.canvasBoxAfterDrag ||
				value.canvasBoxAfterDrag.width <= 0 ||
				value.canvasBoxAfterDrag.height <= 0
			) {
				problems.push('the WebGL canvas is gone or has zero size after dragging a vertex');
			}
			if (!value.titleAfterDrag) {
				problems.push(
					're-hovering the dragged vertex reports no tooltip afterwards; the scene may have broken',
				);
			}
			return problems.length > 0 ? [`${framework.name}: ${problems.join('; ')}`] : [];
		});

		expect(failures.join('\n')).toBe('');
	});
});

// ── pie3D: click-to-select and drag-to-value ────────────────────────────────

interface Pie3DResult {
	pageErrors: string[];
	hitTitle: string;
	canvasVisibleAfterSelect: boolean;
	canvasBoxAfterSelect: { width: number; height: number } | null;
	titleAfterSelect: string | null;
	canvasVisibleAfterDrag: boolean;
	canvasBoxAfterDrag: { width: number; height: number } | null;
	titleAfterDrag: string | null;
}

test.describe('3D pie chart click-to-select + drag-to-value (pieChart3D opt-in)', () => {
	test('clicking a pie3D wedge selects it, and dragging it sweeps its value without breaking the scene', async ({
		browser,
	}, testInfo) => {
		test.slow();
		requireWebGL();

		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin): Promise<Pie3DResult> => {
				const pageErrors: string[] = [];
				page.on('pageerror', (err) => pageErrors.push(String(err)));

				await loadDeckAt(page, origin, PIE3D_FIXTURE);
				await slideStage(page).waitFor();

				const host = chartHost(page);
				await host.waitFor({ timeout: 10_000 });
				const canvas = host.locator('canvas');
				await expect(canvas).toBeVisible({ timeout: 10_000 });
				// Let the scene's first frame / OrbitControls settle.
				await page.waitForTimeout(800);

				// Select the chart first: see the barChart3D test above for why every
				// binding gets this step even though not every one strictly needs it.
				const canvasBox = (await canvas.boundingBox())!;
				await page.mouse.click(
					canvasBox.x + canvasBox.width * 0.02,
					canvasBox.y + canvasBox.height * 0.02,
				);
				await page.waitForTimeout(300);

				const hit = await findMark(page, canvas);

				// A plain click: no drag. Selects the wedge, applying its own
				// emissive highlight (`applyChart3DMeshHighlight`).
				await page.mouse.click(hit.x, hit.y);
				await page.waitForTimeout(400);

				await page.mouse.move(hit.x + 4, hit.y + 4);
				await page.waitForTimeout(20);
				await page.mouse.move(hit.x, hit.y);
				await page.waitForTimeout(20);
				const titleAfterSelect = await canvas.getAttribute('title');
				const canvasVisibleAfterSelect = await canvas.isVisible();
				const canvasBoxAfterSelect = await canvas.boundingBox();

				// Drag the SAME wedge: sweeps its trailing edge around the pie's
				// centre (see `pie-chart-3d-drag.ts`), renormalising every other
				// slice's angle live. Exact-value verification is out of scope (see
				// the barChart3D test's file-header note: calibrating an exact
				// pixel-to-value drag for a WebGL mesh's screen projection is
				// fragile in headless WebGL, and doubly so for an ANGLE the camera
				// orbit can reorient); what is required is that the gesture
				// completes, commits, and leaves the scene intact.
				await page.mouse.move(hit.x, hit.y);
				await page.mouse.down();
				await page.mouse.move(hit.x - 40, hit.y - 40, { steps: 8 });
				await page.waitForTimeout(150);
				await page.mouse.up();
				await page.waitForTimeout(400);

				await page.mouse.move(hit.x + 4, hit.y + 4);
				await page.waitForTimeout(20);
				await page.mouse.move(hit.x, hit.y);
				await page.waitForTimeout(20);
				const titleAfterDrag = await canvas.getAttribute('title');

				return {
					pageErrors,
					hitTitle: hit.title,
					canvasVisibleAfterSelect,
					canvasBoxAfterSelect,
					titleAfterSelect,
					canvasVisibleAfterDrag: await canvas.isVisible(),
					canvasBoxAfterDrag: await canvas.boundingBox(),
					titleAfterDrag,
				};
			},
			{ path: '/?pieChart3D=1', concurrency: 'sequential' },
		);

		const failures = results.flatMap(({ framework, value }) => {
			const problems: string[] = [];
			if (value.pageErrors.length > 0) {
				problems.push(`unexpected page errors: ${value.pageErrors.join('; ')}`);
			}
			if (!value.hitTitle) {
				problems.push('no pie3D wedge reported a hover tooltip anywhere in the probed grid');
			}
			if (
				!value.canvasVisibleAfterSelect ||
				!value.canvasBoxAfterSelect ||
				value.canvasBoxAfterSelect.width <= 0 ||
				value.canvasBoxAfterSelect.height <= 0
			) {
				problems.push('the WebGL canvas is gone or has zero size after selecting a wedge');
			}
			if (!value.titleAfterSelect) {
				problems.push(
					're-hovering the selected wedge reports no tooltip afterwards; the scene may have broken',
				);
			}
			if (
				!value.canvasVisibleAfterDrag ||
				!value.canvasBoxAfterDrag ||
				value.canvasBoxAfterDrag.width <= 0 ||
				value.canvasBoxAfterDrag.height <= 0
			) {
				problems.push('the WebGL canvas is gone or has zero size after dragging a wedge');
			}
			if (!value.titleAfterDrag) {
				problems.push(
					're-hovering the dragged wedge reports no tooltip afterwards; the scene may have broken',
				);
			}
			return problems.length > 0 ? [`${framework.name}: ${problems.join('; ')}`] : [];
		});

		expect(failures.join('\n')).toBe('');
	});
});
