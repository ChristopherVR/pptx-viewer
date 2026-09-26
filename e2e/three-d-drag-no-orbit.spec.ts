/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Dragging a 3D SmartArt or 3D chart across the slide must not turn it.
 *
 * `<pptx-three-view>` used to hand its scenes three.js OrbitControls bound to
 * the same pointer layer the editor's move gesture starts on, so a drag that
 * moved the element also orbited the camera and the diagram visibly rotated.
 * PowerPoint never orbits a chart or SmartArt; the view controller now mounts
 * every scene without an orbit (`packages/shared/src/three-view/view-controller.ts`).
 *
 * The check reads the view's own 2D canvas before a drag and again while the
 * button is still held (an orbit snapped back on release, so a check after
 * `mouseup` passed with the bug present): moving the element leaves its
 * picture unchanged, an orbit repaints most of it.
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { fixture, loadDeckAt, slideStage } from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

/** Share of the sample grid a drag may change (anti-aliasing noise, not a turn). */
const MAX_CHANGED_FRACTION = 0.05;

let webglAvailable = true;

test.beforeAll(async ({ browser }) => {
	const page = await browser.newPage();
	webglAvailable = await page.evaluate(() => {
		const canvas = document.createElement('canvas');
		return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
	});
	await page.close();
});

async function readyView(page: Page): Promise<Locator> {
	const view = slideStage(page).locator('pptx-three-view').first();
	await view.waitFor({ state: 'attached', timeout: 30_000 });
	await expect.poll(async () => view.getAttribute('data-state'), { timeout: 30_000 }).toBe('ready');
	// Let the canvas settle before sampling: a cold demo can still be resizing
	// it for the scene's overflow, and a late label texture or font can still
	// repaint it after `ready`. Wait for two identical samples of its size and
	// pixels (a failure under a long two-worker run came from sampling early).
	const size = (): Promise<string> =>
		view.evaluate((el) => {
			const canvas = el.shadowRoot?.querySelector('canvas');
			const data = canvas?.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data;
			if (!canvas || !data) {
				return '';
			}
			let sum = 0;
			for (let i = 0; i < data.length; i += 16) {
				sum = (sum + data[i] * (i + 1)) % 1_000_000_007;
			}
			return `${canvas.width}x${canvas.height}:${sum}`;
		});
	let last = '';
	await expect
		.poll(
			async () => {
				const now = await size();
				const stable = now !== '' && now === last;
				last = now;
				return stable;
			},
			{ timeout: 15_000, intervals: [400] },
		)
		.toBe(true);
	await page.waitForTimeout(400);
	return view;
}

/** Keep a copy of the view's canvas pixels on the page. */
async function snapshot(view: Locator): Promise<void> {
	await view.evaluate((el) => {
		const canvas = el.shadowRoot?.querySelector('canvas');
		const data = canvas?.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height);
		(window as unknown as { __viewBefore?: ImageData }).__viewBefore = data;
	});
}

/**
 * Share of a 64 x 36 grid of relative positions whose colour differs from
 * {@link snapshot}. Sampling by relative position, not by pixel, keeps a
 * canvas resized by a few pixels mid-drag (a layout or overflow update) from
 * reading as a completely different picture, which comparing raw pixel
 * arrays of different sizes did; an orbit still changes most of the grid.
 */
async function changedFraction(view: Locator): Promise<number> {
	return view.evaluate((el) => {
		const before = (window as unknown as { __viewBefore?: ImageData }).__viewBefore;
		const canvas = el.shadowRoot?.querySelector('canvas');
		const after = canvas?.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height);
		if (!before || !after || before.width === 0 || after.width === 0) {
			return 1;
		}
		const at = (img: ImageData, u: number, v: number): number => {
			const x = Math.min(img.width - 1, Math.floor(u * img.width));
			const y = Math.min(img.height - 1, Math.floor(v * img.height));
			return (y * img.width + x) * 4;
		};
		const cols = 64;
		const rows = 36;
		let changed = 0;
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const u = (c + 0.5) / cols;
				const v = (r + 0.5) / rows;
				const i = at(before, u, v);
				const j = at(after, u, v);
				let d = 0;
				for (let k = 0; k < 4; k++) {
					d += Math.abs(before.data[i + k] - after.data[j + k]);
				}
				if (d > 48) {
					changed++;
				}
			}
		}
		return changed / (cols * rows);
	});
}

/** Press inside the view near its top-left corner (clear of chart marks) and drag, button held. */
async function pressAndDrag(page: Page, view: Locator): Promise<void> {
	const box = await view.boundingBox();
	if (!box) {
		throw new Error('3D view has no box');
	}
	const x = box.x + Math.min(12, box.width / 4);
	const y = box.y + Math.min(12, box.height / 4);
	await page.mouse.move(x, y);
	await page.mouse.down();
	for (let i = 1; i <= 12; i++) {
		await page.mouse.move(x + i * 8, y + i * 4);
	}
	await page.waitForTimeout(400);
}

const CASES = [
	{
		name: 'a 3D SmartArt',
		deck: 'three-d-parity/three-d-smartart.pptx',
		url: '/?smartArt3D=1',
	},
	{
		name: 'a 3D chart',
		deck: 'three-d-parity/three-d-charts.pptx',
		url: '/?barChart3D=1&lineChart3D=1&areaChart3D=1&pieChart3D=1&surfaceChart3D=1',
	},
];

function dragTest(c: (typeof CASES)[number]): void {
	test(`${c.name} keeps its picture while dragged`, async ({ page }) => {
		test.setTimeout(180_000);
		test.skip(!webglAvailable, 'headless Chromium has no WebGL context in this environment');
		await loadDeckAt(page, c.url, fixture(c.deck));
		const view = await readyView(page);
		await snapshot(view);
		await pressAndDrag(page, view);
		const changed = await changedFraction(view);
		await page.mouse.up();
		expect(changed).toBeLessThan(MAX_CHANGED_FRACTION);
	});
}

test.describe('dragging a 3D view does not rotate it', () => {
	dragTest(CASES[0]);
	dragTest(CASES[1]);
});
