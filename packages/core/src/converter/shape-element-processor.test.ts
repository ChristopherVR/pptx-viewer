import { describe, it, expect } from 'vitest';
import { TextElementProcessor } from './elements/TextElementProcessor';
import { TextSegmentRenderer } from './TextSegmentRenderer';
import type { ElementProcessorContext } from './elements/ElementProcessor';
import type { PptxElement, ShapePptxElement, ConnectorPptxElement } from '../core';
import { MediaContext } from './media-context';

/**
 * Tests for shape and connector elements, which are processed by
 * TextElementProcessor (it handles 'text', 'shape', and 'connector' types).
 */

function makeContext(overrides: Partial<ElementProcessorContext> = {}): ElementProcessorContext {
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

function makeShapeElement(
	overrides: Record<string, unknown> = {}
): ShapePptxElement {
	return {
		type: 'shape',
		id: 'shp_1',
		x: 100,
		y: 200,
		width: 300,
		height: 150,
		...overrides,
	} as unknown as ShapePptxElement;
}

function makeConnectorElement(
	overrides: Record<string, unknown> = {}
): ConnectorPptxElement {
	return {
		type: 'connector',
		id: 'cxn_1',
		x: 50,
		y: 100,
		width: 200,
		height: 0,
		...overrides,
	} as unknown as ConnectorPptxElement;
}

describe('TextElementProcessor — shape elements', () => {
	const renderer = new TextSegmentRenderer();
	const processor = new TextElementProcessor(renderer);

	it('should process shape elements with text', async () => {
		const ctx = makeContext();
		const element = makeShapeElement({
			text: 'Shape text',
			textSegments: [
				{ text: 'Shape text', style: { fontSize: 14 } },
			],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('Shape text');
	});

	it('should process shape with bold text segments', async () => {
		const ctx = makeContext();
		const element = makeShapeElement({
			textSegments: [
				{ text: 'Important', style: { fontSize: 14, bold: true } },
			],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('**Important**');
	});

	it('should return null for shape with no text and no visual styling', async () => {
		const ctx = makeContext();
		const element = makeShapeElement({
			text: '',
			textSegments: [],
		});
		const result = await processor.process(element, ctx);
		expect(result).toBeNull();
	});

	it('should render prompt text for empty shape with placeholder', async () => {
		const ctx = makeContext();
		const element = makeShapeElement({
			text: '',
			textSegments: [],
			promptText: 'Click to add subtitle',
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('[Placeholder: Click to add subtitle]');
	});

	it('should handle shape with text warp preset', async () => {
		const ctx = makeContext();
		const element = makeShapeElement({
			textSegments: [
				{ text: 'Warped', style: { fontSize: 14 } },
			],
			textStyle: { textWarpPreset: 'textCurveUp' },
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('Text warp: textCurveUp');
	});

	it('should not annotate textNoShape warp preset', async () => {
		const ctx = makeContext();
		const element = makeShapeElement({
			textSegments: [
				{ text: 'Normal', style: { fontSize: 14 } },
			],
			textStyle: { textWarpPreset: 'textNoShape' },
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).not.toContain('Text warp');
	});

	it('should handle shape with linked text box continuation', async () => {
		const ctx = makeContext();
		const element = makeShapeElement({
			textSegments: [
				{ text: 'Continued text', style: { fontSize: 14 } },
			],
			linkedTxbxId: 5,
			linkedTxbxSeq: 1,
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('continued from linked text box 5');
	});

	it('should process connector elements with text', async () => {
		const ctx = makeContext();
		const element = makeConnectorElement({
			text: 'Connector label',
			textSegments: [
				{ text: 'Connector label', style: { fontSize: 12 } },
			],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('Connector label');
	});

	it('should handle shape fallback to plain text when no segments', async () => {
		const ctx = makeContext();
		const element = makeShapeElement({
			text: 'Fallback shape text',
			textSegments: undefined,
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('Fallback shape text');
	});

	it('should handle shape with right-aligned fallback text', async () => {
		const ctx = makeContext();
		const element = makeShapeElement({
			text: 'Right aligned',
			textSegments: undefined,
			textStyle: { align: 'right' },
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('<p align="right">');
	});

	it('should handle shape with image fill (extractShapeFillImage)', async () => {
		const ctx = makeContext();
		const element = makeShapeElement({
			text: 'Over image',
			textSegments: [
				{ text: 'Over image', style: { fontSize: 14 } },
			],
			shapeStyle: {
				fillMode: 'image',
				fillImageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAAtJREFUCNdjYGBgAAAABAABJzQnCgAAAABJRU5ErkJggg==',
			},
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		// Should contain both the fill image and the text
		expect(result).toContain('Shape fill');
		expect(result).toContain('Over image');
	});
});
