import { describe, it, expect } from 'vitest';

import type { PptxElement } from '../core/types/elements';
import type { PptxSlide, PptxData } from '../core/types/presentation';
import { SvgExporter } from './SvgExporter';

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function makeSlide(overrides: Partial<PptxSlide> = {}): PptxSlide {
	return {
		id: 'slide1',
		rId: 'rId2',
		slideNumber: 1,
		elements: [],
		...overrides,
	};
}

function makeData(slides: PptxSlide[], width = 960, height = 540): PptxData {
	return { slides, width, height };
}

/**
 * Verify that the SVG string is well-formed XML by checking basic structure.
 * (We intentionally avoid a DOM parser so this works headless.)
 */
function assertValidSvgStructure(svg: string): void {
	expect(svg).toMatch(/^<svg /);
	expect(svg).toMatch(/<\/svg>$/);
	expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
	expect(svg).toContain('viewBox=');
	// Check no unescaped ampersands outside of entities
	const stripped = svg.replace(/&(amp|lt|gt|quot|apos);/g, '');
	expect(stripped).not.toContain('&');
}

// ────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────

describe('svgExporter', () => {
	// ── Empty slide ──────────────────────────────────────────────

	it('exports an empty slide as valid SVG with viewBox', () => {
		const slide = makeSlide();
		const svg = SvgExporter.exportSlide(slide, 960, 540);

		assertValidSvgStructure(svg);
		expect(svg).toContain('viewBox="0 0 960 540"');
		expect(svg).toContain('width="960"');
		expect(svg).toContain('height="540"');
	});

	it('includes a white background rect for an empty slide', () => {
		const slide = makeSlide();
		const svg = SvgExporter.exportSlide(slide, 960, 540);

		expect(svg).toContain('<rect');
		expect(svg).toContain('fill="#FFFFFF"');
	});

	// ── Slide with background ────────────────────────────────────

	it('renders a custom background colour', () => {
		const slide = makeSlide({ backgroundColor: '#1A2B3C' });
		const svg = SvgExporter.exportSlide(slide, 960, 540);

		assertValidSvgStructure(svg);
		expect(svg).toContain('fill="#1A2B3C"');
	});

	it('renders a background image', () => {
		const slide = makeSlide({
			backgroundImage: 'data:image/png;base64,iVBOR',
		});
		const svg = SvgExporter.exportSlide(slide, 960, 540);

		assertValidSvgStructure(svg);
		expect(svg).toContain('<image');
		expect(svg).toContain('data:image/png;base64,iVBOR');
	});

	// ── Text element ─────────────────────────────────────────────

	it('renders a text element with <text> and <tspan>', () => {
		const slide = makeSlide({
			elements: [
				{
					type: 'text',
					id: 'txt1',
					x: 50,
					y: 30,
					width: 400,
					height: 60,
					text: 'Hello World',
					textStyle: { fontSize: 24, bold: true, color: '#333333' },
				},
			],
		});
		const svg = SvgExporter.exportSlide(slide, 960, 540);

		assertValidSvgStructure(svg);
		expect(svg).toContain('<text');
		expect(svg).toContain('Hello World');
		expect(svg).toContain('<tspan');
		expect(svg).toContain('font-size="24"');
		expect(svg).toContain('font-weight="bold"');
	});

	it('renders text segments with per-run formatting', () => {
		const slide = makeSlide({
			elements: [
				{
					type: 'text',
					id: 'txt2',
					x: 10,
					y: 10,
					width: 300,
					height: 50,
					text: 'BoldItalic',
					textSegments: [
						{
							text: 'Bold',
							style: { bold: true, fontSize: 20, color: '#FF0000' },
						},
						{
							text: 'Italic',
							style: { italic: true, fontSize: 20, color: '#0000FF' },
						},
					],
					textStyle: { fontSize: 20 },
				},
			],
		});
		const svg = SvgExporter.exportSlide(slide, 960, 540);

		assertValidSvgStructure(svg);
		expect(svg).toContain('font-weight="bold"');
		expect(svg).toContain('font-style="italic"');
		expect(svg).toContain('>Bold</tspan>');
		expect(svg).toContain('>Italic</tspan>');
	});

	// ── Shape element ────────────────────────────────────────────

	it('renders a shape with fill and stroke', () => {
		const slide = makeSlide({
			elements: [
				{
					type: 'shape',
					id: 'shp1',
					x: 100,
					y: 100,
					width: 200,
					height: 150,
					shapeType: 'rect',
					shapeStyle: {
						fillColor: '#00AA55',
						strokeColor: '#000000',
						strokeWidth: 2,
					},
				},
			],
		});
		const svg = SvgExporter.exportSlide(slide, 960, 540);

		assertValidSvgStructure(svg);
		expect(svg).toContain('<rect');
		expect(svg).toContain('fill="#00AA55"');
		expect(svg).toContain('stroke="#000000"');
		expect(svg).toContain('stroke-width="2"');
	});

	it('renders an ellipse shape', () => {
		const slide = makeSlide({
			elements: [
				{
					type: 'shape',
					id: 'shp2',
					x: 0,
					y: 0,
					width: 100,
					height: 80,
					shapeType: 'ellipse',
					shapeStyle: { fillColor: '#FF0000' },
				},
			],
		});
		const svg = SvgExporter.exportSlide(slide, 960, 540);

		assertValidSvgStructure(svg);
		expect(svg).toContain('<ellipse');
		expect(svg).toContain('cx="50"');
		expect(svg).toContain('cy="40"');
	});

	it('renders a roundRect shape with rx', () => {
		const slide = makeSlide({
			elements: [
				{
					type: 'shape',
					id: 'shp3',
					x: 0,
					y: 0,
					width: 200,
					height: 100,
					shapeType: 'roundRect',
					shapeStyle: { fillColor: '#AABB00' },
				},
			],
		});
		const svg = SvgExporter.exportSlide(slide, 960, 540);

		assertValidSvgStructure(svg);
		expect(svg).toContain('<rect');
		expect(svg).toContain('rx=');
	});

	it('renders a triangle shape as polygon', () => {
		const slide = makeSlide({
			elements: [
				{
					type: 'shape',
					id: 'shp4',
					x: 50,
					y: 50,
					width: 100,
					height: 80,
					shapeType: 'triangle',
					shapeStyle: { fillColor: '#00BBCC' },
				},
			],
		});
		const svg = SvgExporter.exportSlide(slide, 960, 540);

		assertValidSvgStructure(svg);
		expect(svg).toContain('<polygon');
		expect(svg).toContain('points=');
	});

	it('renders a shape with fillMode none as transparent', () => {
		const slide = makeSlide({
			elements: [
				{
					type: 'shape',
					id: 'shp5',
					x: 0,
					y: 0,
					width: 100,
					height: 100,
					shapeType: 'rect',
					shapeStyle: { fillMode: 'none', strokeColor: '#FF0000' },
				},
			],
		});
		const svg = SvgExporter.exportSlide(slide, 960, 540);

		assertValidSvgStructure(svg);
		expect(svg).toContain('fill="none"');
	});

	// ── Image element ────────────────────────────────────────────

	it('renders an image element with embedded data', () => {
		const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
		const slide = makeSlide({
			elements: [
				{
					type: 'image',
					id: 'img1',
					x: 0,
					y: 0,
					width: 400,
					height: 300,
					imageData: dataUrl,
				},
			],
		});
		const svg = SvgExporter.exportSlide(slide, 960, 540);

		assertValidSvgStructure(svg);
		expect(svg).toContain('<image');
		expect(svg).toContain(dataUrl);
	});

	it('renders a placeholder for image without data', () => {
		const slide = makeSlide({
			elements: [
				{
					type: 'image',
					id: 'img2',
					x: 0,
					y: 0,
					width: 200,
					height: 150,
				},
			],
		});
		const svg = SvgExporter.exportSlide(slide, 960, 540);

		assertValidSvgStructure(svg);
		expect(svg).toContain('fill="#E0E0E0"');
		expect(svg).toContain('>image</text>');
	});

	// ── Connector element ────────────────────────────────────────

	it('renders a connector as a line', () => {
		const slide = makeSlide({
			elements: [
				{
					type: 'connector',
					id: 'cxn1',
					x: 50,
					y: 50,
					width: 200,
					height: 100,
					shapeStyle: {
						strokeColor: '#0000FF',
						strokeWidth: 2,
					},
				},
			],
		});
		const svg = SvgExporter.exportSlide(slide, 960, 540);

		assertValidSvgStructure(svg);
		expect(svg).toContain('<line');
		expect(svg).toContain('stroke="#0000FF"');
	});

	it('renders connector with end arrow marker', () => {
		const slide = makeSlide({
			elements: [
				{
					type: 'connector',
					id: 'cxn2',
					x: 0,
					y: 0,
					width: 100,
					height: 0,
					shapeStyle: {
						strokeColor: '#333',
						connectorEndArrow: 'triangle',
					},
				},
			],
		});
		const svg = SvgExporter.exportSlide(slide, 960, 540);

		assertValidSvgStructure(svg);
		expect(svg).toContain('<marker');
		expect(svg).toContain('marker-end=');
		expect(svg).toContain('<defs>');
	});

	// ── Table element ────────────────────────────────────────────

	it('renders a table with cells', () => {
		const slide = makeSlide({
			elements: [
				{
					type: 'table',
					id: 'tbl1',
					x: 50,
					y: 100,
					width: 400,
					height: 200,
					tableData: {
						rows: [
							{
								cells: [{ text: 'Name', style: { bold: true } }, { text: 'Score' }],
							},
							{
								cells: [{ text: 'Alice' }, { text: '95' }],
							},
						],
						columnWidths: [0.5, 0.5],
					},
				},
			],
		});
		const svg = SvgExporter.exportSlide(slide, 960, 540);

		assertValidSvgStructure(svg);
		expect(svg).toContain('>Name</text>');
		expect(svg).toContain('>Alice</text>');
		expect(svg).toContain('>95</text>');
	});

	// ── Group element ────────────────────────────────────────────

	it('renders a group with nested children', () => {
		const slide = makeSlide({
			elements: [
				{
					type: 'group',
					id: 'grp1',
					x: 10,
					y: 10,
					width: 500,
					height: 300,
					children: [
						{
							type: 'shape',
							id: 'child1',
							x: 0,
							y: 0,
							width: 100,
							height: 100,
							shapeType: 'rect',
							shapeStyle: { fillColor: '#AAAAAA' },
						} as PptxElement,
						{
							type: 'text',
							id: 'child2',
							x: 110,
							y: 0,
							width: 200,
							height: 50,
							text: 'In group',
						} as PptxElement,
					],
				},
			],
		});
		const svg = SvgExporter.exportSlide(slide, 960, 540);

		assertValidSvgStructure(svg);
		expect(svg).toContain('fill="#AAAAAA"');
		expect(svg).toContain('>In group</tspan>');
	});

	// ── Rich elements ────────────────────────────────────────────

	it('renders chart data as SVG marks instead of a placeholder', () => {
		const slide = makeSlide({
			elements: [
				{
					type: 'chart',
					id: 'ch1',
					x: 0,
					y: 0,
					width: 300,
					height: 200,
					chartData: {
						chartType: 'bar',
						title: 'Quarterly revenue',
						categories: ['Q1', 'Q2'],
						series: [{ name: 'Revenue', values: [12, 18], color: '#123456' }],
					},
				},
			],
		});
		const svg = SvgExporter.exportSlide(slide, 960, 540);

		assertValidSvgStructure(svg);
		expect(svg).toContain('data-pptx-element="chart"');
		expect(svg).toContain('data-chart-mark="bar"');
		expect(svg).toContain('fill="#123456"');
		expect(svg).toContain('Quarterly revenue');
		expect(svg).not.toContain('>chart</text>');
	});

	it('renders ChartEx funnel data as value-scaled trapezoid stages', () => {
		const slide = makeSlide({
			elements: [
				{
					type: 'chart',
					id: 'funnel1',
					x: 0,
					y: 0,
					width: 300,
					height: 200,
					chartData: {
						chartType: 'funnel',
						categories: ['Lead', 'Qualified', 'Won'],
						series: [
							{
								name: 'Opportunities',
								values: [120, 75, 30],
								dataPoints: [{ idx: 1, spPr: { fillColor: '#123456' } }],
							},
						],
					},
				},
			],
		});
		const svg = SvgExporter.exportSlide(slide, 960, 540);

		assertValidSvgStructure(svg);
		expect(svg.match(/data-chart-mark="funnel"/gu)).toHaveLength(3);
		expect(svg).toContain('data-chart-point="1"');
		expect(svg).toContain('fill="#123456"');
		expect(svg).not.toContain('data-chart-mark="bar"');
		const stageWidths = [...svg.matchAll(/data-chart-mark="funnel"[^>]+points="([^"]+)"/gu)].map(
			(match) => {
				const [left, right] = match[1]
					.split(' ')
					.slice(0, 2)
					.map((point) => Number(point.split(',')[0]));
				return right - left;
			},
		);
		expect(stageWidths[0]).toBeGreaterThan(stageWidths[1]);
		expect(stageWidths[1]).toBeGreaterThan(stageWidths[2]);
	});

	it('renders SmartArt drawing geometry and text', () => {
		const slide = makeSlide({
			elements: [
				{
					type: 'smartArt',
					id: 'sa1',
					x: 10,
					y: 20,
					width: 300,
					height: 160,
					smartArtData: {
						nodes: [{ id: 'node1', text: 'Plan' }],
						drawingShapes: [
							{
								id: 'shape1',
								shapeType: 'roundRect',
								x: 20,
								y: 30,
								width: 120,
								height: 60,
								fillColor: '#336699',
								text: 'Plan',
							},
						],
					},
				},
			],
		});
		const svg = SvgExporter.exportSlide(slide, 960, 540);

		expect(svg).toContain('data-pptx-element="smartArt"');
		expect(svg).toContain('data-smartart-shape="shape1"');
		expect(svg).toContain('fill="#336699"');
		expect(svg).toContain('>Plan</text>');
		expect(svg).not.toContain('>smartArt</text>');
	});

	it.each([
		['media', { mediaType: 'video', posterFrameData: 'data:image/png;base64,poster' }],
		['ole', { previewImageData: 'data:image/png;base64,preview' }],
		['model3d', { posterImage: 'data:image/png;base64,model' }],
		['zoom', { zoomType: 'slide', targetSlideIndex: 2, imageData: 'data:image/png;base64,zoom' }],
	] as const)('renders a usable %s preview image', (type, extra) => {
		const element = {
			type,
			id: `${type}1`,
			x: 0,
			y: 0,
			width: 240,
			height: 120,
			...extra,
		} as PptxElement;
		const svg = SvgExporter.exportSlide(makeSlide({ elements: [element] }), 960, 540);

		expect(svg).toContain(`data-pptx-element="${type}"`);
		expect(svg).toContain('<image');
		expect(svg).not.toContain(`>${type}</text>`);
	});

	it('renders content-part ink strokes as SVG paths', () => {
		const element: PptxElement = {
			type: 'contentPart',
			id: 'content1',
			x: 0,
			y: 0,
			width: 240,
			height: 120,
			inkStrokes: [{ path: 'M 1 2 L 20 30', color: '#112233', width: 3, opacity: 0.75 }],
		};
		const svg = SvgExporter.exportSlide(makeSlide({ elements: [element] }), 960, 540);

		expect(svg).toContain('data-pptx-element="contentPart"');
		expect(svg).toContain('data-content-part="ink"');
		expect(svg).toContain('d="M 1 2 L 20 30"');
		expect(svg).not.toContain('>contentPart</text>');
	});

	it('retains a chart fallback when no renderable data exists', () => {
		const element: PptxElement = {
			type: 'chart',
			id: 'empty-chart',
			x: 0,
			y: 0,
			width: 300,
			height: 200,
		};
		const svg = SvgExporter.exportSlide(makeSlide({ elements: [element] }), 960, 540);

		expect(svg).toContain('stroke-dasharray="4 2"');
		expect(svg).toContain('>chart</text>');
	});

	// ── Hidden elements ──────────────────────────────────────────

	it('skips hidden elements', () => {
		const slide = makeSlide({
			elements: [
				{
					type: 'text',
					id: 'hidden1',
					x: 0,
					y: 0,
					width: 100,
					height: 50,
					text: 'SECRET',
					hidden: true,
				},
			],
		});
		const svg = SvgExporter.exportSlide(slide, 960, 540);

		assertValidSvgStructure(svg);
		expect(svg).not.toContain('SECRET');
	});

	// ── Rotation / transforms ────────────────────────────────────

	it('applies rotation transform', () => {
		const slide = makeSlide({
			elements: [
				{
					type: 'shape',
					id: 'rot1',
					x: 100,
					y: 100,
					width: 200,
					height: 100,
					rotation: 45,
					shapeType: 'rect',
					shapeStyle: { fillColor: '#FF0000' },
				},
			],
		});
		const svg = SvgExporter.exportSlide(slide, 960, 540);

		expect(svg).toContain('rotate(45,100,50)');
	});

	// ── exportAll ────────────────────────────────────────────────

	it('exports multiple slides', () => {
		const data = makeData([
			makeSlide({ id: 's1', slideNumber: 1 }),
			makeSlide({ id: 's2', slideNumber: 2 }),
			makeSlide({ id: 's3', slideNumber: 3 }),
		]);

		const svgs = SvgExporter.exportAll(data);
		expect(svgs).toHaveLength(3);
		for (const svg of svgs) {
			assertValidSvgStructure(svg);
		}
	});

	it('respects slideIndices option', () => {
		const data = makeData([
			makeSlide({ id: 's1', slideNumber: 1 }),
			makeSlide({ id: 's2', slideNumber: 2 }),
			makeSlide({ id: 's3', slideNumber: 3 }),
		]);

		const svgs = SvgExporter.exportAll(data, { slideIndices: [0, 2] });
		expect(svgs).toHaveLength(2);
	});

	it('skips hidden slides by default', () => {
		const data = makeData([
			makeSlide({ id: 's1', slideNumber: 1 }),
			makeSlide({ id: 's2', slideNumber: 2, hidden: true }),
		]);

		const svgs = SvgExporter.exportAll(data);
		expect(svgs).toHaveLength(1);
	});

	it('includes hidden slides when includeHidden is true', () => {
		const data = makeData([
			makeSlide({ id: 's1', slideNumber: 1 }),
			makeSlide({ id: 's2', slideNumber: 2, hidden: true }),
		]);

		const svgs = SvgExporter.exportAll(data, { includeHidden: true });
		expect(svgs).toHaveLength(2);
	});

	// ── XML escaping ─────────────────────────────────────────────

	it('escapes XML special characters in text', () => {
		const slide = makeSlide({
			elements: [
				{
					type: 'text',
					id: 'esc1',
					x: 0,
					y: 0,
					width: 200,
					height: 50,
					text: 'Hello <World> & "Friends" \'s',
				},
			],
		});
		const svg = SvgExporter.exportSlide(slide, 960, 540);

		assertValidSvgStructure(svg);
		expect(svg).toContain('&lt;World&gt;');
		expect(svg).toContain('&amp;');
		expect(svg).toContain('&quot;Friends&quot;');
	});

	// ── Opacity ──────────────────────────────────────────────────

	it('applies element opacity', () => {
		const slide = makeSlide({
			elements: [
				{
					type: 'shape',
					id: 'op1',
					x: 0,
					y: 0,
					width: 100,
					height: 100,
					opacity: 0.5,
					shapeType: 'rect',
					shapeStyle: { fillColor: '#000' },
				},
			],
		});
		const svg = SvgExporter.exportSlide(slide, 960, 540);

		expect(svg).toContain('opacity="0.5"');
	});

	// ── Ink element ──────────────────────────────────────────────

	it('renders ink strokes as SVG paths', () => {
		const slide = makeSlide({
			elements: [
				{
					type: 'ink',
					id: 'ink1',
					x: 0,
					y: 0,
					width: 400,
					height: 300,
					inkPaths: ['M 0 0 L 100 100', 'M 50 50 L 200 200'],
					inkColors: ['#FF0000', '#0000FF'],
					inkWidths: [2, 3],
				},
			],
		});
		const svg = SvgExporter.exportSlide(slide, 960, 540);

		assertValidSvgStructure(svg);
		expect(svg).toContain('d="M 0 0 L 100 100"');
		expect(svg).toContain('stroke="#FF0000"');
		expect(svg).toContain('stroke="#0000FF"');
	});

	// ── Valid XML output (comprehensive) ─────────────────────────

	it('produces valid XML output for a complex slide', () => {
		const slide = makeSlide({
			backgroundColor: '#F0F0F0',
			elements: [
				{
					type: 'text',
					id: 't1',
					x: 50,
					y: 30,
					width: 800,
					height: 60,
					text: 'Title',
					textStyle: { fontSize: 36, bold: true },
				},
				{
					type: 'shape',
					id: 's1',
					x: 100,
					y: 200,
					width: 300,
					height: 150,
					shapeType: 'roundRect',
					shapeStyle: {
						fillColor: '#4488CC',
						strokeColor: '#000',
						strokeWidth: 1.5,
					},
				},
				{
					type: 'image',
					id: 'i1',
					x: 500,
					y: 200,
					width: 200,
					height: 150,
					imageData: 'data:image/png;base64,abc123',
				},
				{
					type: 'connector',
					id: 'c1',
					x: 400,
					y: 275,
					width: 100,
					height: 0,
					shapeStyle: { strokeColor: '#666', strokeWidth: 1 },
				},
			],
		});

		const svg = SvgExporter.exportSlide(slide, 960, 540);
		assertValidSvgStructure(svg);

		// Ensure all expected element types appear
		expect(svg).toContain('<text');
		expect(svg).toContain('<rect');
		expect(svg).toContain('<image');
		expect(svg).toContain('<line');
		expect(svg).toContain('>Title</tspan>');
	});
});
