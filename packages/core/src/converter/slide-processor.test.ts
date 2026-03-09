import { describe, it, expect } from 'vitest';
import { SlideProcessor } from './SlideProcessor';
import { TextSegmentRenderer } from './TextSegmentRenderer';
import { MediaContext } from './media-context';
import {
	ElementProcessorRegistry,
	type ElementProcessorContext,
} from './elements/ElementProcessor';
import { TextElementProcessor } from './elements/TextElementProcessor';
import type { PptxSlide, PptxElement } from '../core';

function makeRegistry(): ElementProcessorRegistry {
	const registry = new ElementProcessorRegistry();
	const textRenderer = new TextSegmentRenderer();
	registry.register(new TextElementProcessor(textRenderer));
	return registry;
}

function makeSlide(overrides: Partial<PptxSlide> = {}): PptxSlide {
	return {
		id: 'slide1',
		rId: 'rId2',
		slideNumber: 1,
		elements: [],
		...overrides,
	} as PptxSlide;
}

function makeTextElement(
	id: string,
	text: string,
	x: number,
	y: number,
	overrides: Record<string, unknown> = {}
): PptxElement {
	return {
		type: 'text',
		id,
		x,
		y,
		width: 400,
		height: 50,
		text,
		textSegments: [
			{ text, style: { fontSize: 14 } },
		],
		...overrides,
	} as unknown as PptxElement;
}

