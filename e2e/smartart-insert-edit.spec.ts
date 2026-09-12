/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * SmartArt insert + edit E2E tests.
 *
 * Validates that a SmartArt diagram can be inserted via the Insert tab dialog,
 * then edited through the inspector panel: changing node text, switching the
 * layout type (e.g. pyramid to process), and changing the colour scheme. The
 * spec runs across React, Vue, Angular, Vanilla, and Svelte via the neutral DOM
 * contract (aria-labels, roles, `data-testid`, `data-pptx-element`).
 *
 * Run: bunx playwright test smartart-insert-edit
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { savePptxViaBackstage } from './save-pptx';
import { loadDeck as loadDeckFile, resetTabSession } from './support/deck';

const fixturePath = resolve(fileURLToPath(new URL('./fixtures/sample-deck.pptx', import.meta.url)));
const drawingFixturePath = resolve(
	fileURLToPath(new URL('./fixtures/smartart-build-reveal.pptx', import.meta.url)),
);

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Load the sample deck and wait for the viewer to render at least one element. */
async function loadDeck(page: Page): Promise<void> {
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[data-pptx-element="true"]').first().waitFor();
	await page.waitForTimeout(500);
}

/**
 * Navigate to the Insert tab through the shared toolbar contract. Bindings may
 * expose ribbon entries as tabs or buttons, so the locator accepts either role.
 */
async function switchToInsertTab(page: Page): Promise<void> {
	const toolbar = page.getByRole('toolbar', { name: 'Presentation toolbar' });
	const insertTab = toolbar.getByRole('tab', { name: 'Insert', exact: true });
	await insertTab.click();
	await page.waitForTimeout(200);
}

/**
 * Click the SmartArt button in the Insert section. Its shared accessible name
 * comes from `pptx.ribbon.smartArt`.
 */
async function clickSmartArtButton(page: Page): Promise<void> {
	const btn = page.getByRole('button', { name: 'SmartArt' });
	await btn.click();
	await page.waitForTimeout(300);
}

async function insertSmartArtPreset(page: Page, pattern?: RegExp): Promise<void> {
	await clickSmartArtButton(page);
	const dialog = page.getByRole('dialog', { name: /Insert SmartArt/iu });
	await expect(dialog).toBeVisible();
	if (pattern) {
		const category = dialog.getByRole('button').filter({ hasText: pattern }).first();
		await expect(category).toBeVisible();
		await category.click();
		await page.waitForTimeout(200);
	}
	await dialog.getByRole('option').first().click();
	await dialog.getByRole('button', { name: /^Insert$/iu }).click();
	await page.waitForTimeout(600);
}

/**
 * Open the inspector panel, accounting for bindings that start it open.
 */
async function openInspector(page: Page): Promise<void> {
	const inspector = page.locator('[data-pptx-inspector]:visible').first();
	if (!(await inspector.isVisible().catch(() => false))) {
		const toggleBtn = page.getByRole('button', { name: 'Toggle inspector panel', exact: true });
		await expect(toggleBtn).toBeVisible();
		await toggleBtn.click();
		await page.waitForTimeout(200);
	}
	await expect(inspector).toBeVisible();
}

function currentSmartArt(page: Page): Locator {
	return page.locator('[data-pptx-viewport] [data-testid^="smartart-"]').first();
}

function firstSmartArtNode(smartArt: Locator): Locator {
	return smartArt.locator('[data-smartart-node-id]').first();
}

async function renderedNodeText(smartArt: Locator): Promise<string> {
	const labels = await firstSmartArtNode(smartArt).locator('text').allTextContents();
	return labels.join(' ').replace(/\s+/g, ' ').trim();
}

async function unobstructedNodePoint(node: Locator): Promise<{ x: number; y: number }> {
	const point = await node.evaluate((element) => {
		const box = element.getBoundingClientRect();
		for (const yFraction of [0.8, 0.65, 0.5, 0.35, 0.2]) {
			for (const xFraction of [0.25, 0.5, 0.75, 0.1, 0.9]) {
				const x = box.left + box.width * xFraction;
				const y = box.top + box.height * yFraction;
				if (document.elementFromPoint(x, y)?.closest('[data-smartart-node-id]') === element) {
					return { x, y };
				}
			}
		}
		return null;
	});
	if (!point) {
		throw new Error('SmartArt node has no unobstructed browser hit target');
	}
	return point;
}

