import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { PptxElement } from '../../core';
import type { MediaContext } from '../media-context';
import { TextSegmentRenderer } from '../TextSegmentRenderer';
import type { ElementProcessorContext } from './ElementProcessor';
import { TextElementProcessor } from './TextElementProcessor';

// Mock the ShapeImageRenderer to avoid canvas dependency
vi.mock<typeof import('../ShapeImageRenderer')>(import('../ShapeImageRenderer'), () => ({
	renderShapeToDataUrl: vi.fn(() => null),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(overrides: Partial<ElementProcessorContext> = {}): ElementProcessorContext {
	return {
		mediaContext: {
			saveImage: vi.fn(async (_data: string, _prefix?: string) => './media/image-001.png'),
		} as unknown as MediaContext,
		slideNumber: 1,
		slideWidth: 960,
		slideHeight: 540,
		processElements: vi.fn(async () => []),
		...overrides,
	};
}

function makeTextElement(overrides: Record<string, unknown> = {}): PptxElement {
	return {
		type: 'text',
		id: 'txt_1',
		x: 50,
		y: 30,
		width: 800,
		height: 60,
		text: '',
		textSegments: [],
		...overrides,
	} as unknown as PptxElement;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('textElementProcessor', () => {
	let processor: TextElementProcessor;
	let renderer: TextSegmentRenderer;

	beforeEach(() => {
		renderer = new TextSegmentRenderer();
		processor = new TextElementProcessor(renderer);
	});

	it('reports supported types as text, shape, connector', () => {
		expect(processor.supportedTypes).toStrictEqual(['text', 'shape', 'connector']);
	});

	it('returns null for non-text element types', async () => {
		const el = {
			type: 'image',
			id: 'img_1',
			x: 0,
			y: 0,
			width: 100,
			height: 50,
		} as unknown as PptxElement;
		const result = await processor.process(el, makeCtx());
		expect(result).toBeNull();
	});

	it('returns null when element has no text and no segments', async () => {
		const el = makeTextElement({ text: '', textSegments: [] });
		const result = await processor.process(el, makeCtx());
		expect(result).toBeNull();
	});

	it('renders plain text from fallback text property', async () => {
		const el = makeTextElement({ text: 'Hello World', textSegments: undefined });
		const result = await processor.process(el, makeCtx());
		expect(result).toBe('Hello World');
	});

	it('ignores whitespace-only fallback text', async () => {
		const el = makeTextElement({ text: '   ', textSegments: undefined });
		const result = await processor.process(el, makeCtx());
		expect(result).toBeNull();
	});

	it('wraps fallback text in <p align> when alignment is set', async () => {
		const el = makeTextElement({
			text: 'Centered',
			textSegments: undefined,
			textStyle: { align: 'center' },
		});
		const result = await processor.process(el, makeCtx());
		expect(result).toBe('<p align="center">Centered</p>');
	});

	it('does not wrap in <p align> when alignment is left', async () => {
		const el = makeTextElement({
			text: 'Left text',
			textSegments: undefined,
			textStyle: { align: 'left' },
		});
		const result = await processor.process(el, makeCtx());
		expect(result).toBe('Left text');
	});

	it('renders text segments via TextSegmentRenderer', async () => {
		const segments = [
			{
				text: 'Hello',
				style: { bold: true },
			},
		];
		const el = makeTextElement({ textSegments: segments });
		const renderSpy = vi.spyOn(renderer, 'render').mockReturnValue('**Hello**');

		const result = await processor.process(el, makeCtx());
		expect(renderSpy).toHaveBeenCalledWith(segments, {
			htmlFormatting: false,
			paragraphIndents: undefined,
			slideNumber: 1,
		});
		expect(result).toBe('**Hello**');
	});

	it('includes text warp annotation when warp preset is not textNoShape', async () => {
		const segments = [{ text: 'Warped', style: {} }];
		const el = makeTextElement({
			textSegments: segments,
			textStyle: { textWarpPreset: 'textWave' },
		});
		vi.spyOn(renderer, 'render').mockReturnValue('Warped');

		const result = await processor.process(el, makeCtx());
		expect(result).toContain('*Text warp: textWave*');
	});

	it('does not include text warp annotation for textNoShape', async () => {
		const segments = [{ text: 'Normal', style: {} }];
		const el = makeTextElement({
			textSegments: segments,
			textStyle: { textWarpPreset: 'textNoShape' },
		});
		vi.spyOn(renderer, 'render').mockReturnValue('Normal');

		const result = await processor.process(el, makeCtx());
		expect(result).not.toContain('Text warp');
	});

	it('shows placeholder prompt text when no content', async () => {
		const el = makeTextElement({
			text: '',
			textSegments: [],
			promptText: 'Click to add title',
		});
		const result = await processor.process(el, makeCtx());
		expect(result).toBe('*[Placeholder: Click to add title]*');
	});

	it('appends linked text box continuation label', async () => {
		const segments = [{ text: 'continued', style: {} }];
		const el = makeTextElement({
			textSegments: segments,
			linkedTxbxId: 42,
			linkedTxbxSeq: 1,
		});
		vi.spyOn(renderer, 'render').mockReturnValue('continued');

		const result = await processor.process(el, makeCtx());
		expect(result).toContain('continued from linked text box 42');
	});

	it('does not append continuation label for seq 0', async () => {
		const segments = [{ text: 'first', style: {} }];
		const el = makeTextElement({
			textSegments: segments,
			linkedTxbxId: 42,
			linkedTxbxSeq: 0,
		});
		vi.spyOn(renderer, 'render').mockReturnValue('first');

		const result = await processor.process(el, makeCtx());
		expect(result).not.toContain('continued');
	});

	it('extracts shape fill image when fillMode is image', async () => {
		const el = makeTextElement({
			text: '',
			textSegments: [],
			shapeStyle: {
				fillMode: 'image',
				fillImageUrl: 'data:image/png;base64,abc',
			},
			promptText: 'placeholder',
		});
		const ctx = makeCtx();

		const result = await processor.process(el, ctx);
		expect(ctx.mediaContext.saveImage).toHaveBeenCalledWith(
			'data:image/png;base64,abc',
			'slide1-shapefill',
		);
		expect(result).toContain('Shape fill');
	});

	it('renders shape fill image with semantic mode as markdown image', async () => {
		const el = makeTextElement({
			text: '',
			textSegments: [],
			shapeStyle: {
				fillMode: 'image',
				fillImageUrl: 'data:image/png;base64,abc',
			},
			promptText: 'placeholder',
		});
		const ctx = makeCtx({ semanticMode: true });

		const result = await processor.process(el, ctx);
		expect(result).toContain('![Shape fill]');
	});

	it('extracts picture bullet images', async () => {
		const segments = [
			{
				text: 'Bullet item',
				style: {},
				bulletInfo: { imageDataUrl: 'data:image/png;base64,bullet' },
			},
		];
		const el = makeTextElement({ textSegments: segments });
		vi.spyOn(renderer, 'render').mockReturnValue('Bullet item');

		const ctx = makeCtx();
		const result = await processor.process(el, ctx);
		expect(ctx.mediaContext.saveImage).toHaveBeenCalledWith(
			'data:image/png;base64,bullet',
			'slide1-bullet',
		);
		expect(result).toContain('Bullet image');
	});

	it('deduplicates picture bullet images', async () => {
		const bulletUrl = 'data:image/png;base64,samebullet';
		const segments = [
			{ text: 'Item 1', style: {}, bulletInfo: { imageDataUrl: bulletUrl } },
			{ text: 'Item 2', style: {}, bulletInfo: { imageDataUrl: bulletUrl } },
		];
		const el = makeTextElement({ textSegments: segments });
		vi.spyOn(renderer, 'render').mockReturnValue('Item 1\nItem 2');

		const ctx = makeCtx();
		await processor.process(el, ctx);
		// Only called once for the same bullet URL
		expect(ctx.mediaContext.saveImage).toHaveBeenCalledOnce();
	});

	it('handles shape element type', async () => {
		const el = {
			type: 'shape',
			id: 'shp_1',
			x: 0,
			y: 0,
			width: 100,
			height: 50,
			text: 'shape text',
			textSegments: undefined,
		} as unknown as PptxElement;

		const result = await processor.process(el, makeCtx());
		expect(result).toBe('shape text');
	});

	it('handles connector element type', async () => {
		const el = {
			type: 'connector',
			id: 'cxn_1',
			x: 0,
			y: 0,
			width: 200,
			height: 0,
			text: 'connector label',
			textSegments: undefined,
		} as unknown as PptxElement;

		const result = await processor.process(el, makeCtx());
		expect(result).toBe('connector label');
	});
});
