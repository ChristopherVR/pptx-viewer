import { describe, it, expect, vi } from 'vitest';

import type { PptxElement } from '../../core';
import type { MediaContext } from '../media-context';
import type { ElementProcessorContext } from './ElementProcessor';
import { OleElementProcessor } from './OleElementProcessor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(overrides: Partial<ElementProcessorContext> = {}): ElementProcessorContext {
	return {
		mediaContext: {
			saveImage: vi.fn(async () => './media/slide1-ole-image-001.png'),
		} as unknown as MediaContext,
		slideNumber: 1,
		slideWidth: 960,
		slideHeight: 540,
		processElements: vi.fn(async () => []),
		...overrides,
	};
}

function makeOleElement(overrides: Record<string, unknown> = {}): PptxElement {
	return {
		type: 'ole',
		id: 'ole_1',
		x: 100,
		y: 200,
		width: 400,
		height: 300,
		oleObjectType: 'excel',
		fileName: 'budget.xlsx',
		...overrides,
	} as unknown as PptxElement;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('oleElementProcessor', () => {
	const processor = new OleElementProcessor();

	it('reports supported types as ole', () => {
		expect(processor.supportedTypes).toStrictEqual(['ole']);
	});

	it('returns null for non-ole element', async () => {
		const el = {
			type: 'text',
			id: 'txt_1',
			x: 0,
			y: 0,
			width: 100,
			height: 50,
		} as unknown as PptxElement;
		const result = await processor.process(el, makeCtx());
		expect(result).toBeNull();
	});

	it('renders OLE element with type and filename', async () => {
		const result = await processor.process(makeOleElement(), makeCtx());
		expect(result).toContain('*[Embedded excel: budget.xlsx]*');
	});

	it('uses "unknown" when oleObjectType is not set', async () => {
		const el = makeOleElement({ oleObjectType: undefined });
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('*[Embedded unknown:');
	});

	it('uses oleName when fileName is not set', async () => {
		const el = makeOleElement({ fileName: undefined, oleName: 'Sheet1' });
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('Sheet1');
	});

	it('uses "embedded-object" when neither fileName nor oleName is set', async () => {
		const el = makeOleElement({ fileName: undefined, oleName: undefined });
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('embedded-object');
	});

	it('includes file extension', async () => {
		const el = makeOleElement({ oleFileExtension: 'xlsx' });
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('*Extension: .xlsx*');
	});

	it('includes program ID', async () => {
		const el = makeOleElement({ oleProgId: 'Excel.Sheet.12' });
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('*Program ID: Excel.Sheet.12*');
	});

	it('indicates linked object', async () => {
		const el = makeOleElement({ isLinked: true });
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('*Linked object*');
	});

	it('does not show linked label when not linked', async () => {
		const el = makeOleElement({ isLinked: false });
		const result = await processor.process(el, makeCtx());
		expect(result).not.toContain('Linked object');
	});

	it('extracts preview image from previewImageData', async () => {
		const el = makeOleElement({
			previewImageData: 'data:image/png;base64,preview',
		});
		const ctx = makeCtx();
		const result = await processor.process(el, ctx);
		expect(ctx.mediaContext.saveImage).toHaveBeenCalledWith(
			'data:image/png;base64,preview',
			'slide1-ole',
		);
		expect(result).toContain('![Embedded excel preview]');
	});

	it('extracts preview image from previewImage fallback', async () => {
		const el = makeOleElement({
			previewImageData: undefined,
			previewImage: 'data:image/png;base64,fallback',
		});
		const ctx = makeCtx();
		const result = await processor.process(el, ctx);
		expect(ctx.mediaContext.saveImage).toHaveBeenCalledWith(
			'data:image/png;base64,fallback',
			'slide1-ole',
		);
		expect(result).toContain('![Embedded excel preview]');
	});

	it('prefers previewImageData over previewImage', async () => {
		const el = makeOleElement({
			previewImageData: 'data:image/png;base64,primary',
			previewImage: 'data:image/png;base64,secondary',
		});
		const ctx = makeCtx();
		await processor.process(el, ctx);
		expect(ctx.mediaContext.saveImage).toHaveBeenCalledWith(
			'data:image/png;base64,primary',
			'slide1-ole',
		);
	});

	it('skips preview when not a data URL', async () => {
		const el = makeOleElement({
			previewImageData: 'not-a-data-url',
			previewImage: undefined,
		});
		const ctx = makeCtx();
		const result = await processor.process(el, ctx);
		expect(ctx.mediaContext.saveImage).not.toHaveBeenCalled();
		expect(result).not.toContain('preview');
	});

	it('ignores preview extraction errors gracefully', async () => {
		const el = makeOleElement({
			previewImageData: 'data:image/png;base64,bad',
		});
		const ctx = makeCtx({
			mediaContext: {
				saveImage: vi.fn(async () => {
					throw new Error('Save failed');
				}),
			} as unknown as MediaContext,
		});
		const result = await processor.process(el, ctx);
		// Should not throw; should just omit the preview
		expect(result).not.toContain('preview');
	});

	it('uses slide number in preview prefix', async () => {
		const el = makeOleElement({
			previewImageData: 'data:image/png;base64,data',
		});
		const ctx = makeCtx({ slideNumber: 7 });
		await processor.process(el, ctx);
		expect(ctx.mediaContext.saveImage).toHaveBeenCalledWith(expect.any(String), 'slide7-ole');
	});
});
