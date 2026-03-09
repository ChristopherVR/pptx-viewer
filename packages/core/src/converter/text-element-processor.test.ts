import { describe, it, expect, vi } from 'vitest';
import { TextElementProcessor } from './elements/TextElementProcessor';
import { TextSegmentRenderer } from './TextSegmentRenderer';
import type { ElementProcessorContext } from './elements/ElementProcessor';
import type { PptxElement, TextSegment } from '../core';
import { MediaContext } from './media-context';

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

function makeTextElement(
	overrides: Record<string, unknown> = {}
): PptxElement {
	return {
		type: 'text',
		id: 'txt_1',
		x: 100,
		y: 50,
		width: 400,
		height: 60,
		text: 'Hello World',
		textSegments: [
			{
				text: 'Hello World',
				style: { fontSize: 24 },
			},
		],
		...overrides,
	} as unknown as PptxElement;
}

function seg(text: string, style: TextSegment['style'] = {}): TextSegment {
	return { text, style: { fontSize: 14, ...style } };
}

function paragraphBreak(): TextSegment {
	return { text: '', style: {}, isParagraphBreak: true };
}

describe('TextElementProcessor', () => {
	const renderer = new TextSegmentRenderer();
	const processor = new TextElementProcessor(renderer);

	it('should support text, shape, and connector types', () => {
		expect(processor.supportedTypes).toContain('text');
		expect(processor.supportedTypes).toContain('shape');
		expect(processor.supportedTypes).toContain('connector');
	});

	it('should render plain text from textSegments', async () => {
		const ctx = makeContext();
		const element = makeTextElement();
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('Hello World');
	});

	it('should render bold text with markdown formatting', async () => {
		const ctx = makeContext();
		const element = makeTextElement({
			textSegments: [
				seg('Bold text', { bold: true }),
			],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('**Bold text**');
	});

	it('should render italic text with markdown formatting', async () => {
		const ctx = makeContext();
		const element = makeTextElement({
			textSegments: [
				seg('Italic text', { italic: true }),
			],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('*Italic text*');
	});

	it('should render bold+italic text together', async () => {
		const ctx = makeContext();
		const element = makeTextElement({
			textSegments: [
				seg('Bold and italic', { bold: true, italic: true }),
			],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('***Bold and italic***');
	});

	it('should render hyperlinks in markdown', async () => {
		const ctx = makeContext();
		const element = makeTextElement({
			textSegments: [
				seg('Click me', { hyperlink: 'https://example.com' }),
			],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('[Click me](https://example.com)');
	});

	it('should render strikethrough text', async () => {
		const ctx = makeContext();
		const element = makeTextElement({
			textSegments: [
				seg('deleted', { strikethrough: true }),
			],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('~~deleted~~');
	});

	it('should render bulleted list items', async () => {
		const ctx = makeContext();
		const element = makeTextElement({
			textSegments: [
				{ text: 'Item one', style: { fontSize: 14 }, bulletInfo: { char: '-' } },
				paragraphBreak(),
				{ text: 'Item two', style: { fontSize: 14 }, bulletInfo: { char: '-' } },
			],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('- Item one');
		expect(result).toContain('- Item two');
	});

	it('should render numbered list items', async () => {
		const ctx = makeContext();
		const element = makeTextElement({
			textSegments: [
				{
					text: 'First',
					style: { fontSize: 14 },
					bulletInfo: { autoNumType: 'arabicPeriod', autoNumStartAt: 1, paragraphIndex: 0 },
				},
				paragraphBreak(),
				{
					text: 'Second',
					style: { fontSize: 14 },
					bulletInfo: { autoNumType: 'arabicPeriod', autoNumStartAt: 1, paragraphIndex: 1 },
				},
			],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('1.');
		expect(result).toContain('2.');
	});

	it('should render center-aligned text as HTML paragraph', async () => {
		const ctx = makeContext();
		const element = makeTextElement({
			textSegments: [
				seg('Centered', { align: 'center' }),
			],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('<p align="center">');
		expect(result).toContain('Centered');
	});

	it('should return null for non-text element types', async () => {
		const ctx = makeContext();
		const element = {
			type: 'image',
			id: 'img_1',
			x: 0, y: 0, width: 100, height: 100,
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).toBeNull();
	});

	it('should handle text with multiple paragraphs', async () => {
		const ctx = makeContext();
		const element = makeTextElement({
			textSegments: [
				seg('First paragraph'),
				paragraphBreak(),
				seg('Second paragraph'),
			],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('First paragraph');
		expect(result).toContain('Second paragraph');
	});

	it('should render prompt text when no content is available', async () => {
		const ctx = makeContext();
		const element = makeTextElement({
			text: undefined,
			textSegments: [],
			promptText: 'Click to add title',
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('[Placeholder: Click to add title]');
	});

	it('should render fallback text when textSegments is absent', async () => {
		const ctx = makeContext();
		const element = makeTextElement({
			text: 'Fallback text',
			textSegments: undefined,
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('Fallback text');
	});

	it('should render superscript and subscript', async () => {
		const ctx = makeContext();
		const element = makeTextElement({
			textSegments: [
				seg('H', {}),
				seg('2', { baseline: -25 }),
				seg('O', {}),
			],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('<sub>2</sub>');
	});

	it('should render underlined text', async () => {
		const ctx = makeContext();
		const element = makeTextElement({
			textSegments: [
				seg('underlined', { underline: true }),
			],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('<u>underlined</u>');
	});

	it('should render text warp annotation', async () => {
		const ctx = makeContext();
		const element = makeTextElement({
			textStyle: { textWarpPreset: 'textWave1' },
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('Text warp: textWave1');
	});

	it('should use HTML formatting when layoutScale is set in non-semantic mode', async () => {
		const ctx = makeContext({ semanticMode: false, layoutScale: 1.0 });
		const element = makeTextElement({
			textSegments: [
				seg('styled', { bold: true }),
			],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		// In HTML mode, bold uses <strong> instead of **
		expect(result).toContain('<strong>');
	});

	it('should handle fallback text with non-left alignment', async () => {
		const ctx = makeContext();
		const element = makeTextElement({
			text: 'Right aligned',
			textSegments: undefined,
			textStyle: { align: 'right' },
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('<p align="right">');
		expect(result).toContain('Right aligned');
	});
});
