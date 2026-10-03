import { readFile } from 'node:fs/promises';

/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright owns test and expect */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import JSZip from 'jszip';

import { savePptxViaBackstage } from './save-pptx';
import { fixture, loadDeck, resetTabSession, thumbnail } from './support/deck';

async function renderedDiagram(diagram: Locator) {
	return {
		text: (await diagram.locator('text').allTextContents()).join(' ').replace(/\s+/gu, ' ').trim(),
		nodes: await diagram.locator('[data-smartart-node-id]').count(),
		shapes: await diagram.locator('path, rect, ellipse, circle, polygon').count(),
	};
}

async function loadUncachedDiagram(page: Page, fileName = 'smartart-build-reveal.pptx') {
	const zip = await JSZip.loadAsync(await readFile(fixture(fileName)));
	for (const path of Object.keys(zip.files)) {
		if (/^ppt\/diagrams\/drawing\d+\.xml$/u.test(path)) {
			zip.remove(path);
		}
	}
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles({
		name: 'uncached-smartart.pptx',
		mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		buffer: await zip.generateAsync({ type: 'nodebuffer' }),
	});
}

for (const source of ['cached', 'computed', 'powerpoint-computed', 'inserted'] as const) {
	test(`${source} SmartArt survives browser refresh after a real autosave`, async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		page.on('console', (message) => {
			if (message.type() === 'error') {
				errors.push(message.text());
			}
		});
		if (source === 'computed') {
			await loadUncachedDiagram(page);
		} else if (source === 'powerpoint-computed') {
			await loadUncachedDiagram(page, 'animation-builds-color.pptx');
			await thumbnail(page, 2).click();
		} else {
			await loadDeck(
				page,
				fixture(source === 'inserted' ? 'sample-deck.pptx' : 'smartart-build-reveal.pptx'),
			);
		}
		if (source === 'inserted') {
			await page
				.getByRole('toolbar', { name: 'Presentation toolbar' })
				.getByRole('tab', { name: 'Insert', exact: true })
				.click();
			await page.getByRole('button', { name: 'SmartArt', exact: true }).click();
			const dialog = page.getByRole('dialog', { name: /Insert SmartArt/iu });
			await dialog.getByRole('option').first().click();
			await dialog.getByRole('button', { name: /^Insert$/iu }).click();
		}
		const diagram = page.locator('[data-pptx-viewport] [data-testid^="smartart-"]').first();
		await expect(diagram).toBeVisible();
		const expected = await renderedDiagram(diagram);
		expect(expected.nodes).toBeGreaterThan(0);
		expect(expected.shapes).toBeGreaterThan(0);
		// A ribbon commit reliably dirties every binding without depending on canvas focus.
		await page
			.getByRole('toolbar', { name: 'Presentation toolbar' })
			.getByRole('tab', { name: 'Home', exact: true })
			.click();
		await page
			.getByRole('button', { name: /new slide/iu })
			.first()
			.click();
		await thumbnail(page, source === 'powerpoint-computed' ? 2 : 1).click();
		const snapshotKey = source.endsWith('computed')
			? 'uncached-smartart.pptx'
			: source === 'inserted'
				? 'sample-deck.pptx'
				: 'smartart-build-reveal.pptx';
		await expect
			.poll(
				() =>
					page.evaluate(async (fileName) => {
						return new Promise<number>((resolve) => {
							const request = indexedDB.open('pptx-viewer-autosave');
							request.onerror = () => resolve(0);
							request.onsuccess = () => {
								const db = request.result;
								if (!db.objectStoreNames.contains('recoveryVersions')) {
									db.close();
									resolve(0);
									return;
								}
								const records = db
									.transaction('recoveryVersions')
									.objectStore('recoveryVersions')
									.getAll();
								records.onsuccess = () => {
									db.close();
									resolve(
										records.result.filter(
											(record) => record.key === fileName && record.data?.byteLength > 0,
										).length,
									);
								};
							};
						});
					}, snapshotKey),
				{ timeout: 30_000 },
			)
			.toBeGreaterThan(0);
		for (let round = 0; round < 2; round++) {
			await page.reload();
			if (source === 'powerpoint-computed') {
				await thumbnail(page, 2).click();
			}
			await expect(diagram).toBeVisible();
			await expect.poll(() => renderedDiagram(diagram)).toStrictEqual(expected);
		}
		expect(errors).toStrictEqual([]);
	});
}

test('SmartArt survives repeated browser refreshes and saved-file reloads', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await loadDeck(page, fixture('smartart-build-reveal.pptx'));
	const diagram = page.locator('[data-pptx-viewport] [data-testid^="smartart-"]').first();
	await expect(diagram).toBeVisible();
	const expected = await renderedDiagram(diagram);
	expect(expected.text.length).toBeGreaterThan(0);
	expect(expected.nodes).toBeGreaterThan(0);
	expect(expected.shapes).toBeGreaterThan(0);
	for (let round = 0; round < 2; round++) {
		await page.reload();
		await expect(diagram).toBeVisible();
		await expect.poll(() => renderedDiagram(diagram)).toStrictEqual(expected);
		const download = await savePptxViaBackstage(page);
		const savedPath = await download.path();
		expect(savedPath).not.toBeNull();
		await loadDeck(page, savedPath!);
		await expect(diagram).toBeVisible();
		await expect.poll(() => renderedDiagram(diagram)).toStrictEqual(expected);
	}
	expect(errors).toStrictEqual([]);
});
