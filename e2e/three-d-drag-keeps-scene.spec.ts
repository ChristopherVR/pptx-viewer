/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Moving a 3D SmartArt or chart must not reload its scene on every pointer
 * move, on the canvas or in the thumbnail rail.
 *
 * Vanilla rebuilds its stage and rail DOM on every store change, and an
 * editor drag changes the store on every move, so each move created a new
 * `<pptx-three-view>` that reloaded its scene (`loading` -> `ready`): dozens
 * of rebuilds per drag, and a canvas that could read blank mid-drag. The
 * shared spec cache now keeps the spec across a position-only change
 * (`three-view/view-spec.ts`), the element keeps its scene when it is moved
 * within one task (`three-view/element.ts`), and Vanilla carries live views
 * across its rebuilds (`render/elements/three-view-reuse.ts`).
 *
 * The check counts `data-state="loading"` transitions on every view in the
 * page while the button is held, after the first move has selected the
 * element.
 */
import { expect, test } from '@playwright/test';

import { fixture, loadDeckAt, slideStage } from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

let webglAvailable = true;

test.beforeAll(async ({ browser }) => {
	const page = await browser.newPage();
	webglAvailable = await page.evaluate(() => {
		const canvas = document.createElement('canvas');
		return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
	});
	await page.close();
});

const CASES = [
	{ name: 'a 3D SmartArt', deck: 'three-d-parity/three-d-smartart.pptx', url: '/?smartArt3D=1' },
	{
		name: 'a 3D chart',
		deck: 'three-d-parity/three-d-charts.pptx',
		url: '/?barChart3D=1&lineChart3D=1&areaChart3D=1&pieChart3D=1&surfaceChart3D=1',
	},
];

function dragTest(c: (typeof CASES)[number]): void {
	test(`${c.name} keeps its scene while it is dragged`, async ({ page }) => {
		test.setTimeout(180_000);
		test.skip(!webglAvailable, 'headless Chromium has no WebGL context in this environment');
		await loadDeckAt(page, c.url, fixture(c.deck));
		const view = slideStage(page).locator('pptx-three-view').first();
		await view.waitFor({ state: 'attached', timeout: 30_000 });
		await expect
			.poll(async () => view.getAttribute('data-state'), { timeout: 30_000 })
			.toBe('ready');
		const box = await view.boundingBox();
		if (!box) {
			throw new Error('3D view has no box');
		}
		const x = box.x + Math.min(12, box.width / 4);
		const y = box.y + Math.min(12, box.height / 4);
		await page.mouse.move(x, y);
		await page.mouse.down();
		await page.mouse.move(x + 8, y + 4);
		await page.waitForTimeout(600);
		await page.evaluate(() => {
			const w = window as unknown as { __reloads: number };
			w.__reloads = 0;
			new MutationObserver((records) => {
				for (const record of records) {
					if ((record.target as Element).getAttribute('data-state') === 'loading') {
						w.__reloads++;
					}
				}
			}).observe(document.body, {
				subtree: true,
				attributes: true,
				attributeFilter: ['data-state'],
			});
		});
		for (let i = 2; i <= 14; i++) {
			await page.mouse.move(x + i * 8, y + i * 4);
		}
		await page.waitForTimeout(400);
		const reloads = await page.evaluate(
			() => (window as unknown as { __reloads: number }).__reloads,
		);
		await page.mouse.up();
		expect(reloads).toBe(0);
	});
}

test.describe('dragging a 3D view keeps its scene', () => {
	dragTest(CASES[0]);
	dragTest(CASES[1]);
});