async function openFocusedNodeEditor(
	page: Page,
	smartArt: Locator,
): Promise<{
	editor: Locator;
	diagramBox: NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>;
}> {
	const point = await unobstructedNodePoint(firstSmartArtNode(smartArt));
	const diagramBox = await smartArt.boundingBox();
	expect(diagramBox, 'SmartArt diagram should have a rendered box').not.toBeNull();
	await page.mouse.dblclick(point.x, point.y);

	const editor = page.locator('[data-pptx-viewport] textarea:visible');
	await expect(editor).toHaveCount(1);
	await expect(editor).toBeFocused();
	return { editor, diagramBox: diagramBox! };
}

async function expectCaretClickDoesNotMoveDiagram(
	editor: Locator,
	smartArt: Locator,
	diagramBox: NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>,
): Promise<void> {
	const editorBox = await editor.boundingBox();
	expect(editorBox, 'SmartArt editor should have a rendered box').not.toBeNull();
	await editor.click({
		position: { x: Math.max(1, editorBox!.width * 0.75), y: editorBox!.height / 2 },
	});
	await expect(editor).toBeFocused();
	await expect
		.poll(async () => {
			const current = await smartArt.boundingBox();
			return current
				? {
						x: Math.round(current.x),
						y: Math.round(current.y),
						width: Math.round(current.width),
						height: Math.round(current.height),
					}
				: null;
		})
		.toStrictEqual({
			x: Math.round(diagramBox.x),
			y: Math.round(diagramBox.y),
			width: Math.round(diagramBox.width),
			height: Math.round(diagramBox.height),
		});
}

async function blurNodeEditor(page: Page): Promise<void> {
	await page
		.getByRole('toolbar', { name: 'Presentation toolbar' })
		.getByRole('tab', { name: 'Home', exact: true })
		.click();
	await expect(page.locator('[data-pptx-viewport] textarea:visible')).toHaveCount(0);
}

async function clickHistory(page: Page, name: 'Undo' | 'Redo'): Promise<void> {
	const button = page.getByRole('button', { name, exact: true });
	await expect(button).toBeEnabled();
	await button.click();
}

/** Bindings intentionally use either tight label bounds or the whole node. */
async function expectLocalNodeEditor(node: Locator, editor: Locator): Promise<void> {
	const candidates = await node.evaluate((element) => {
		const boxes = [element, element.querySelector('text')].flatMap((source) => {
			if (!(source instanceof SVGGraphicsElement)) {
				return [];
			}
			const box = source.getBBox();
			const matrix = source.getCTM();
			if (!matrix) {
				return [];
			}
			const points = [
				[box.x, box.y],
				[box.x + box.width, box.y],
				[box.x, box.y + box.height],
				[box.x + box.width, box.y + box.height],
			].map(([x, y]) => ({
				x: matrix.a * x + matrix.c * y + matrix.e,
				y: matrix.b * x + matrix.d * y + matrix.f,
			}));
			const left = Math.min(...points.map(({ x }) => x));
			const top = Math.min(...points.map(({ y }) => y));
			return [
				{
					left,
					top,
					width: Math.max(...points.map(({ x }) => x)) - left,
					height: Math.max(...points.map(({ y }) => y)) - top,
				},
			];
		});
		return boxes.flatMap((box) => [
			box,
			{ left: box.left - 4, top: box.top - 4, width: box.width + 8, height: box.height + 8 },
			{
				left: box.left - 4,
				top: box.top - 4,
				width: Math.max(48, box.width + 8),
				height: Math.max(30, box.height + 8),
			},
		]);
	});
	const actual = await editor.evaluate((element) => {
		const style = getComputedStyle(element);
		return {
			left: parseFloat(style.left),
			top: parseFloat(style.top),
			width: parseFloat(style.width),
			height: parseFloat(style.height),
		};
	});
	expect(
		candidates.some((box) =>
			(['left', 'top', 'width', 'height'] as const).every(
				(key) => Math.abs(box[key] - actual[key]) < 1,
			),
		),
		JSON.stringify({ actual, candidates }),
	).toBeTruthy();
}

