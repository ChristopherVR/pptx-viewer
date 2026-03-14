import { describe, it, expect } from 'vitest';
import { OleElementProcessor } from './elements/OleElementProcessor';
import type { ElementProcessorContext } from './elements/ElementProcessor';
import type { PptxElement } from '../core';
import { MediaContext } from './media-context';

function makeContext(
	overrides: Partial<ElementProcessorContext> = {}
): ElementProcessorContext {
	return {
		mediaContext: new MediaContext('/out', 'media'),
		slideNumber: 1,
		slideWidth: 960,
		slideHeight: 540,
		semanticMode: true,
		processElements: async () => [],
		...overrides,
	};
}

function makeOleElement(
	overrides: Record<string, unknown> = {}
): PptxElement {
	return {
		type: 'ole',
		id: 'ole_1',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		oleObjectType: 'excel',
		fileName: 'budget.xlsx',
		...overrides,
	} as unknown as PptxElement;
}

describe('OleElementProcessor', () => {
	const processor = new OleElementProcessor();

	// ── Type guard ──────────────────────────────────────────────────

	it('should report supportedTypes as ["ole"]', () => {
		expect(processor.supportedTypes).toEqual(['ole']);
	});

	it('should return null for non-ole elements', async () => {
		const ctx = makeContext();
		const element = {
			type: 'text',
			id: 't1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		} as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).toBeNull();
	});

	// ── Basic rendering ─────────────────────────────────────────────

	it('should render embedded object type and filename', async () => {
		const ctx = makeContext();
		const element = makeOleElement();
		const result = await processor.process(element, ctx);
		expect(result).toContain('Embedded excel: budget.xlsx');
	});

	it('should include file extension when present', async () => {
		const ctx = makeContext();
		const element = makeOleElement({ oleFileExtension: 'xlsx' });
		const result = await processor.process(element, ctx);
		expect(result).toContain('Extension: .xlsx');
	});

	it('should include program ID when present', async () => {
		const ctx = makeContext();
		const element = makeOleElement({
			oleProgId: 'Excel.Sheet.12',
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('Program ID: Excel.Sheet.12');
	});

	it('should indicate linked objects', async () => {
		const ctx = makeContext();
		const element = makeOleElement({ isLinked: true });
		const result = await processor.process(element, ctx);
		expect(result).toContain('Linked object');
	});

	it('should not include "Linked object" when isLinked is false', async () => {
		const ctx = makeContext();
		const element = makeOleElement({ isLinked: false });
		const result = await processor.process(element, ctx);
		expect(result).not.toContain('Linked object');
	});

	// ── Filename fallbacks ──────────────────────────────────────────

	it('should fall back to oleName when fileName is absent', async () => {
		const ctx = makeContext();
		const element = makeOleElement({
			fileName: undefined,
			oleName: 'document.pdf',
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('document.pdf');
	});

	it('should use "embedded-object" when both fileName and oleName are absent', async () => {
		const ctx = makeContext();
		const element = makeOleElement({
			fileName: undefined,
			oleName: undefined,
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('embedded-object');
	});

	// ── Object type fallback ────────────────────────────────────────

	it('should use "unknown" when oleObjectType is absent', async () => {
		const ctx = makeContext();
		const element = makeOleElement({
			oleObjectType: undefined,
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('Embedded unknown');
	});

	// ── Preview image ───────────────────────────────────────────────

	it('should render preview image from previewImageData', async () => {
		const ctx = makeContext();
		const element = makeOleElement({
			previewImageData:
				'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAAtJREFUCNdjYGBgAAAABAABJzQnCgAAAABJRU5ErkJggg==',
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('preview');
		expect(result).toContain('./media/');
	});

	it('should render preview image from previewImage fallback', async () => {
		const ctx = makeContext();
		const element = makeOleElement({
			previewImageData: undefined,
			previewImage:
				'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAAtJREFUCNdjYGBgAAAABAABJzQnCgAAAABJRU5ErkJggg==',
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('preview');
		expect(result).toContain('./media/');
	});

	it('should skip preview image when not a data URL', async () => {
		const ctx = makeContext();
		const element = makeOleElement({
			previewImageData: '/images/preview.png',
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toContain('preview');
	});

	it('should skip preview when no preview data is provided', async () => {
		const ctx = makeContext();
		const element = makeOleElement();
		const result = await processor.process(element, ctx);
		expect(result).not.toContain('preview');
	});

	// ── Combined output ─────────────────────────────────────────────

	it('should combine all sections with double newlines', async () => {
		const ctx = makeContext();
		const element = makeOleElement({
			oleFileExtension: 'xlsx',
			oleProgId: 'Excel.Sheet.12',
			isLinked: true,
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		const parts = result!.split('\n\n');
		expect(parts.length).toBeGreaterThanOrEqual(4);
		expect(parts[0]).toContain('Embedded excel');
		expect(parts[1]).toContain('Extension');
		expect(parts[2]).toContain('Program ID');
		expect(parts[3]).toContain('Linked object');
	});

	// ── Various object types ────────────────────────────────────────

	it('should render Word document OLE object', async () => {
		const ctx = makeContext();
		const element = makeOleElement({
			oleObjectType: 'word',
			fileName: 'report.docx',
			oleProgId: 'Word.Document.12',
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('Embedded word: report.docx');
		expect(result).toContain('Program ID: Word.Document.12');
	});

	it('should render PDF OLE object', async () => {
		const ctx = makeContext();
		const element = makeOleElement({
			oleObjectType: 'pdf',
			fileName: 'document.pdf',
			oleFileExtension: 'pdf',
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('Embedded pdf: document.pdf');
		expect(result).toContain('Extension: .pdf');
	});

	// ── Output wrapping ─────────────────────────────────────────────

	it('should wrap primary label in italic markers', async () => {
		const ctx = makeContext();
		const element = makeOleElement();
		const result = await processor.process(element, ctx);
		expect(result).toMatch(/^\*\[Embedded excel: budget\.xlsx\]\*/);
	});
});