describe('SlideProcessor', () => {
	const textRenderer = new TextSegmentRenderer();
	const mediaContext = new MediaContext('/out', 'media');
	const registry = makeRegistry();
	const processor = new SlideProcessor(registry, mediaContext, textRenderer);

	it('should generate slide heading with slide number', async () => {
		const slide = makeSlide({ slideNumber: 3 });
		const result = await processor.processSlide(slide, {
			includeSpeakerNotes: false,
			slideWidth: 960,
			slideHeight: 540,
			semanticMode: true,
		});
		expect(result).toContain('## Slide 3');
	});

	it('should detect title from title placeholder', async () => {
		const slide = makeSlide({
			slideNumber: 1,
			elements: [
				{
					...makeTextElement('txt_title', 'Welcome Slide', 50, 30),
					placeholderType: 'title',
				} as unknown as PptxElement,
			],
		});
		const result = await processor.processSlide(slide, {
			includeSpeakerNotes: false,
			slideWidth: 960,
			slideHeight: 540,
			semanticMode: true,
		});
		expect(result).toContain('## Slide 1: Welcome Slide');
	});

	it('should detect title from ctrTitle placeholder', async () => {
		const slide = makeSlide({
			slideNumber: 1,
			elements: [
				{
					...makeTextElement('txt_ctrtitle', 'Center Title', 200, 200),
					placeholderType: 'ctrTitle',
				} as unknown as PptxElement,
			],
		});
		const result = await processor.processSlide(slide, {
			includeSpeakerNotes: false,
			slideWidth: 960,
			slideHeight: 540,
			semanticMode: true,
		});
		expect(result).toContain('## Slide 1: Center Title');
	});

	it('should detect title from first text element when no placeholder', async () => {
		const slide = makeSlide({
			slideNumber: 2,
			elements: [
				makeTextElement('txt_1', 'Auto-detected Title', 50, 30),
				makeTextElement('txt_2', 'Body text', 50, 100),
			],
		});
		const result = await processor.processSlide(slide, {
			includeSpeakerNotes: false,
			slideWidth: 960,
			slideHeight: 540,
			semanticMode: true,
		});
		expect(result).toContain('## Slide 2: Auto-detected Title');
	});

	it('should include hidden flag in heading', async () => {
		const slide = makeSlide({
			slideNumber: 5,
			hidden: true,
			elements: [makeTextElement('txt_1', 'Hidden slide', 50, 30)],
		});
		const result = await processor.processSlide(slide, {
			includeSpeakerNotes: false,
			slideWidth: 960,
			slideHeight: 540,
			semanticMode: true,
		});
		expect(result).toContain('*(hidden)*');
	});

	it('should include layout name in heading', async () => {
		const slide = makeSlide({
			slideNumber: 1,
			layoutName: 'Title and Content',
			elements: [makeTextElement('txt_1', 'Content', 50, 30)],
		});
		const result = await processor.processSlide(slide, {
			includeSpeakerNotes: false,
			slideWidth: 960,
			slideHeight: 540,
			semanticMode: true,
		});
		expect(result).toContain('layout: Title and Content');
	});

	it('should sort elements in reading order (top-to-bottom, left-to-right)', async () => {
		const slide = makeSlide({
			slideNumber: 1,
			elements: [
				makeTextElement('txt_bottom', 'Bottom', 50, 300),
				makeTextElement('txt_top_right', 'Top Right', 500, 30),
				makeTextElement('txt_top_left', 'Top Left', 50, 30),
			],
		});
		const result = await processor.processSlide(slide, {
			includeSpeakerNotes: false,
			slideWidth: 960,
			slideHeight: 540,
			semanticMode: true,
		});
		// In semantic mode, all elements should appear
		expect(result).toContain('Top Left');
		expect(result).toContain('Top Right');
		expect(result).toContain('Bottom');
		// Top Left and Top Right should appear before Bottom
		const topLeftIndex = result.indexOf('Top Left');
		const bottomIndex = result.indexOf('Bottom');
		expect(topLeftIndex).toBeLessThan(bottomIndex);
	});

	it('should render speaker notes when enabled', async () => {
		const slide = makeSlide({
			slideNumber: 1,
			elements: [makeTextElement('txt_1', 'Content', 50, 30)],
			notes: 'Remember to pause here',
		});
		const result = await processor.processSlide(slide, {
			includeSpeakerNotes: true,
			slideWidth: 960,
			slideHeight: 540,
			semanticMode: true,
		});
		expect(result).toContain('> **Speaker Notes**');
		expect(result).toContain('Remember to pause here');
	});

	it('should omit speaker notes when disabled', async () => {
		const slide = makeSlide({
			slideNumber: 1,
			elements: [makeTextElement('txt_1', 'Content', 50, 30)],
			notes: 'Secret notes',
		});
		const result = await processor.processSlide(slide, {
			includeSpeakerNotes: false,
			slideWidth: 960,
			slideHeight: 540,
			semanticMode: true,
		});
		expect(result).not.toContain('Secret notes');
	});

	it('should render transition information', async () => {
		const slide = makeSlide({
			slideNumber: 1,
			elements: [],
			transition: {
				type: 'fade',
				durationMs: 500,
			} as PptxSlide['transition'],
		});
		const result = await processor.processSlide(slide, {
			includeSpeakerNotes: false,
			slideWidth: 960,
			slideHeight: 540,
			semanticMode: true,
		});
		expect(result).toContain('Transition');
		expect(result).toContain('fade');
		expect(result).toContain('500ms');
	});

	it('should render comments', async () => {
		const slide = makeSlide({
			slideNumber: 1,
			elements: [],
			comments: [
				{
					author: 'Alice',
					text: 'Please review this slide',
					createdAt: '2024-01-15',
				} as PptxSlide['comments'] extends (infer U)[] | undefined ? U : never,
			],
		});
		const result = await processor.processSlide(slide, {
			includeSpeakerNotes: false,
			slideWidth: 960,
			slideHeight: 540,
			semanticMode: true,
		});
		expect(result).toContain('### Comments');
		expect(result).toContain('Alice');
		expect(result).toContain('Please review this slide');
	});

	it('should render warnings', async () => {
		const slide = makeSlide({
			slideNumber: 1,
			elements: [],
			warnings: [
				{
					message: 'Unsupported transition effect',
					severity: 'warning',
				} as PptxSlide['warnings'] extends (infer U)[] | undefined ? U : never,
			],
		});
		const result = await processor.processSlide(slide, {
			includeSpeakerNotes: false,
			slideWidth: 960,
			slideHeight: 540,
			semanticMode: true,
		});
		expect(result).toContain('### Warnings');
		expect(result).toContain('Unsupported transition effect');
	});

	it('should use positioned HTML layout in non-semantic mode', async () => {
		const slide = makeSlide({
			slideNumber: 1,
			elements: [makeTextElement('txt_1', 'Positioned', 100, 50)],
		});
		const result = await processor.processSlide(slide, {
			includeSpeakerNotes: false,
			slideWidth: 960,
			slideHeight: 540,
			semanticMode: false,
		});
		expect(result).toContain('position:relative');
		expect(result).toContain('position:absolute');
		expect(result).toContain('border:1px solid #e5e7eb');
	});

	it('should handle empty slide', async () => {
		const slide = makeSlide({
			slideNumber: 1,
			elements: [],
		});
		const result = await processor.processSlide(slide, {
			includeSpeakerNotes: false,
			slideWidth: 960,
			slideHeight: 540,
			semanticMode: true,
		});
		expect(result).toContain('## Slide 1');
		// No additional content beyond the heading
	});

	it('should handle slide with both hidden and layout flags', async () => {
		const slide = makeSlide({
			slideNumber: 7,
			hidden: true,
			layoutName: 'Blank',
			elements: [],
		});
		const result = await processor.processSlide(slide, {
			includeSpeakerNotes: false,
			slideWidth: 960,
			slideHeight: 540,
			semanticMode: true,
		});
		expect(result).toContain('hidden');
		expect(result).toContain('layout: Blank');
	});

	it('should truncate long titles to 120 chars', async () => {
		const longTitle = 'A'.repeat(200);
		const slide = makeSlide({
			slideNumber: 1,
			elements: [
				{
					...makeTextElement('txt_title', longTitle, 50, 30),
					placeholderType: 'title',
				} as unknown as PptxElement,
			],
		});
		const result = await processor.processSlide(slide, {
			includeSpeakerNotes: false,
			slideWidth: 960,
			slideHeight: 540,
			semanticMode: true,
		});
		// The heading line should contain the truncated title
		const headingLine = result.split('\n')[0];
		expect(headingLine).toContain('## Slide 1:');
		// The title portion (after "## Slide 1: ") should be at most 120 chars
		const titlePart = headingLine.replace(/^## Slide 1: /, '');
		expect(titlePart.length).toBeLessThanOrEqual(120);
	});
});