function collectRuntimeErrors(page: Page): string[] {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(`${error.name}: ${error.message}`));
	page.on('console', (message) => {
		if (message.type() === 'error') {
			errors.push(message.text());
		}
	});
	return errors;
}

async function exerciseDirectKeyboardNodeEdit(
	page: Page,
	smartArt: Locator,
	editedText: string,
): Promise<void> {
	const authoredText = await renderedNodeText(smartArt);
	expect(authoredText).not.toBe('');
	const { editor, diagramBox } = await openFocusedNodeEditor(page, smartArt);
	await page.keyboard.type(editedText);
	await expect(editor).toHaveValue(editedText);
	await expectCaretClickDoesNotMoveDiagram(editor, smartArt, diagramBox);
	await blurNodeEditor(page);
	await expect.poll(() => renderedNodeText(smartArt)).toBe(editedText);

	await clickHistory(page, 'Undo');
	await expect.poll(() => renderedNodeText(smartArt)).toBe(authoredText);
	await clickHistory(page, 'Redo');
	await expect.poll(() => renderedNodeText(smartArt)).toBe(editedText);

	const download = await savePptxViaBackstage(page);
	const savedPath = await download.path();
	expect(savedPath, 'the browser should retain the saved SmartArt deck').not.toBeNull();
	await loadDeckFile(page, savedPath!);
	await expect.poll(() => renderedNodeText(currentSmartArt(page))).toBe(editedText);
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('smartart insert and edit', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	test('keeps the node editor in local coordinates at fitted and enlarged zoom', async ({
		page,
	}) => {
		const runtimeErrors = collectRuntimeErrors(page);
		await loadDeck(page);
		await switchToInsertTab(page);
		await insertSmartArtPreset(page);
		const smartArt = currentSmartArt(page);
		for (const enlarge of [false, true]) {
			if (enlarge) {
				await page.getByRole('button', { name: /Zoom in/iu }).click();
				await page.getByRole('button', { name: /Zoom in/iu }).click();
			}
			const labelBox = await firstSmartArtNode(smartArt).locator('text').first().boundingBox();
			expect(labelBox, 'The label must be visibly rendered before editing').not.toBeNull();
			const { editor } = await openFocusedNodeEditor(page, smartArt);
			await expectLocalNodeEditor(firstSmartArtNode(smartArt), editor);
			const editorBox = await editor.boundingBox();
			expect(editorBox).not.toBeNull();
			// Also check screen overlap independently of the local-coordinate calculation.
			for (const [position, size] of [
				['x', 'width'],
				['y', 'height'],
			] as const) {
				expect(labelBox![size]).toBeGreaterThan(0);
				expect(editorBox![size]).toBeGreaterThan(0);
				const overlap =
					Math.min(labelBox![position] + labelBox![size], editorBox![position] + editorBox![size]) -
					Math.max(labelBox![position], editorBox![position]);
				expect(overlap).toBeGreaterThanOrEqual(Math.min(labelBox![size], editorBox![size]) * 0.9);
			}
			await blurNodeEditor(page);
		}
		expect(runtimeErrors).toStrictEqual([]);
	});

	test('inserts SmartArt via dialog and verifies it renders on the slide', async ({ page }) => {
		await loadDeck(page);
		await switchToInsertTab(page);
		await insertSmartArtPreset(page, /Hierarchy/iu);

		// Verify the SmartArt element was added to the slide.
		// SmartArt renderers emit a data-testid like "smartart-hierarchy",
		// "smartart-list", etc., or the element wrapper has aria-roledescription.
		const smartArtOnSlide = page
			.locator('[data-pptx-viewport]')
			.locator('[data-testid^="smartart-"]');
		await expect(smartArtOnSlide.first()).toBeVisible({ timeout: 5000 });
	});

	test('edits SmartArt node text via the inspector panel', async ({ page }) => {
		await loadDeck(page);
		await switchToInsertTab(page);
		await insertSmartArtPreset(page);

		// Select the newly inserted SmartArt element on the canvas.
		const smartArt = page
			.locator('[data-pptx-viewport]')
			.locator('[data-testid^="smartart-"]')
			.first();
		await expect(smartArt).toBeVisible({ timeout: 5000 });

		// Click on the element wrapper (the one with data-pptx-element) to select it.
		const elementWrapper = smartArt
			.locator('xpath=ancestor-or-self::*[@data-pptx-element="true"]')
			.first();
		await expect(elementWrapper).toBeVisible();
		await elementWrapper.click();
		await page.waitForTimeout(300);

		// Open the inspector panel.
		await openInspector(page);
		await page.waitForTimeout(300);

		// Record the initial layout data-testid before editing.
		const initialTestId = await smartArt.getAttribute('data-testid');

		const targetInput = page.locator('[data-testid="smartart-node-text"]').first();
		await expect(targetInput).toBeVisible();
		await targetInput.fill('Updated Node');
		await targetInput.press('Tab');
		await page.waitForTimeout(300);

		const updatedText = page
			.locator('[data-pptx-viewport]')
			.locator('[data-testid^="smartart-"]')
			.filter({ hasText: 'Updated Node' })
			.first();
		await expect(updatedText).toBeVisible({ timeout: 3000 });

		const postEditTestId = await page
			.locator('[data-pptx-viewport]')
			.locator('[data-testid^="smartart-"]')
			.first()
			.getAttribute('data-testid');
		expect(postEditTestId).toBe(initialTestId);
	});

	test('switches SmartArt layout type (shape gets updated)', async ({ page }) => {
		await loadDeck(page);
		await switchToInsertTab(page);
		await insertSmartArtPreset(page);

		// Select the SmartArt element.
		const smartArt = page
			.locator('[data-pptx-viewport]')
			.locator('[data-testid^="smartart-"]')
			.first();
		await expect(smartArt).toBeVisible({ timeout: 5000 });

		const elementWrapper = smartArt
			.locator('xpath=ancestor-or-self::*[@data-pptx-element="true"]')
			.first();
		await expect(elementWrapper).toBeVisible();
		await elementWrapper.click();
		await page.waitForTimeout(300);

		// Open inspector.
		await openInspector(page);
		await page.waitForTimeout(300);

		// Record the initial layout's data-testid (e.g. "smartart-list").
		const initialTestId = await smartArt.getAttribute('data-testid');

		// Switch layout via the layout switcher in the inspector.
		// The layout buttons have title text matching category names (Pyramid, Process, etc.)
		// or data-testid like "smartart-layout-pyramid".
		const switchTarget = page.locator('[data-testid="smartart-layout-pyramid"]');
		await expect(switchTarget).toBeVisible();
		await switchTarget.click();
		await page.waitForTimeout(500);

		// Verify the shape changed: the data-testid on the SVG should now differ.
		const newSmartArt = page
			.locator('[data-pptx-viewport]')
			.locator('[data-testid^="smartart-"]')
			.first();
		await expect(newSmartArt).toBeVisible({ timeout: 5000 });
		const newTestId = await newSmartArt.getAttribute('data-testid');

		// The layout should have changed (e.g. "smartart-list" -> "smartart-pyramid").
		expect(newTestId).not.toBe(initialTestId);
	});

	test('changes SmartArt colour scheme via inspector', async ({ page }) => {
		await loadDeck(page);
		await switchToInsertTab(page);
		await insertSmartArtPreset(page);

		// Select the SmartArt element.
		const smartArt = page
			.locator('[data-pptx-viewport]')
			.locator('[data-testid^="smartart-"]')
			.first();
		await expect(smartArt).toBeVisible({ timeout: 5000 });

		const elementWrapper = smartArt
			.locator('xpath=ancestor-or-self::*[@data-pptx-element="true"]')
			.first();
		await expect(elementWrapper).toBeVisible();
		await elementWrapper.click();
		await page.waitForTimeout(300);

		// Open inspector.
		await openInspector(page);
		await page.waitForTimeout(300);

		// Capture colours before the scheme change.
		const fillsBefore = await smartArt
			.locator('[fill]')
			.evaluateAll((els) => els.map((e) => e.getAttribute('fill')).filter(Boolean));

		// Change the colour scheme via the select dropdown.
		// React: <select> with aria-label "Colour scheme"
		// Vue: data-testid="smartart-color-scheme"
		const targetSelect = page.locator('[data-testid="smartart-color-scheme"]');
		await expect(targetSelect).toBeVisible();
		await targetSelect.selectOption('monochromatic1');
		await page.waitForTimeout(400);

		const fillsAfter = await smartArt
			.locator('[fill]')
			.evaluateAll((els) => els.map((e) => e.getAttribute('fill')).filter(Boolean));

		const changed =
			fillsBefore.some((f, i) => fillsAfter[i] !== f) || fillsBefore.length !== fillsAfter.length;
		expect(changed).toBe(true);
	});

	test('focuses an inserted fallback node for immediate keyboard editing', async ({ page }) => {
		const runtimeErrors = collectRuntimeErrors(page);
		await loadDeck(page);
		await switchToInsertTab(page);
		await insertSmartArtPreset(page);
		const smartArt = currentSmartArt(page);
		await expect(smartArt).toBeVisible();
		await exerciseDirectKeyboardNodeEdit(page, smartArt, 'Edited fallback node');
		expect(runtimeErrors).toStrictEqual([]);
	});

	test('edits a loaded drawing node through the SmartArt editor', async ({ page }) => {
		const runtimeErrors = collectRuntimeErrors(page);
		await loadDeckFile(page, drawingFixturePath);
		const smartArt = currentSmartArt(page);
		await expect(smartArt).toBeVisible();
		const authoredText = await renderedNodeText(smartArt);
		expect(authoredText).toBe('Alpha');
		const diagramBox = await smartArt.boundingBox();
		expect(diagramBox, 'SmartArt diagram should have a rendered box').not.toBeNull();

		const point = await unobstructedNodePoint(firstSmartArtNode(smartArt));
		await page.mouse.dblclick(point.x, point.y);
		const editor = page.locator('[data-pptx-viewport] textarea:visible');
		await expect(editor).toHaveCount(1);
		// The generic element editor also mounts a textarea for this graphic frame,
		// but it is empty. Requiring the authored node text proves this is the real
		// SmartArt node editor before focus and typing assertions can pass.
		await expect(editor).toHaveValue(authoredText);
		await expect(editor).toBeFocused();
		await page.keyboard.type('Edited drawing node');
		await expect(editor).toHaveValue('Edited drawing node');

		const editorBox = await editor.boundingBox();
		expect(editorBox, 'SmartArt editor should have a rendered box').not.toBeNull();
		await editor.click({
			position: { x: Math.max(1, editorBox!.width * 0.75), y: editorBox!.height / 2 },
		});
		await expect(editor).toBeFocused();
		await expect
			.poll(async () => {
				const current = await smartArt.boundingBox();
				return current
					? {
							x: Math.round(current.x),
							y: Math.round(current.y),
							width: Math.round(current.width),
							height: Math.round(current.height),
						}
					: null;
			})
			.toStrictEqual({
				x: Math.round(diagramBox!.x),
				y: Math.round(diagramBox!.y),
				width: Math.round(diagramBox!.width),
				height: Math.round(diagramBox!.height),
			});

		await page
			.getByRole('toolbar', { name: 'Presentation toolbar' })
			.getByRole('tab', { name: 'Home', exact: true })
			.click();
		await expect(editor).toHaveCount(0);
		await expect.poll(() => renderedNodeText(smartArt)).toBe('Edited drawing node');

		await clickHistory(page, 'Undo');
		await expect.poll(() => renderedNodeText(smartArt)).toBe(authoredText);
		await clickHistory(page, 'Redo');
		await expect.poll(() => renderedNodeText(smartArt)).toBe('Edited drawing node');

		const download = await savePptxViaBackstage(page);
		const savedPath = await download.path();
		expect(savedPath, 'the browser should retain the saved SmartArt deck').not.toBeNull();
		await loadDeckFile(page, savedPath!);
		await expect.poll(() => renderedNodeText(currentSmartArt(page))).toBe('Edited drawing node');
		expect(runtimeErrors).toStrictEqual([]);
	});
});
