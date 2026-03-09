import { describe, it, expect } from 'vitest';
import { MediaElementProcessor } from './elements/MediaElementProcessor';
import { OleElementProcessor } from './elements/OleElementProcessor';
import { SmartArtElementProcessor } from './elements/SmartArtElementProcessor';
import { InkElementProcessor } from './elements/InkElementProcessor';
import { FallbackElementProcessor } from './elements/FallbackElementProcessor';
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

// ── MediaElementProcessor ──

describe('MediaElementProcessor', () => {
	const processor = new MediaElementProcessor();

	it('should report supportedTypes as ["media"]', () => {
		expect(processor.supportedTypes).toEqual(['media']);
	});

	it('should return null for non-media elements', async () => {
		const element = { type: 'shape', id: 's1', x: 0, y: 0, width: 100, height: 100 } as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toBeNull();
	});

	it('should render a video element with path and duration', async () => {
		const element = {
			type: 'media',
			id: 'v1',
			x: 0,
			y: 0,
			width: 640,
			height: 360,
			mediaType: 'video',
			mediaPath: 'ppt/media/video1.mp4',
			metadata: { duration: 125 },
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('Video: video1.mp4');
		expect(result).toContain('Duration: 2:05');
		expect(result).toContain('Path: ppt/media/video1.mp4');
	});

	it('should render an audio element', async () => {
		const element = {
			type: 'media',
			id: 'a1',
			x: 0,
			y: 0,
			width: 200,
			height: 50,
			mediaType: 'audio',
			mediaPath: 'ppt/media/audio1.mp3',
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('Audio: audio1.mp3');
	});

	it('should indicate when media is missing', async () => {
		const element = {
			type: 'media',
			id: 'm1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			mediaType: 'video',
			mediaMissing: true,
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('Media source is missing');
	});

	it('should include loop and autoPlay in details', async () => {
		const element = {
			type: 'media',
			id: 'm2',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			mediaType: 'video',
			mediaPath: 'ppt/media/v.mp4',
			loop: true,
			autoPlay: true,
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('Looping');
		expect(result).toContain('Auto-play');
	});

	it('should include resolution when metadata has dimensions', async () => {
		const element = {
			type: 'media',
			id: 'm3',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			mediaType: 'video',
			mediaPath: 'ppt/media/v.mp4',
			metadata: { videoWidth: 1920, videoHeight: 1080 },
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('Resolution: 1920x1080');
	});
});

// ── OleElementProcessor ──

describe('OleElementProcessor', () => {
	const processor = new OleElementProcessor();

	it('should report supportedTypes as ["ole"]', () => {
		expect(processor.supportedTypes).toEqual(['ole']);
	});

	it('should return null for non-ole elements', async () => {
		const element = { type: 'text', id: 't1', x: 0, y: 0, width: 100, height: 100 } as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toBeNull();
	});

	it('should render an embedded Excel object with progId', async () => {
		const element = {
			type: 'ole',
			id: 'ole1',
			x: 0,
			y: 0,
			width: 400,
			height: 300,
			oleObjectType: 'excel',
			fileName: 'budget.xlsx',
			oleFileExtension: 'xlsx',
			oleProgId: 'Excel.Sheet.12',
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('Embedded excel: budget.xlsx');
		expect(result).toContain('Extension: .xlsx');
		expect(result).toContain('Program ID: Excel.Sheet.12');
	});

	it('should indicate linked objects', async () => {
		const element = {
			type: 'ole',
			id: 'ole2',
			x: 0,
			y: 0,
			width: 400,
			height: 300,
			oleObjectType: 'word',
			oleName: 'report.docx',
			isLinked: true,
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('Linked object');
	});

	it('should fall back to oleName when fileName is absent', async () => {
		const element = {
			type: 'ole',
			id: 'ole3',
			x: 0,
			y: 0,
			width: 400,
			height: 300,
			oleObjectType: 'pdf',
			oleName: 'document.pdf',
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('document.pdf');
	});
});

// ── SmartArtElementProcessor ──

describe('SmartArtElementProcessor', () => {
	const processor = new SmartArtElementProcessor();

	it('should report supportedTypes as ["smartArt"]', () => {
		expect(processor.supportedTypes).toEqual(['smartArt']);
	});

	it('should return null for non-smartArt elements', async () => {
		const element = { type: 'shape', id: 's1', x: 0, y: 0, width: 100, height: 100 } as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toBeNull();
	});

	it('should return "no nodes" when smartArtData has empty nodes', async () => {
		const element = {
			type: 'smartArt',
			id: 'sa1',
			x: 0,
			y: 0,
			width: 600,
			height: 400,
			smartArtData: { nodes: [] },
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toBe('*[SmartArt: no nodes]*');
	});

	it('should render process layout as an ordered list', async () => {
		const element = {
			type: 'smartArt',
			id: 'sa2',
			x: 0,
			y: 0,
			width: 600,
			height: 400,
			smartArtData: {
				resolvedLayoutType: 'process',
				nodes: [
					{ id: 'n1', text: 'Step 1' },
					{ id: 'n2', text: 'Step 2' },
					{ id: 'n3', text: 'Step 3' },
				],
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('*[SmartArt: process]*');
		expect(result).toContain('1. Step 1');
		expect(result).toContain('2. Step 2');
		expect(result).toContain('3. Step 3');
	});

	it('should render hierarchy layout as a nested list', async () => {
		const element = {
			type: 'smartArt',
			id: 'sa3',
			x: 0,
			y: 0,
			width: 600,
			height: 400,
			smartArtData: {
				resolvedLayoutType: 'hierarchy',
				nodes: [
					{
						id: 'n1',
						text: 'CEO',
						children: [
							{ id: 'n2', text: 'VP Engineering', children: [] },
							{ id: 'n3', text: 'VP Sales', children: [] },
						],
					},
				],
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('*[SmartArt: hierarchy]*');
		expect(result).toContain('- CEO');
		expect(result).toContain('  - VP Engineering');
		expect(result).toContain('  - VP Sales');
	});

	it('should render list layout as bullet list', async () => {
		const element = {
			type: 'smartArt',
			id: 'sa4',
			x: 0,
			y: 0,
			width: 600,
			height: 400,
			smartArtData: {
				resolvedLayoutType: 'list',
				nodes: [
					{ id: 'n1', text: 'Item A' },
					{ id: 'n2', text: 'Item B' },
				],
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('- Item A');
		expect(result).toContain('- Item B');
	});

	it('should render relationship layout with arrow separators', async () => {
		const element = {
			type: 'smartArt',
			id: 'sa5',
			x: 0,
			y: 0,
			width: 600,
			height: 400,
			smartArtData: {
				resolvedLayoutType: 'relationship',
				nodes: [
					{ id: 'n1', text: 'Cause' },
					{ id: 'n2', text: 'Effect' },
				],
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('Cause -> Effect');
	});
});

// ── InkElementProcessor ──

describe('InkElementProcessor', () => {
	const processor = new InkElementProcessor();

	it('should report supportedTypes as ["ink"]', () => {
		expect(processor.supportedTypes).toEqual(['ink']);
	});

	it('should return null for non-ink elements', async () => {
		const element = { type: 'shape', id: 's1', x: 0, y: 0, width: 100, height: 100 } as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toBeNull();
	});

	it('should render ink drawing with stroke count', async () => {
		const element = {
			type: 'ink',
			id: 'ink1',
			x: 0,
			y: 0,
			width: 400,
			height: 300,
			inkPaths: ['M0 0 L100 100', 'M50 50 L200 200', 'M10 10 L30 30'],
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('3 strokes');
	});

	it('should render singular "stroke" for single path', async () => {
		const element = {
			type: 'ink',
			id: 'ink2',
			x: 0,
			y: 0,
			width: 400,
			height: 300,
			inkPaths: ['M0 0 L100 100'],
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('1 stroke');
		expect(result).not.toContain('1 strokes');
	});

	it('should include color info when available', async () => {
		const element = {
			type: 'ink',
			id: 'ink3',
			x: 0,
			y: 0,
			width: 400,
			height: 300,
			inkPaths: ['M0 0 L100 100', 'M50 50 L200 200'],
			inkColors: ['#FF0000', '#0000FF'],
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('colors #FF0000, #0000FF');
	});

	it('should show tool type when specified', async () => {
		const element = {
			type: 'ink',
			id: 'ink4',
			x: 0,
			y: 0,
			width: 400,
			height: 300,
			inkPaths: ['M0 0 L100 100'],
			inkTool: 'highlighter',
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('tool highlighter');
	});

	it('should show average opacity when opacities are present', async () => {
		const element = {
			type: 'ink',
			id: 'ink5',
			x: 0,
			y: 0,
			width: 400,
			height: 300,
			inkPaths: ['M0 0 L100 100', 'M50 50 L200 200'],
			inkOpacities: [0.5, 0.7],
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('opacity 60%');
	});
});

// ── FallbackElementProcessor ──

describe('FallbackElementProcessor', () => {
	const processor = new FallbackElementProcessor();

	it('should report supportedTypes as ["zoom", "contentPart", "unknown"]', () => {
		expect(processor.supportedTypes).toEqual([
			'zoom',
			'contentPart',
			'unknown',
		]);
	});

	it('should render slide zoom with target slide number', async () => {
		const element = {
			type: 'zoom',
			id: 'zm1',
			x: 0,
			y: 0,
			width: 200,
			height: 120,
			zoomType: 'slide',
			targetSlideIndex: 4,
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('Zoom to Slide 5');
	});

	it('should render section zoom with section ID', async () => {
		const element = {
			type: 'zoom',
			id: 'zm2',
			x: 0,
			y: 0,
			width: 200,
			height: 120,
			zoomType: 'section',
			targetSlideIndex: 2,
			targetSectionId: 'sec_intro',
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('Zoom to Section sec_intro (Slide 3)');
	});

	it('should render contentPart with ink strokes', async () => {
		const element = {
			type: 'contentPart',
			id: 'cp1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			inkStrokes: [
				{ path: 'M0 0', color: '#000', width: 1, opacity: 1 },
				{ path: 'M1 1', color: '#000', width: 1, opacity: 1 },
			],
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('Ink Content: 2 strokes');
	});

	it('should render contentPart without strokes as generic label', async () => {
		const element = {
			type: 'contentPart',
			id: 'cp2',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toBe('*[Content Part]*');
	});

	it('should render unknown element type', async () => {
		const element = {
			type: 'unknown',
			id: 'u1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toBe('*[Unsupported Element]*');
	});

	it('should return null for unrecognised types', async () => {
		const element = {
			type: 'shape',
			id: 's1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toBeNull();
	});
});
