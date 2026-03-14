/**
 * Additional edge-case tests for converter element processors.
 * Covers untested code paths in SmartArt, Media, OLE, Ink, Fallback,
 * and the base utilities (normalizePath, deriveOutputPath, MediaContext).
 */
import { describe, it, expect } from 'vitest';
import { SmartArtElementProcessor } from './elements/SmartArtElementProcessor';
import { MediaElementProcessor } from './elements/MediaElementProcessor';
import { OleElementProcessor } from './elements/OleElementProcessor';
import { InkElementProcessor } from './elements/InkElementProcessor';
import { FallbackElementProcessor } from './elements/FallbackElementProcessor';
import { ChartElementProcessor } from './elements/ChartElementProcessor';
import { TableElementProcessor } from './elements/TableElementProcessor';
import type { ElementProcessorContext } from './elements/ElementProcessor';
import type { PptxElement } from '../core';
import { MediaContext, dataUrlToMediaBytes, generateMediaFilename } from './media-context';
import { normalizePath, getDirectory, deriveOutputPath } from './base';

// ── Helpers ──────────────────────────────────────────────────────────

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

// ── SmartArt edge cases ──────────────────────────────────────────────

describe('SmartArtElementProcessor – additional edge cases', () => {
	const processor = new SmartArtElementProcessor();

	it('should render cycle layout as ordered list', async () => {
		const element = {
			type: 'smartArt',
			id: 'sa1',
			x: 0, y: 0, width: 600, height: 400,
			smartArtData: {
				resolvedLayoutType: 'cycle',
				nodes: [
					{ id: 'n1', text: 'Plan' },
					{ id: 'n2', text: 'Do' },
					{ id: 'n3', text: 'Check' },
					{ id: 'n4', text: 'Act' },
				],
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('*[SmartArt: cycle]*');
		expect(result).toContain('1. Plan');
		expect(result).toContain('2. Do');
		expect(result).toContain('3. Check');
		expect(result).toContain('4. Act');
	});

	it('should render timeline layout as ordered list', async () => {
		const element = {
			type: 'smartArt',
			id: 'sa2',
			x: 0, y: 0, width: 600, height: 400,
			smartArtData: {
				resolvedLayoutType: 'timeline',
				nodes: [
					{ id: 'n1', text: '2020' },
					{ id: 'n2', text: '2021' },
					{ id: 'n3', text: '2022' },
				],
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('*[SmartArt: timeline]*');
		expect(result).toContain('1. 2020');
		expect(result).toContain('2. 2021');
		expect(result).toContain('3. 2022');
	});

	it('should render pyramid layout as nested list', async () => {
		const element = {
			type: 'smartArt',
			id: 'sa3',
			x: 0, y: 0, width: 600, height: 400,
			smartArtData: {
				resolvedLayoutType: 'pyramid',
				nodes: [
					{
						id: 'n1',
						text: 'Top',
						children: [
							{ id: 'n2', text: 'Middle', children: [] },
						],
					},
				],
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('*[SmartArt: pyramid]*');
		expect(result).toContain('- Top');
		expect(result).toContain('  - Middle');
	});

	it('should render funnel layout as nested list', async () => {
		const element = {
			type: 'smartArt',
			id: 'sa4',
			x: 0, y: 0, width: 600, height: 400,
			smartArtData: {
				resolvedLayoutType: 'funnel',
				nodes: [
					{ id: 'n1', text: 'Wide', children: [] },
					{ id: 'n2', text: 'Narrow', children: [] },
				],
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('*[SmartArt: funnel]*');
		expect(result).toContain('- Wide');
		expect(result).toContain('- Narrow');
	});

	it('should render matrix layout as bullet list', async () => {
		const element = {
			type: 'smartArt',
			id: 'sa5',
			x: 0, y: 0, width: 600, height: 400,
			smartArtData: {
				resolvedLayoutType: 'matrix',
				nodes: [
					{ id: 'n1', text: 'Quadrant 1' },
					{ id: 'n2', text: 'Quadrant 2' },
				],
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('- Quadrant 1');
		expect(result).toContain('- Quadrant 2');
	});

	it('should render unknown layout type as bullet list fallback', async () => {
		const element = {
			type: 'smartArt',
			id: 'sa6',
			x: 0, y: 0, width: 600, height: 400,
			smartArtData: {
				resolvedLayoutType: 'custom_layout',
				nodes: [
					{ id: 'n1', text: 'Node A' },
					{ id: 'n2', text: 'Node B' },
				],
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('*[SmartArt: custom_layout]*');
		expect(result).toContain('- Node A');
		expect(result).toContain('- Node B');
	});

	it('should resolve flat nodes with parentId into tree structure', async () => {
		const element = {
			type: 'smartArt',
			id: 'sa7',
			x: 0, y: 0, width: 600, height: 400,
			smartArtData: {
				resolvedLayoutType: 'hierarchy',
				nodes: [
					{ id: 'n1', text: 'Root' },
					{ id: 'n2', text: 'Child 1', parentId: 'n1' },
					{ id: 'n3', text: 'Child 2', parentId: 'n1' },
				],
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('- Root');
		expect(result).toContain('  - Child 1');
		expect(result).toContain('  - Child 2');
	});

	it('should handle relationship layout with single node', async () => {
		const element = {
			type: 'smartArt',
			id: 'sa8',
			x: 0, y: 0, width: 600, height: 400,
			smartArtData: {
				resolvedLayoutType: 'relationship',
				nodes: [
					{ id: 'n1', text: 'Single' },
				],
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('Single');
		expect(result).not.toContain('->');
	});

	it('should handle relationship layout with empty nodes', async () => {
		const element = {
			type: 'smartArt',
			id: 'sa9',
			x: 0, y: 0, width: 600, height: 400,
			smartArtData: {
				resolvedLayoutType: 'relationship',
				nodes: [
					{ id: 'n1', text: '' },
				],
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('*[SmartArt relationship]*');
	});

	it('should handle missing resolvedLayoutType as unknown', async () => {
		const element = {
			type: 'smartArt',
			id: 'sa10',
			x: 0, y: 0, width: 600, height: 400,
			smartArtData: {
				nodes: [
					{ id: 'n1', text: 'Item' },
				],
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('*[SmartArt: unknown]*');
		expect(result).toContain('- Item');
	});

	it('should handle missing smartArtData', async () => {
		const element = {
			type: 'smartArt',
			id: 'sa11',
			x: 0, y: 0, width: 600, height: 400,
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toBe('*[SmartArt: no nodes]*');
	});
});

// ── Media edge cases ────────────────────────────────────────────────

describe('MediaElementProcessor – additional edge cases', () => {
	const processor = new MediaElementProcessor();

	it('should render unknown media type', async () => {
		const element = {
			type: 'media',
			id: 'm1',
			x: 0, y: 0, width: 100, height: 100,
			mediaType: 'unknown',
			mediaPath: 'ppt/media/file.bin',
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('Media: file.bin');
	});

	it('should render media without path as "embedded media"', async () => {
		const element = {
			type: 'media',
			id: 'm2',
			x: 0, y: 0, width: 100, height: 100,
			mediaType: 'video',
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('Video: embedded media');
	});

	it('should include MIME type when present', async () => {
		const element = {
			type: 'media',
			id: 'm3',
			x: 0, y: 0, width: 100, height: 100,
			mediaType: 'video',
			mediaPath: 'ppt/media/v.mp4',
			mediaMimeType: 'video/mp4',
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('MIME: video/mp4');
	});

	it('should include playAcrossSlides flag', async () => {
		const element = {
			type: 'media',
			id: 'm4',
			x: 0, y: 0, width: 100, height: 100,
			mediaType: 'audio',
			mediaPath: 'ppt/media/bg.mp3',
			playAcrossSlides: true,
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('Plays across slides');
	});

	it('should render caption tracks', async () => {
		const element = {
			type: 'media',
			id: 'm5',
			x: 0, y: 0, width: 100, height: 100,
			mediaType: 'video',
			mediaPath: 'ppt/media/v.mp4',
			captionTracks: [
				{ label: 'English', language: 'en' },
				{ label: 'Spanish', language: 'es' },
			],
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('Captions: English (en), Spanish (es)');
	});

	it('should format zero-second duration', async () => {
		const element = {
			type: 'media',
			id: 'm6',
			x: 0, y: 0, width: 100, height: 100,
			mediaType: 'video',
			mediaPath: 'ppt/media/v.mp4',
			metadata: { duration: 0 },
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('Duration: 0:00');
	});

	it('should format long duration correctly', async () => {
		const element = {
			type: 'media',
			id: 'm7',
			x: 0, y: 0, width: 100, height: 100,
			mediaType: 'video',
			mediaPath: 'ppt/media/v.mp4',
			metadata: { duration: 3661 },
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('Duration: 61:01');
	});
});

// ── OLE edge cases ──────────────────────────────────────────────────

describe('OleElementProcessor – additional edge cases', () => {
	const processor = new OleElementProcessor();

	it('should render default name when both fileName and oleName are absent', async () => {
		const element = {
			type: 'ole',
			id: 'ole1',
			x: 0, y: 0, width: 400, height: 300,
			oleObjectType: 'generic',
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('embedded-object');
	});

	it('should render unknown object type when oleObjectType is missing', async () => {
		const element = {
			type: 'ole',
			id: 'ole2',
			x: 0, y: 0, width: 400, height: 300,
			fileName: 'data.bin',
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('Embedded unknown: data.bin');
	});

	it('should not render file extension when not present', async () => {
		const element = {
			type: 'ole',
			id: 'ole3',
			x: 0, y: 0, width: 400, height: 300,
			oleObjectType: 'pdf',
			fileName: 'doc.pdf',
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).not.toContain('Extension:');
	});
});

// ── Ink edge cases ──────────────────────────────────────────────────

describe('InkElementProcessor – additional edge cases', () => {
	const processor = new InkElementProcessor();

	it('should display "N colors" when more than 4 unique colors', async () => {
		const element = {
			type: 'ink',
			id: 'ink1',
			x: 0, y: 0, width: 400, height: 300,
			inkPaths: ['M0 0', 'M1 1', 'M2 2', 'M3 3', 'M4 4'],
			inkColors: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'],
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('5 colors');
	});

	it('should deduplicate colors before counting', async () => {
		const element = {
			type: 'ink',
			id: 'ink2',
			x: 0, y: 0, width: 400, height: 300,
			inkPaths: ['M0 0', 'M1 1', 'M2 2', 'M3 3', 'M4 4', 'M5 5'],
			inkColors: ['#FF0000', '#FF0000', '#00FF00', '#00FF00', '#0000FF', '#FFFF00'],
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		// 4 unique colors => listed individually
		expect(result).toContain('colors #FF0000, #00FF00, #0000FF, #FFFF00');
	});

	it('should handle empty inkPaths gracefully', async () => {
		const element = {
			type: 'ink',
			id: 'ink3',
			x: 0, y: 0, width: 400, height: 300,
			inkPaths: [],
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('0 strokes');
	});

	it('should handle eraser tool type', async () => {
		const element = {
			type: 'ink',
			id: 'ink4',
			x: 0, y: 0, width: 400, height: 300,
			inkPaths: ['M0 0 L100 100'],
			inkTool: 'eraser',
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('tool eraser');
	});

	it('should handle pen tool type', async () => {
		const element = {
			type: 'ink',
			id: 'ink5',
			x: 0, y: 0, width: 400, height: 300,
			inkPaths: ['M0 0 L100 100'],
			inkTool: 'pen',
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('tool pen');
	});

	it('should handle opacity of 100%', async () => {
		const element = {
			type: 'ink',
			id: 'ink6',
			x: 0, y: 0, width: 400, height: 300,
			inkPaths: ['M0 0 L100 100'],
			inkOpacities: [1.0],
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('opacity 100%');
	});
});

// ── Fallback edge cases ─────────────────────────────────────────────

describe('FallbackElementProcessor – additional edge cases', () => {
	const processor = new FallbackElementProcessor();

	it('should render section zoom without sectionId', async () => {
		const element = {
			type: 'zoom',
			id: 'zm1',
			x: 0, y: 0, width: 200, height: 120,
			zoomType: 'section',
			targetSlideIndex: 3,
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('Zoom to Section (Slide 4)');
	});

	it('should render contentPart with single stroke (singular)', async () => {
		const element = {
			type: 'contentPart',
			id: 'cp1',
			x: 0, y: 0, width: 100, height: 100,
			inkStrokes: [
				{ path: 'M0 0', color: '#000', width: 1, opacity: 1 },
			],
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('Ink Content: 1 stroke');
		expect(result).not.toContain('1 strokes');
	});

	it('should render zoom with imageData', async () => {
		const ctx = makeContext();
		// The image extraction requires data: prefix; mock the context
		const element = {
			type: 'zoom',
			id: 'zm2',
			x: 0, y: 0, width: 200, height: 120,
			zoomType: 'slide',
			targetSlideIndex: 0,
			altText: 'First slide preview',
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).toContain('Zoom to Slide 1');
	});
});

// ── Chart edge cases ────────────────────────────────────────────────

describe('ChartElementProcessor – additional edge cases', () => {
	const processor = new ChartElementProcessor();

	it('should render doughnut chart with percentage', async () => {
		const element = {
			type: 'chart',
			id: 'chart_1',
			x: 0, y: 0, width: 600, height: 400,
			chartData: {
				title: 'Doughnut',
				chartType: 'doughnut',
				categories: ['A', 'B'],
				series: [{ name: 'Values', values: [60, 40] }],
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('%');
		expect(result).toContain('60.0%');
		expect(result).toContain('40.0%');
	});

	it('should render pie3D chart with percentage', async () => {
		const element = {
			type: 'chart',
			id: 'chart_2',
			x: 0, y: 0, width: 600, height: 400,
			chartData: {
				title: '3D Pie',
				chartType: 'pie3D',
				categories: ['X', 'Y'],
				series: [{ name: 'Data', values: [70, 30] }],
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('70.0%');
		expect(result).toContain('30.0%');
	});

	it('should render multiple series without categories as bullet list', async () => {
		const element = {
			type: 'chart',
			id: 'chart_3',
			x: 0, y: 0, width: 600, height: 400,
			chartData: {
				title: 'Multi Series',
				chartType: 'scatter',
				categories: [],
				series: [
					{ name: 'X Values', values: [1, 2, 3] },
					{ name: 'Y Values', values: [4, 5, 6] },
				],
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('- **X Values**: 1, 2, 3');
		expect(result).toContain('- **Y Values**: 4, 5, 6');
	});

	it('should render data labels with custom text', async () => {
		const element = {
			type: 'chart',
			id: 'chart_4',
			x: 0, y: 0, width: 600, height: 400,
			chartData: {
				title: 'Custom Labels',
				chartType: 'bar',
				categories: ['A'],
				series: [{
					name: 'S1',
					values: [10],
					dataLabels: [{ idx: 0, text: 'Custom label text' }],
				}],
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('Data labels:');
		expect(result).toContain('S1[0]: "Custom label text"');
	});

	it('should render data labels with showPercent flag', async () => {
		const element = {
			type: 'chart',
			id: 'chart_5',
			x: 0, y: 0, width: 600, height: 400,
			chartData: {
				title: 'Percent Labels',
				chartType: 'pie',
				categories: ['A', 'B'],
				series: [{
					name: 'S1',
					values: [60, 40],
					dataLabels: [
						{ idx: 0, showPercent: true },
					],
				}],
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('percent');
	});

	it('should render date axis type', async () => {
		const element = {
			type: 'chart',
			id: 'chart_6',
			x: 0, y: 0, width: 600, height: 400,
			chartData: {
				title: 'Timeline',
				chartType: 'line',
				categories: ['Jan'],
				series: [{ name: 'S1', values: [10] }],
				axes: [
					{ axisType: 'dateAx', titleText: 'Date' },
				],
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('Date: "Date"');
	});

	it('should render series axis type', async () => {
		const element = {
			type: 'chart',
			id: 'chart_7',
			x: 0, y: 0, width: 600, height: 400,
			chartData: {
				title: '3D Chart',
				chartType: 'bar',
				categories: ['A'],
				series: [{ name: 'S1', values: [10] }],
				axes: [
					{ axisType: 'serAx', titleText: 'Depth' },
				],
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('Series: "Depth"');
	});

	it('should skip axes with no title or format', async () => {
		const element = {
			type: 'chart',
			id: 'chart_8',
			x: 0, y: 0, width: 600, height: 400,
			chartData: {
				title: 'No Axis Info',
				chartType: 'bar',
				categories: ['A'],
				series: [{ name: 'S1', values: [10] }],
				axes: [
					{ axisType: 'catAx' },
				],
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).not.toContain('Axes:');
	});

	it('should handle empty axes array', async () => {
		const element = {
			type: 'chart',
			id: 'chart_9',
			x: 0, y: 0, width: 600, height: 400,
			chartData: {
				title: 'No Axes',
				chartType: 'bar',
				categories: ['A'],
				series: [{ name: 'S1', values: [10] }],
				axes: [],
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).not.toContain('Axes:');
	});

	it('should render error bars with no val', async () => {
		const element = {
			type: 'chart',
			id: 'chart_10',
			x: 0, y: 0, width: 600, height: 400,
			chartData: {
				title: 'Error Bars No Val',
				chartType: 'bar',
				categories: ['A'],
				series: [{
					name: 'S1',
					values: [50],
					errBars: [{
						direction: 'x',
						barType: 'plus',
						valType: 'stdDev',
					}],
				}],
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).toContain('Error bars:');
		expect(result).toContain('x-axis');
		expect(result).toContain('stdDev');
		expect(result).toContain('(plus)');
	});

	it('should not render data table when no flags are true', async () => {
		const element = {
			type: 'chart',
			id: 'chart_11',
			x: 0, y: 0, width: 600, height: 400,
			chartData: {
				title: 'No Data Table Flags',
				chartType: 'bar',
				categories: ['A'],
				series: [{ name: 'S1', values: [1] }],
				dataTable: {
					showHorzBorder: false,
					showVertBorder: false,
					showOutline: false,
					showKeys: false,
				},
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, makeContext());
		expect(result).not.toContain('Data table:');
	});
});

// ── Table edge cases ────────────────────────────────────────────────

describe('TableElementProcessor – additional edge cases', () => {
	const processor = new TableElementProcessor();

	it('should handle table with only one row (header only)', async () => {
		const ctx = makeContext({ semanticMode: true });
		const element = {
			type: 'table',
			id: 'tbl_1',
			x: 0, y: 0, width: 500, height: 100,
			tableData: {
				rows: [
					{ cells: [{ text: 'Only Header' }] },
				],
				columnWidths: [1],
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('| Only Header |');
		expect(result).toContain('| --- |');
	});

	it('should pad rows with fewer cells to match column count', async () => {
		const ctx = makeContext({ semanticMode: true });
		const element = {
			type: 'table',
			id: 'tbl_2',
			x: 0, y: 0, width: 500, height: 200,
			tableData: {
				rows: [
					{ cells: [{ text: 'A' }, { text: 'B' }, { text: 'C' }] },
					{ cells: [{ text: 'D' }] },
				],
				columnWidths: [0.33, 0.33, 0.34],
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		// Second row should have empty cells padded
		const lines = result!.split('\n');
		const dataRow = lines.find((l) => l.includes('| D'));
		expect(dataRow).toBeDefined();
	});

	it('should escape pipe and newline characters in markdown cells', async () => {
		const ctx = makeContext({ semanticMode: true });
		const element = {
			type: 'table',
			id: 'tbl_3',
			x: 0, y: 0, width: 500, height: 200,
			tableData: {
				rows: [
					{ cells: [{ text: 'Header' }] },
					{ cells: [{ text: 'line1\nline2' }] },
				],
				columnWidths: [1],
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		// Newlines within cells should be replaced with spaces
		expect(result).toContain('line1 line2');
	});

	it('should handle vAlign in cell style (HTML mode)', async () => {
		const ctx = makeContext({ semanticMode: false });
		const element = {
			type: 'table',
			id: 'tbl_4',
			x: 0, y: 0, width: 500, height: 200,
			tableData: {
				rows: [
					{
						cells: [{
							text: 'Vertical',
							style: { vAlign: 'middle' },
						}],
					},
				],
				columnWidths: [1],
				firstRowHeader: false,
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('vertical-align:middle');
	});

	it('should handle italic cell style (HTML mode)', async () => {
		const ctx = makeContext({ semanticMode: false });
		const element = {
			type: 'table',
			id: 'tbl_5',
			x: 0, y: 0, width: 500, height: 200,
			tableData: {
				rows: [
					{
						cells: [{
							text: 'Italicized',
							style: { italic: true },
						}],
					},
				],
				columnWidths: [1],
				firstRowHeader: false,
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('font-style:italic');
	});

	it('should render borderColor fallback when per-edge borders are not set (HTML mode)', async () => {
		const ctx = makeContext({ semanticMode: false });
		const element = {
			type: 'table',
			id: 'tbl_6',
			x: 0, y: 0, width: 500, height: 200,
			tableData: {
				rows: [
					{
						cells: [{
							text: 'Global border',
							style: { borderColor: '#333333' },
						}],
					},
				],
				columnWidths: [1],
				firstRowHeader: false,
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('border:1px solid #333333');
	});

	it('should handle cell with null/undefined text (HTML mode)', async () => {
		const ctx = makeContext({ semanticMode: false });
		const element = {
			type: 'table',
			id: 'tbl_7',
			x: 0, y: 0, width: 500, height: 200,
			tableData: {
				rows: [
					{ cells: [{ text: undefined }] },
				],
				columnWidths: [1],
				firstRowHeader: false,
			},
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('<td');
	});
});

// ── Base utility tests ──────────────────────────────────────────────

describe('normalizePath', () => {
	it('should convert backslashes to forward slashes', () => {
		expect(normalizePath('C:\\Users\\docs\\file.md')).toBe(
			'C:/Users/docs/file.md'
		);
	});

	it('should trim whitespace', () => {
		expect(normalizePath('  /path/to/file  ')).toBe('/path/to/file');
	});

	it('should handle already-normalized paths', () => {
		expect(normalizePath('/path/to/file')).toBe('/path/to/file');
	});
});

describe('getDirectory', () => {
	it('should extract directory from path', () => {
		expect(getDirectory('/home/user/doc.md')).toBe('/home/user');
	});

	it('should return "." for bare filename', () => {
		expect(getDirectory('file.txt')).toBe('.');
	});

	it('should return "/" for root path', () => {
		expect(getDirectory('/file.txt')).toBe('/');
	});

	it('should normalize backslashes before extracting', () => {
		expect(getDirectory('C:\\Users\\file.md')).toBe('C:/Users');
	});
});

describe('deriveOutputPath', () => {
	it('should replace extension with .md', () => {
		expect(deriveOutputPath('slides.pptx', undefined)).toBe('slides.md');
	});

	it('should return explicit path when provided', () => {
		expect(deriveOutputPath('slides.pptx', '/tmp/out.md')).toBe(
			'/tmp/out.md'
		);
	});

	it('should return undefined when no source', () => {
		expect(deriveOutputPath(undefined, undefined)).toBeUndefined();
	});

	it('should append .md when source has no extension', () => {
		expect(deriveOutputPath('slides', undefined)).toBe('slides.md');
	});

	it('should normalize backslashes in source path', () => {
		expect(deriveOutputPath('C:\\docs\\slides.pptx', undefined)).toBe(
			'C:/docs/slides.md'
		);
	});
});

// ── MediaContext tests ──────────────────────────────────────────────

describe('MediaContext', () => {
	it('should track total images count', async () => {
		const ctx = new MediaContext('/out', 'media');
		expect(ctx.totalImages).toBe(0);

		await ctx.saveImage(
			'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAAtJREFUCNdjYGBgAAAABAABJzQnCgAAAABJRU5ErkJggg==',
			'slide1'
		);
		expect(ctx.totalImages).toBe(1);
	});

	it('should return media directory path', () => {
		const ctx = new MediaContext('/output', 'images');
		expect(ctx.mediaDir).toBe('/output/images');
	});

	it('should generate sequential filenames', async () => {
		const ctx = new MediaContext('/out', 'media');
		const path1 = await ctx.saveImage(
			'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAAtJREFUCNdjYGBgAAAABAABJzQnCgAAAABJRU5ErkJggg=='
		);
		const path2 = await ctx.saveImage(
			'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
		);

		expect(path1).toContain('image-001');
		expect(path2).toContain('image-002');
	});

	it('should include prefix in filename', async () => {
		const ctx = new MediaContext('/out', 'media');
		const path = await ctx.saveImage(
			'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAAtJREFUCNdjYGBgAAAABAABJzQnCgAAAABJRU5ErkJggg==',
			'slide3'
		);

		expect(path).toContain('slide3-image-001');
	});
});

describe('dataUrlToMediaBytes', () => {
	it('should decode a PNG data URL', () => {
		const result = dataUrlToMediaBytes(
			'data:image/png;base64,AQID'
		);
		expect(result.ext).toBe('png');
		expect(result.bytes).toBeInstanceOf(Uint8Array);
	});

	it('should decode a JPEG data URL', () => {
		const result = dataUrlToMediaBytes(
			'data:image/jpeg;base64,AQID'
		);
		expect(result.ext).toBe('jpg');
	});

	it('should decode an SVG data URL', () => {
		const result = dataUrlToMediaBytes(
			'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='
		);
		expect(result.ext).toBe('svg');
	});

	it('should handle unknown MIME types via subtype fallback', () => {
		const result = dataUrlToMediaBytes(
			'data:image/webp;base64,AQID'
		);
		expect(result.ext).toBe('webp');
	});

	it('should throw for invalid data URL format', () => {
		expect(() => dataUrlToMediaBytes('not-a-data-url')).toThrow(
			'Invalid data URL format'
		);
	});
});

describe('generateMediaFilename', () => {
	it('should generate zero-padded filename', () => {
		expect(generateMediaFilename(1, 'png')).toBe('image-001.png');
		expect(generateMediaFilename(42, 'jpg')).toBe('image-042.jpg');
		expect(generateMediaFilename(999, 'gif')).toBe('image-999.gif');
	});

	it('should strip leading dot from extension', () => {
		expect(generateMediaFilename(1, '.png')).toBe('image-001.png');
	});

	it('should handle large index numbers', () => {
		expect(generateMediaFilename(1234, 'png')).toBe('image-1234.png');
	});
});
