/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { PptxHandler } from 'pptx-viewer-core';
import type { PowerPointViewerAPI } from 'pptx-viewer-shared';

import { resetTabSession } from './support/deck';

declare global {
	interface Window {
		/** Public component handle exposed by each development demo. */
		__pptxViewer: PowerPointViewerAPI;
	}
}

async function positions(page: Page): Promise<number[]> {
	return page.evaluate(() => window.__pptxViewer.getSlides().map((slide) => slide.elements[0].x));
}

async function undo(page: Page, expected: number[]): Promise<void> {
	await page.getByRole('button', { name: /^undo/iu }).first().click();
	await expect.poll(() => positions(page)).toEqual(expected);
}

test.beforeEach(async ({ page }) => {
	const { handler, data } = await PptxHandler.create({ initialSlideCount: 2 });
	data.slides.forEach((slide, index) => {
		slide.elements = [
			{
				id: `title-${index}`,
				type: 'text',
				text: `Quarterly report ${index + 1}`,
				x: 67,
				y: 40,
				width: 400,
				height: 60,
			},
		];
		slide.isDirty = true;
	});
	const bytes = await handler.save(data.slides);
	handler.dispose();
	await page.setViewportSize({ width: 1500, height: 1000 });
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles({
		name: 'quarterly-report.pptx',
		mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		buffer: Buffer.from(bytes),
	});
	await page.locator('[data-pptx-viewport] [data-element-id]').first().waitFor();
	await expect.poll(() => positions(page)).toEqual([67, 67]);
});

test('adjusts titles across slides without navigating, then undoes and redoes the batch once', async ({
	page,
}) => {
	await page.evaluate(async () => {
		const slides = window.__pptxViewer.getSlides();
		window.__pptxViewer.selectElements([slides[0].elements[0].id]);
		await window.__pptxViewer.updateElements(
			slides.map((slide, index) => ({
				slideId: slide.id,
				elementId: slide.elements[0].id,
				patch: { x: index ? 90 : 84 },
			})),
			{ label: 'Adjust report titles' },
		);
	});
	await expect.poll(() => positions(page)).toEqual([84, 90]);
	const state = await page.evaluate(() => ({
		active: window.__pptxViewer.getActiveSlideIndex(),
		selected: window.__pptxViewer.getSelectedElementIds(),
		first: window.__pptxViewer.getSlides()[0].elements[0].id,
	}));
	expect(state.active).toBe(0);
	expect(state.selected).toEqual([state.first]);
	await undo(page, [67, 67]);
	await page.getByRole('button', { name: /^redo/iu }).first().click();
	await expect.poll(() => positions(page)).toEqual([84, 90]);
});

test('keeps consecutive batches and adjacent ordinary edits in separate undo steps', async ({
	page,
}) => {
	await page.evaluate(async () => {
		const slides = window.__pptxViewer.getSlides();
		window.__pptxViewer.updateElement(slides[0].elements[0].id, { x: 70 });
		const batch = (x: number) =>
			slides.map((slide) => ({
				slideId: slide.id,
				elementId: slide.elements[0].id,
				patch: { x },
			}));
		await Promise.all([
			window.__pptxViewer.updateElements(batch(80)),
			window.__pptxViewer.updateElements(batch(90)),
		]);
		window.__pptxViewer.updateElement(slides[0].elements[0].id, { x: 100 });
	});
	await expect.poll(() => positions(page)).toEqual([100, 90]);
	await undo(page, [90, 90]);
	await undo(page, [80, 80]);
	await undo(page, [70, 67]);
	await undo(page, [67, 67]);
});

test('rejects a whole invalid batch and ignores empty or cancelling batches', async ({ page }) => {
	const result = await page.evaluate(async () => {
		const first = window.__pptxViewer.getSlides()[0];
		const target = { slideId: first.id, elementId: first.elements[0].id };
		let rejected = false;
		try {
			await window.__pptxViewer.updateElements([
				{ ...target, patch: { x: 84 } },
				{ ...target, slideId: 'missing-slide', patch: { x: 90 } },
			]);
		} catch {
			rejected = true;
		}
		await window.__pptxViewer.updateElements([]);
		await window.__pptxViewer.updateElements([
			{ ...target, patch: { x: 84 } },
			{ ...target, patch: { x: 67 } },
		]);
		return {
			rejected,
			canUndo: window.__pptxViewer.canUndo(),
			dirty: window.__pptxViewer.isDirty(),
		};
	});
	expect(result).toEqual({ rejected: true, canUndo: false, dirty: false });
	expect(await positions(page)).toEqual([67, 67]);
});
