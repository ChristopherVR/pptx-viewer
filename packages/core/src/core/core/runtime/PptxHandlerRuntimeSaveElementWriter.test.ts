/**
 * Save-writer round-trips for the non-visual drawing properties
 * (`p:cNvPr`) the Selection Pane edits.
 *
 * These drive the real `PptxHandler` against real fixtures rather than
 * re-implementing the writer, because the defect they pin was exactly a
 * writer that looked correct in isolation: `@_name` was written where new
 * shape XML is fabricated, so every unit test of the factories passed while
 * a rename of a LOADED shape was silently discarded on save.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../PptxHandler';
import type { GroupPptxElement, PptxData, PptxElement, PptxSlide } from '../../types';

const LINKED_TEXTBOX = 'linked-textbox.pptx';
const CHART_GALLERY = 'chart-gallery.pptx';

function fixturePath(name: string): string {
	return fileURLToPath(new URL(`../../../../../../e2e/fixtures/${name}`, import.meta.url));
}

async function loadFixture(name: string): Promise<{ handler: PptxHandler; data: PptxData }> {
	const bytes = readFileSync(fixturePath(name));
	const handler = new PptxHandler();
	const data = await handler.load(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
	);
	return { handler, data };
}

async function slideXml(saved: Uint8Array, part: string): Promise<string> {
	const zip = await JSZip.loadAsync(saved);
	return zip.file(part)!.async('string');
}

/** Every `p:cNvPr/@name` in the part, in document order. */
function cNvPrNames(xml: string): string[] {
	return [...xml.matchAll(/<p:cNvPr[^>]*\bname="([^"]*)"/gu)].map((match) => match[1]);
}

function firstSlideWithGroup(data: PptxData): PptxSlide {
	return data.slides.find((slide) => slide.elements.some((el) => el.type === 'group'))!;
}

describe.runIf(existsSync(fixturePath(LINKED_TEXTBOX)))('applyNameToCnvPr', () => {
	it('persists a rename of a loaded shape', async () => {
		const { handler, data } = await loadFixture(LINKED_TEXTBOX);
		const slide = data.slides[0];
		const target = slide.elements.find((el) => el.type !== 'group')!;
		expect(target.name).toBeDefined();
		expect(target.name).not.toBe('RENAMED-SHAPE');

		target.name = 'RENAMED-SHAPE';
		slide.isDirty = true;

		const saved = await handler.save(data.slides);
		expect(cNvPrNames(await slideXml(saved, slide.id))).toContain('RENAMED-SHAPE');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const roundTripped = reloaded.slides[0].elements.find((el) => el.id === target.id);
		expect(roundTripped?.name).toBe('RENAMED-SHAPE');
	});

	it('persists a rename of a loaded group', async () => {
		// Groups return from the element writer before applyNameToCnvPr runs,
		// so the group builder has to apply the name itself.
		const { handler, data } = await loadFixture(LINKED_TEXTBOX);
		const slide = firstSlideWithGroup(data);
		const group = slide.elements.find((el) => el.type === 'group') as GroupPptxElement;
		group.name = 'RENAMED-GROUP';
		slide.isDirty = true;

		const saved = await handler.save(data.slides);
		expect(cNvPrNames(await slideXml(saved, slide.id))).toContain('RENAMED-GROUP');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const roundTripped = reloaded.slides
			.find((s) => s.id === slide.id)!
			.elements.find((el) => el.type === 'group');
		expect(roundTripped?.name).toBe('RENAMED-GROUP');
	});

	it('writes an explicit empty name as name="" and never drops the attribute', async () => {
		// `@name` is REQUIRED on CT_NonVisualDrawingProps (ECMA-376
		// S20.1.2.2.8), so an explicit clear must not delete it.
		const { handler, data } = await loadFixture(LINKED_TEXTBOX);
		const slide = data.slides[0];
		const target = slide.elements.find((el) => el.type !== 'group')!;
		target.name = '';
		slide.isDirty = true;

		const xml = await slideXml(await handler.save(data.slides), slide.id);
		expect(xml).toMatch(/<p:cNvPr[^>]*\bname=""/u);
		// No cNvPr anywhere lost its name attribute.
		expect(xml).not.toMatch(/<p:cNvPr(?![^>]*\bname=)/u);
	});
});

describe.runIf(existsSync(fixturePath(CHART_GALLERY)))('applyNameToCnvPr (no collateral)', () => {
	it('leaves an authored name alone when the model carries none', async () => {
		// Graphic frames now parse their authored `name`, but a model that
		// carries none (an SDK-built element, or one whose name a caller
		// dropped) must still mean "no opinion", never "blank it".
		const { handler, data } = await loadFixture(CHART_GALLERY);
		const chart = data.slides[0].elements.find((el) => el.type === 'chart');
		expect(chart).toBeDefined();
		expect(chart!.name).toBe('Chart 1');
		delete chart!.name;

		for (const slide of data.slides) {
			slide.isDirty = true;
		}
		const xml = await slideXml(await handler.save(data.slides), 'ppt/slides/slide1.xml');
		expect(cNvPrNames(xml)).toContain('Chart 1');
	});

	it('keeps every authored name across a no-edit dirty save', async () => {
		const bytes = readFileSync(fixturePath(CHART_GALLERY));
		const buffer = bytes.buffer.slice(
			bytes.byteOffset,
			bytes.byteOffset + bytes.byteLength,
		) as ArrayBuffer;
		const before = cNvPrNames(
			await (await JSZip.loadAsync(buffer)).file('ppt/slides/slide1.xml')!.async('string'),
		).filter((name) => name.length > 0);

		const handler = new PptxHandler();
		const data = await handler.load(buffer);
		for (const slide of data.slides) {
			slide.isDirty = true;
		}
		const after = cNvPrNames(
			await slideXml(await handler.save(data.slides), 'ppt/slides/slide1.xml'),
		);
		for (const name of before) {
			expect(after).toContain(name);
		}
	});
});

describe.runIf(existsSync(fixturePath(LINKED_TEXTBOX)))('applyHiddenToCnvPr', () => {
	it('round-trips the Selection Pane hide toggle', async () => {
		const { handler, data } = await loadFixture(LINKED_TEXTBOX);
		const slide = data.slides[0];
		const target = slide.elements.find((el) => el.type !== 'group') as PptxElement;
		target.hidden = true;
		slide.isDirty = true;

		const saved = await handler.save(data.slides);
		await expect(slideXml(saved, slide.id)).resolves.toContain('hidden="1"');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		expect(reloaded.slides[0].elements.find((el) => el.id === target.id)?.hidden).toBeTruthy();
	});
});
