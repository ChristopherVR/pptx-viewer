/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * A turned scene-style SmartArt draws past its graphic frame, as PowerPoint
 * does (Brick Scene reaches above the frame, Bird's Eye Scene below it).
 *
 * `<pptx-three-view>` grows its canvas by the scene's projected overflow
 * (`packages/shared/src/three-view/view-overflow.ts`). This checks, in every
 * binding, that:
 *  - the view reports the overflow and its canvas really reaches past the
 *    element box on the expected side;
 *  - nothing between the view and the slide clips it (an `overflow: hidden`
 *    or paint-contained element wrapper would cut the render off again);
 *  - pointer input outside the element box does not land on the view, so the
 *    overflow never steals clicks from neighbouring elements.
 *
 * Ground truth: `e2e/fixtures/three-d-parity/three-d-smartart.pptx` (slide 10
 * Brick Scene, slide 14 Bird's Eye Scene of Basic Block List).
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { fixture, loadDeckAt, slideStage } from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

const DECK = fixture('three-d-parity/three-d-smartart.pptx');

let webglAvailable = true;

test.beforeAll(async ({ browser }) => {
	const page = await browser.newPage();
	webglAvailable = await page.evaluate(() => {
		const canvas = document.createElement('canvas');
		return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
	});
	await page.close();
});

function thumbnailFor(page: Page, slideNumber: number) {
	const byIndex = page.locator(`[data-slide-index="${slideNumber - 1}"]`).first();
	const byLabel = page.getByRole('button', { name: `Go to slide ${slideNumber}` }).first();
	return { byIndex, byLabel };
}

/**
 * Jump to a slide via whichever thumbnail-rail convention the binding uses.
 * The 112-slide deck's rail is windowed, so a far slide is reached by
 * stepping through the nearest rendered thumbnail first.
 */
async function gotoSlide(page: Page, slideNumber: number): Promise<void> {
	let reached = 0;
	for (let attempt = 0; attempt < 20; attempt++) {
		let step = slideNumber;
		let target = null;
		for (; step > reached; step--) {
			const { byIndex, byLabel } = thumbnailFor(page, step);
			const candidate = (await byIndex.count()) > 0 ? byIndex : byLabel;
			if ((await candidate.count()) > 0) {
				target = candidate;
				break;
			}
		}
		if (!target) {
			// The rail never rendered further thumbnails: step on with the
			// keyboard from the last slide reached.
			for (let i = reached; i < slideNumber; i++) {
				await page.keyboard.press('ArrowDown');
			}
			await expect(page.getByText(`Slide ${slideNumber} of`).first()).toBeVisible({
				timeout: 15_000,
			});
			return;
		}
		// A DOM click: the windowed rail keeps re-laying out while the 3D
		// thumbnails mount, so a pointer click waits on "stable" forever.
		await target.evaluate((el) => {
			// Scrolling the thumbnail to the rail's end makes a windowed rail
			// render the next ones.
			el.scrollIntoView({ block: 'end' });
			(el as HTMLElement).click();
			(el as HTMLElement).focus();
		});
		if (step === slideNumber) {
			return;
		}
		reached = step;
		await page.waitForTimeout(600);
	}
	throw new Error(`could not reach slide ${slideNumber}`);
}

interface OverflowProbe {
	insets: { top: number; right: number; bottom: number; left: number } | null;
	marked: boolean;
	/** How far the canvas reaches past the view box, CSS px (positive = past). */
	reach: { top: number; bottom: number };
	/** Ancestors (up to the slide) that would clip the canvas. */
	clippers: string[];
	/** What a point just outside the view box, inside the canvas, hits. */
	hitsView: boolean | null;
}

async function probeOverflow(page: Page, side: 'top' | 'bottom'): Promise<OverflowProbe> {
	const view = slideStage(page).locator('pptx-three-view').first();
	await view.waitFor({ state: 'attached', timeout: 20_000 });
	await expect.poll(async () => view.getAttribute('data-state'), { timeout: 30_000 }).toBe('ready');
	await expect
		.poll(async () => view.evaluate((el) => el.hasAttribute('data-overflow')), { timeout: 10_000 })
		.toBe(true)
		.catch(() => undefined);
	return view.evaluate((el, which) => {
		const host = el as HTMLElement & { overflowInsets?: OverflowProbe['insets'] };
		const canvas = host.shadowRoot?.querySelector('canvas');
		const box = host.getBoundingClientRect();
		const drawn = canvas?.getBoundingClientRect() ?? box;
		const clippers: string[] = [];
		const stage = document.querySelector('[aria-roledescription="slide"]');
		for (let node = host.parentElement; node && node !== stage; node = node.parentElement) {
			const style = getComputedStyle(node);
			const rect = node.getBoundingClientRect();
			const clips =
				/hidden|clip/u.test(style.overflow + style.overflowX + style.overflowY) ||
				/paint|strict|content/u.test(style.contain);
			const cuts = rect.top > drawn.top + 1 || rect.bottom < drawn.bottom - 1;
			if (clips && cuts) {
				clippers.push(`${node.tagName.toLowerCase()}.${node.className}`);
			}
		}
		const probeY = which === 'top' ? box.top - 4 : box.bottom + 4;
		const reachesProbe = which === 'top' ? drawn.top < probeY : drawn.bottom > probeY;
		const hit = reachesProbe ? document.elementFromPoint(box.left + box.width / 2, probeY) : null;
		return {
			insets: host.overflowInsets ?? null,
			marked: host.hasAttribute('data-overflow'),
			reach: { top: box.top - drawn.top, bottom: drawn.bottom - box.bottom },
			clippers,
			hitsView: reachesProbe ? Boolean(hit && (hit === host || host.contains(hit))) : null,
		};
	}, side);
}

function overflowTest(slide: number, side: 'top' | 'bottom', name: string): void {
	test(name, async ({ page }) => {
		test.setTimeout(180_000);
		test.skip(!webglAvailable, 'headless Chromium has no WebGL context in this environment');
		// The 112-slide deck takes longer than the default load wait.
		await loadDeckAt(page, '/?smartArt3D=1', DECK);
		await gotoSlide(page, slide);
		const probe = await probeOverflow(page, side);
		expect(probe.marked).toBeTruthy();
		expect(probe.insets?.[side] ?? 0).toBeGreaterThan(0.02);
		expect(probe.reach[side]).toBeGreaterThan(4);
		expect(probe.clippers).toStrictEqual([]);
		expect(probe.hitsView).toBeFalsy();
	});
}

test.describe('3D SmartArt draws a turned diagram past its frame', () => {
	overflowTest(10, 'top', 'Brick Scene reaches above the frame');
	overflowTest(14, 'bottom', "Bird's Eye Scene reaches below the frame");
});
