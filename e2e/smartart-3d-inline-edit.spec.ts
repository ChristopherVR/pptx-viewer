/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * A node of a 3D SmartArt is edited on the canvas like a 2D one: a
 * double-click on the node opens a text editor over it, and Enter commits.
 *
 * `<pptx-three-view>` keeps the 2D SVG only as its fallback, hidden once the
 * scene is up, so each binding lays an input surface over the scene. React,
 * Vue and Angular always had one; Svelte and Vanilla now add a second render
 * of the diagram with its SVG paint hidden (`smartart-3d-edit-layer.ts` in
 * shared strips its element markers).
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

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

/** A point over a SmartArt node that the browser really hits, and that node's id. */
async function hittableNode(page: Page): Promise<{ x: number; y: number; nodeId: string }> {
	const found = await slideStage(page).evaluate((stage) => {
		for (const node of stage.querySelectorAll('[data-smartart-node-id]')) {
			const box = node.getBoundingClientRect();
			for (const [fx, fy] of [
				[0.5, 0.5],
				[0.25, 0.5],
				[0.75, 0.5],
				[0.5, 0.3],
			]) {
				const x = box.left + box.width * fx;
				const y = box.top + box.height * fy;
				const hit = document.elementFromPoint(x, y)?.closest('[data-smartart-node-id]');
				const nodeId = hit?.getAttribute('data-smartart-node-id');
				if (hit && nodeId) {
					return { x, y, nodeId };
				}
			}
		}
		// A binding may keep its node groups out of hit-testing and resolve the
		// double-click itself (Angular walks `elementsFromPoint`): aim at the
		// centre of the first laid-out node then.
		for (const node of stage.querySelectorAll('[data-smartart-node-id]')) {
			const box = node.getBoundingClientRect();
			const nodeId = node.getAttribute('data-smartart-node-id');
			if (box.width > 4 && box.height > 4 && nodeId) {
				return { x: box.left + box.width / 2, y: box.top + box.height / 2, nodeId };
			}
		}
		return null;
	});
	if (!found) {
		throw new Error('no SmartArt node takes a pointer over the 3D view');
	}
	return found;
}

test('a 3D SmartArt node is edited on the canvas', async ({ page }) => {
	test.setTimeout(180_000);
	test.skip(!webglAvailable, 'headless Chromium has no WebGL context in this environment');
	await loadDeckAt(page, '/?smartArt3D=1', fixture('three-d-parity/three-d-smartart.pptx'));
	const view = slideStage(page).locator('pptx-three-view').first();
	await view.waitFor({ state: 'attached', timeout: 30_000 });
	await expect.poll(async () => view.getAttribute('data-state'), { timeout: 30_000 }).toBe('ready');

	const node = await hittableNode(page);
	await page.mouse.dblclick(node.x, node.y);
	const editor = page.locator('[data-pptx-viewport] textarea:visible');
	await expect(editor).toHaveCount(1);
	await expect(editor).toBeFocused();

	await editor.fill('Edited in 3D');
	await editor.press('Enter');
	await expect(editor).toHaveCount(0);
	await expect
		.poll(async () =>
			slideStage(page)
				.locator(`[data-smartart-node-id="${node.nodeId}"] text`)
				.allTextContents()
				// A wrapped label splits across <tspan>s, so compare without spaces.
				.then((texts) => texts.join('').replace(/\s+/gu, '')),
		)
		.toContain('Editedin3D');
});
