import fs from 'node:fs';
import path from 'node:path';

import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import { requireFixture } from '../require-fixture';

/**
 * Integration: the Selection Pane's hide toggle must survive a save/reload.
 *
 * `element.hidden` used to be viewer-local state. Nothing parsed
 * `p:cNvPr/@hidden` on load and nothing wrote it on save, so hiding a shape and
 * saving produced a deck that reopened with the shape visible again - in this
 * viewer and in PowerPoint, which reads the same attribute.
 */
describe('selection-pane hidden flag round-trip', () => {
	const fixturePath = requireFixture(
		path.resolve(__dirname, '../fixtures/embedded-assets-sample.pptx'),
	);

	function readFixture(): ArrayBuffer {
		const bytes = fs.readFileSync(fixturePath);
		return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
	}

	it('writes @hidden on save and reads it back on load', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(readFixture());

		const slide = data.slides.find((entry) => (entry.elements?.length ?? 0) > 0);
		expect(slide, 'fixture has no slide with elements').toBeTruthy();
		const target = slide!.elements[0];
		expect(target.hidden).toBeUndefined();

		// Hide it the way the Selection Pane does: flip the flag on the model.
		slide!.elements[0] = { ...target, hidden: true };

		const saved = await handler.save(data.slides);

		// 1. The attribute reaches the XML.
		const zip = await JSZip.loadAsync(saved);
		const entry = zip.file(slide!.id);
		expect(entry, `${slide!.id} missing from the saved archive`).toBeTruthy();
		const xml = await entry!.async('string');
		expect(xml).toMatch(/<p:cNvPr[^>]*\shidden="1"/u);

		// 2. Reloading the saved bytes brings the flag back onto the model.
		const reloadHandler = new PptxHandler();
		const reloaded = await reloadHandler.load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		const reloadedSlide = reloaded.slides.find((entry_) => entry_.id === slide!.id);
		expect(reloadedSlide?.elements[0]?.hidden).toBeTruthy();

		// 3. Un-hiding removes the attribute again rather than writing hidden="0".
		reloadedSlide!.elements[0] = { ...reloadedSlide!.elements[0], hidden: false };
		const resaved = await reloadHandler.save(reloaded.slides);
		const resavedXml = await (await JSZip.loadAsync(resaved)).file(slide!.id)!.async('string');
		expect(resavedXml).not.toContain('hidden="1"');
	});

	it('leaves visible shapes untouched', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(readFixture());
		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const slide = data.slides.find((entry) => (entry.elements?.length ?? 0) > 0)!;
		const xml = await zip.file(slide.id)!.async('string');
		expect(xml).not.toMatch(/<p:cNvPr[^>]*\shidden=/u);
	});
});
