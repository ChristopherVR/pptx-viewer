import JSZip from 'jszip';
import { describe, it, expect, beforeEach } from 'vitest';

import { resetIdCounter } from '../../core/builders/sdk/ElementFactory';
import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxElement } from '../../core/types/elements';

/**
 * Regression: XML text entities (`&`, `<`, `>`, ...) must round-trip as their
 * real characters, not the literal `&amp;` / `&amp;amp;`. The parser runs with
 * `processEntities: false` (security), so a `tagValueProcessor` decodes the
 * predefined entities + numeric refs on load; the builder re-encodes them on
 * save. Before the fix, slide text rendered the literal `&amp;` and the entity
 * double-encoded on every save.
 */

beforeEach(() => {
	resetIdCounter();
});

/** Join an element's text content (segments preferred, else the flat field). */
function textOf(el: PptxElement): string {
	if ('textSegments' in el && Array.isArray(el.textSegments) && el.textSegments.length > 0) {
		return el.textSegments.map((s) => s.text ?? '').join('');
	}
	return 'text' in el && typeof el.text === 'string' ? el.text : '';
}

function findText(slides: { elements: PptxElement[] }[], needle: string): PptxElement | undefined {
	for (const slide of slides) {
		for (const el of slide.elements) {
			if (textOf(el).includes(needle)) {
				return el;
			}
		}
	}
	return undefined;
}

describe('xML entity round-trip in slide text', () => {
	const TEXT = 'Tom & Jerry < 3 > 2 and "Q & A"';

	it('preserves ampersands and angle brackets through save and reload', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank').addText(TEXT, { x: 10, y: 10, width: 400, height: 60 }).build(),
		);

		const bytes = await handler.save(data.slides);

		const reloaded = await new PptxHandler().load(bytes.buffer as ArrayBuffer);
		const el = findText(reloaded.slides, 'Tom & Jerry');
		expect(el, 'text element should survive the round-trip').toBeDefined();
		expect(textOf(el!)).toContain('Tom & Jerry');
		expect(textOf(el!)).toContain('< 3 > 2');
		// The decoded text must NOT contain a literal entity (no &amp; leakage).
		expect(textOf(el!)).not.toContain('&amp;');
	});

	it('writes single-encoded entities in the saved XML (no double-encoding)', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank').addText(TEXT, { x: 10, y: 10, width: 400, height: 60 }).build(),
		);
		const bytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(bytes);
		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');

		// Correct single encoding is present, the double encoding is not.
		expect(slideXml).toContain('Tom &amp; Jerry');
		expect(slideXml).not.toContain('&amp;amp;');
	});

	it('stays stable across a second save/reload cycle', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank').addText(TEXT, { x: 10, y: 10, width: 400, height: 60 }).build(),
		);
		const first = await handler.save(data.slides);

		const h2 = new PptxHandler();
		const d2 = await h2.load(first.buffer as ArrayBuffer);
		const second = await h2.save(d2.slides);

		const reloaded = await new PptxHandler().load(second.buffer as ArrayBuffer);
		const el = findText(reloaded.slides, 'Tom & Jerry');
		expect(textOf(el!)).toContain('Tom & Jerry');
		expect(textOf(el!)).not.toContain('&amp;');
	});
});
