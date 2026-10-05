/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * A 3D SmartArt behaves on the canvas like a 2D one, also once it has been
 * rotated: turning the element must not redraw the scene at the turned
 * bounding box's shape, a double-click on a node still opens the text editor,
 * and hovering a node offers the same fill swatches the 2D diagram does.
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { fixture, loadDeckAt, slideStage, viewport } from './support/deck';

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

async function openDiagram(page: Page): Promise<Locator> {
	await loadDeckAt(page, '/?smartArt3D=1', fixture('three-d-parity/three-d-smartart.pptx'));
	const view = slideStage(page).locator('pptx-three-view').first();
	await view.waitFor({ state: 'attached', timeout: 30_000 });
	await expect.poll(async () => view.getAttribute('data-state'), { timeout: 30_000 }).toBe('ready');
	return view;
}

/** Select the diagram and turn it with the rotate knob. */
async function rotate(page: Page, view: Locator): Promise<void> {
	const box = await view.boundingBox();
	if (!box) {
		throw new Error('the 3D view has no box');
	}
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	const knob = viewport(page)
		.getByRole('button', { name: /^rotate element$/iu })
		.first();
	await expect(knob).toBeVisible();
	const k = await knob.boundingBox();
	if (!k) {
		throw new Error('the rotate knob has no box');
	}
	await page.mouse.move(k.x + k.width / 2, k.y + k.height / 2);
	await page.mouse.down();
	await page.mouse.move(k.x + k.width / 2 + 200, k.y + k.height / 2 + 120, { steps: 8 });
	await page.mouse.up();
}

/**
 * The centre of the first laid-out node of the edited diagram, and its id. A
 * point under a selection handle is skipped: the handles' hit areas reach well
 * into the element and take the pointer first, as they should.
 */
async function firstNode(
	page: Page,
): Promise<{ x: number; y: number; w: number; h: number; id: string }> {
	const node = await slideStage(page).evaluate((stage) => {
		for (const el of stage.querySelectorAll('[data-smartart-node-id]')) {
			const r = el.getBoundingClientRect();
			const id = el.getAttribute('data-smartart-node-id');
			const x = r.x + r.width / 2;
			const y = r.y + r.height / 2;
			if (
				r.width > 4 &&
				r.height > 4 &&
				id &&
				!document.elementFromPoint(x, y)?.closest('button')
			) {
				return { x, y, w: r.width, h: r.height, id };
			}
		}
		return null;
	});
	if (!node) {
		throw new Error('no SmartArt node is laid out');
	}
	return node;
}

test('turning a 3D SmartArt keeps the scene at the diagram shape', async ({ page }) => {
	test.setTimeout(180_000);
	test.skip(!webglAvailable, 'headless Chromium has no WebGL context in this environment');
	const view = await openDiagram(page);
	const shape = async () =>
		view.evaluate((el) => {
			const canvas = (el as unknown as { canvas: HTMLCanvasElement }).canvas;
			return { width: canvas.width / canvas.height, layout: el.clientWidth / el.clientHeight };
		});
	const before = await shape();
	await rotate(page, view);
	const after = await shape();
	// The backing store follows the element's own box, not the turned bounding box.
	expect(Math.abs(after.width - after.layout) / after.layout).toBeLessThan(0.03);
	expect(Math.abs(after.width - before.width) / before.width).toBeLessThan(0.03);
});

test('a rotated 3D SmartArt node is still edited with a double-click', async ({ page }) => {
	test.setTimeout(180_000);
	test.skip(!webglAvailable, 'headless Chromium has no WebGL context in this environment');
	const view = await openDiagram(page);
	await rotate(page, view);
	const node = await firstNode(page);
	await page.mouse.dblclick(node.x, node.y);
	const editor = page.locator('[data-pptx-viewport] textarea:visible');
	await expect(editor).toHaveCount(1);
	await expect(editor).toBeFocused();
	await expectEditorOverNode(editor, node);
});

/** The editor opens over the node it edits, not somewhere the zoom moved it to. */
async function expectEditorOverNode(
	editor: Locator,
	node: { x: number; y: number; w: number; h: number },
): Promise<void> {
	const box = await editor.boundingBox();
	if (!box) {
		throw new Error('the editor has no box');
	}
	expect(Math.abs(box.x + box.width / 2 - node.x)).toBeLessThan(node.w / 4);
	expect(Math.abs(box.y + box.height / 2 - node.y)).toBeLessThan(node.h / 4);
}

test('a 3D SmartArt node editor opens over the node', async ({ page }) => {
	test.setTimeout(180_000);
	test.skip(!webglAvailable, 'headless Chromium has no WebGL context in this environment');
	await openDiagram(page);
	const node = await firstNode(page);
	await page.mouse.dblclick(node.x, node.y);
	const editor = page.locator('[data-pptx-viewport] textarea:visible');
	await expect(editor).toHaveCount(1);
	await expectEditorOverNode(editor, node);
});

test('hovering a 3D SmartArt node offers the fill swatches, and a pick is an edit', async ({
	page,
}) => {
	test.setTimeout(180_000);
	test.skip(!webglAvailable, 'headless Chromium has no WebGL context in this environment');
	await openDiagram(page);
	const undo = page.getByRole('button', { name: /^undo/iu }).first();
	await expect(undo).toBeDisabled();
	const node = await firstNode(page);
	await page.mouse.move(node.x - 40, node.y - 40);
	await page.mouse.move(node.x, node.y, { steps: 5 });
	// By label rather than role: a binding's input layer over the scene is aria-hidden.
	const swatch = slideStage(page).locator('button[aria-label*="fill" i]').first();
	await expect(swatch).toBeVisible();
	await swatch.click();
	await expect(undo).toBeEnabled();
});
