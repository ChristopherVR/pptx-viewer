import { describe, it, expect, beforeEach } from 'vitest';

import {
	TextBuilder,
	ShapeBuilder,
	ImageBuilder,
	TableBuilder,
	ChartBuilder,
	ConnectorBuilder,
} from './ElementBuilders';
import { resetIdCounter } from './ElementFactory';

beforeEach(() => {
	resetIdCounter();
});

// ---------------------------------------------------------------------------
// TextBuilder
// ---------------------------------------------------------------------------

describe('textBuilder', () => {
	it('creates a text element with default position', () => {
		const el = TextBuilder.create('Hello').build();
		expect(el.type).toBe('text');
		expect(el.text).toBe('Hello');
		expect(el.x).toBe(100);
		expect(el.y).toBe(100);
		expect(el.width).toBe(600);
		expect(el.height).toBe(50);
	});

	it('generates a unique id with txt prefix', () => {
		const el = TextBuilder.create('A').build();
		expect(el.id).toMatch(/^txt_/);
	});

	it('sets fontSize', () => {
		const el = TextBuilder.create('Hi').fontSize(36).build();
		expect(el.textStyle?.fontSize).toBe(36);
	});

	it('sets fontFamily', () => {
		const el = TextBuilder.create('Hi').fontFamily('Arial').build();
		expect(el.textStyle?.fontFamily).toBe('Arial');
	});

	it('bold() defaults to true', () => {
		const el = TextBuilder.create('Hi').bold().build();
		expect(el.textStyle?.bold).toBeTruthy();
	});

	it('bold(false) sets false', () => {
		const el = TextBuilder.create('Hi').bold(false).build();
		expect(el.textStyle?.bold).toBeFalsy();
	});

	it('italic() defaults to true', () => {
		const el = TextBuilder.create('Hi').italic().build();
		expect(el.textStyle?.italic).toBeTruthy();
	});

	it('italic(false) sets false', () => {
		const el = TextBuilder.create('Hi').italic(false).build();
		expect(el.textStyle?.italic).toBeFalsy();
	});

	it('underline() defaults to true', () => {
		const el = TextBuilder.create('Hi').underline().build();
		expect(el.textStyle?.underline).toBeTruthy();
	});

	it('underline(false) sets false', () => {
		const el = TextBuilder.create('Hi').underline(false).build();
		expect(el.textStyle?.underline).toBeFalsy();
	});

	it('sets color', () => {
		const el = TextBuilder.create('Hi').color('#FF0000').build();
		expect(el.textStyle?.color).toBe('#FF0000');
	});

	it('sets alignment', () => {
		const el = TextBuilder.create('Hi').alignment('center').build();
		expect(el.textStyle?.align).toBe('center');
	});

	it('sets verticalAlignment', () => {
		const el = TextBuilder.create('Hi').verticalAlignment('middle').build();
		expect(el.textStyle?.vAlign).toBe('middle');
	});

	it('sets lineSpacing', () => {
		const el = TextBuilder.create('Hi').lineSpacing(1.5).build();
		expect(el.textStyle?.lineSpacing).toBe(1.5);
	});

	it('sets position', () => {
		const el = TextBuilder.create('Hi').position(50, 75).build();
		expect(el.x).toBe(50);
		expect(el.y).toBe(75);
	});

	it('sets size', () => {
		const el = TextBuilder.create('Hi').size(400, 80).build();
		expect(el.width).toBe(400);
		expect(el.height).toBe(80);
	});

	it('sets bounds (position + size)', () => {
		const el = TextBuilder.create('Hi').bounds(10, 20, 300, 40).build();
		expect(el.x).toBe(10);
		expect(el.y).toBe(20);
		expect(el.width).toBe(300);
		expect(el.height).toBe(40);
	});

	it('sets rotation', () => {
		const el = TextBuilder.create('Hi').rotation(45).build();
		expect(el.rotation).toBe(45);
	});

	it('sets opacity', () => {
		const el = TextBuilder.create('Hi').opacity(0.5).build();
		expect(el.opacity).toBe(0.5);
	});

	it('sets fill', () => {
		const el = TextBuilder.create('Hi').fill({ type: 'solid', color: '#CCCCCC' }).build();
		expect(el.shapeStyle?.fillMode).toBe('solid');
		expect(el.shapeStyle?.fillColor).toBe('#CCCCCC');
	});

	it('sets stroke', () => {
		const el = TextBuilder.create('Hi').stroke({ color: '#000000', width: 2 }).build();
		expect(el.shapeStyle?.strokeColor).toBe('#000000');
		expect(el.shapeStyle?.strokeWidth).toBe(2);
	});

	it('sets shadow', () => {
		const el = TextBuilder.create('Hi')
			.shadow({ color: '#333333', blur: 6, offsetX: 3, offsetY: 3, opacity: 0.5 })
			.build();
		expect(el.shapeStyle?.shadowColor).toBe('#333333');
		expect(el.shapeStyle?.shadowBlur).toBe(6);
		expect(el.shapeStyle?.shadowOffsetX).toBe(3);
		expect(el.shapeStyle?.shadowOffsetY).toBe(3);
		expect(el.shapeStyle?.shadowOpacity).toBe(0.5);
	});

	it('accepts rich text segments', () => {
		const el = TextBuilder.create([
			{ text: 'Bold', style: { bold: true } },
			{ text: ' Normal' },
		]).build();
		expect(el.type).toBe('text');
		expect(el.text).toBe('Bold Normal');
		expect(el.textSegments).toHaveLength(2);
		expect(el.textSegments![0].text).toBe('Bold');
		expect(el.textSegments![0].style?.bold).toBeTruthy();
		expect(el.textSegments![1].text).toBe(' Normal');
	});

	it('chains all methods fluently', () => {
		const el = TextBuilder.create('Full chain')
			.fontSize(24)
			.fontFamily('Calibri')
			.bold()
			.italic()
			.underline()
			.color('#112233')
			.alignment('right')
			.verticalAlignment('bottom')
			.lineSpacing(2.0)
			.position(10, 20)
			.size(500, 60)
			.rotation(15)
			.opacity(0.8)
			.fill({ type: 'solid', color: '#FFFFFF' })
			.stroke({ color: '#000000', width: 1 })
			.shadow({ blur: 4 })
			.build();

		expect(el.type).toBe('text');
		expect(el.text).toBe('Full chain');
		expect(el.textStyle?.fontSize).toBe(24);
		expect(el.textStyle?.fontFamily).toBe('Calibri');
		expect(el.textStyle?.bold).toBeTruthy();
		expect(el.textStyle?.italic).toBeTruthy();
		expect(el.textStyle?.underline).toBeTruthy();
		expect(el.textStyle?.color).toBe('#112233');
		expect(el.textStyle?.align).toBe('right');
		expect(el.textStyle?.vAlign).toBe('bottom');
		expect(el.textStyle?.lineSpacing).toBe(2.0);
		expect(el.x).toBe(10);
		expect(el.y).toBe(20);
		expect(el.width).toBe(500);
		expect(el.height).toBe(60);
		expect(el.rotation).toBe(15);
		expect(el.opacity).toBe(0.8);
		expect(el.shapeStyle?.fillMode).toBe('solid');
		expect(el.shapeStyle?.strokeColor).toBe('#000000');
		expect(el.shapeStyle?.shadowBlur).toBe(4);
	});
});

// ---------------------------------------------------------------------------
// ShapeBuilder
// ---------------------------------------------------------------------------

describe('shapeBuilder', () => {
	it('creates a shape element with the given type', () => {
		const el = ShapeBuilder.create('rect').build();
		expect(el.type).toBe('shape');
		expect(el.shapeType).toBe('rect');
	});

	it('uses default position and size for shapes', () => {
		const el = ShapeBuilder.create('ellipse').build();
		expect(el.x).toBe(200);
		expect(el.y).toBe(200);
		expect(el.width).toBe(300);
		expect(el.height).toBe(200);
	});

	it('generates a unique id with shp prefix', () => {
		const el = ShapeBuilder.create('rect').build();
		expect(el.id).toMatch(/^shp_/);
	});

	it('applies a default solid fill', () => {
		const el = ShapeBuilder.create('rect').build();
		expect(el.shapeStyle?.fillMode).toBe('solid');
		expect(el.shapeStyle?.fillColor).toBe('#4472C4');
	});

	it('sets fill', () => {
		const el = ShapeBuilder.create('rect').fill({ type: 'solid', color: '#FF0000' }).build();
		expect(el.shapeStyle?.fillMode).toBe('solid');
		expect(el.shapeStyle?.fillColor).toBe('#FF0000');
	});

	it('sets gradient fill', () => {
		const el = ShapeBuilder.create('rect')
			.fill({
				type: 'gradient',
				angle: 90,
				stops: [
					{ color: '#FF0000', position: 0 },
					{ color: '#0000FF', position: 100 },
				],
			})
			.build();
		expect(el.shapeStyle?.fillMode).toBe('gradient');
		expect(el.shapeStyle?.fillGradientAngle).toBe(90);
	});

	it('sets stroke', () => {
		const el = ShapeBuilder.create('rect').stroke({ color: '#000000', width: 3 }).build();
		expect(el.shapeStyle?.strokeColor).toBe('#000000');
		expect(el.shapeStyle?.strokeWidth).toBe(3);
	});

	it('sets shadow', () => {
		const el = ShapeBuilder.create('rect')
			.shadow({ color: '#000000', blur: 8, offsetX: 4, offsetY: 4 })
			.build();
		expect(el.shapeStyle?.shadowColor).toBe('#000000');
		expect(el.shapeStyle?.shadowBlur).toBe(8);
	});

	it('sets text content on the shape', () => {
		const el = ShapeBuilder.create('roundRect').text('Click me').build();
		expect(el.text).toBe('Click me');
		expect(el.textSegments).toBeDefined();
		expect(el.textSegments!.length).toBeGreaterThan(0);
		expect(el.textSegments![0].text).toBe('Click me');
	});

	it("sets textStyle for the shape's text", () => {
		const el = ShapeBuilder.create('rect')
			.text('Styled')
			.textStyle({ fontSize: 18, bold: true, color: '#FFFFFF' })
			.build();
		expect(el.textStyle?.fontSize).toBe(18);
		expect(el.textStyle?.bold).toBeTruthy();
		expect(el.textStyle?.color).toBe('#FFFFFF');
	});

	it('sets adjustments', () => {
		const el = ShapeBuilder.create('roundRect').adjustments({ adj: 16667 }).build();
		expect(el.shapeAdjustments).toStrictEqual({ adj: 16667 });
	});

	it('sets position', () => {
		const el = ShapeBuilder.create('rect').position(50, 75).build();
		expect(el.x).toBe(50);
		expect(el.y).toBe(75);
	});

	it('sets size', () => {
		const el = ShapeBuilder.create('rect').size(400, 300).build();
		expect(el.width).toBe(400);
		expect(el.height).toBe(300);
	});

	it('sets bounds', () => {
		const el = ShapeBuilder.create('rect').bounds(10, 20, 400, 300).build();
		expect(el.x).toBe(10);
		expect(el.y).toBe(20);
		expect(el.width).toBe(400);
		expect(el.height).toBe(300);
	});

	it('sets rotation', () => {
		const el = ShapeBuilder.create('rect').rotation(90).build();
		expect(el.rotation).toBe(90);
	});

	it('sets opacity', () => {
		const el = ShapeBuilder.create('rect').opacity(0.7).build();
		expect(el.opacity).toBe(0.7);
	});

	it('does not set text fields when text is not provided', () => {
		const el = ShapeBuilder.create('rect').build();
		expect(el.text).toBeUndefined();
		expect(el.textSegments).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// ImageBuilder
// ---------------------------------------------------------------------------

describe('imageBuilder', () => {
	const DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

	it('creates an image element from a data URL', () => {
		const el = ImageBuilder.create(DATA_URL).build();
		expect(el.type).toBe('image');
		expect(el.imageData).toBe(DATA_URL);
		expect(el.imagePath).toBeUndefined();
	});

	it('creates an image element from an archive path', () => {
		const el = ImageBuilder.create('ppt/media/image1.png').build();
		expect(el.type).toBe('image');
		expect(el.imagePath).toBe('ppt/media/image1.png');
		expect(el.imageData).toBeUndefined();
	});

	it('uses default position and size for images', () => {
		const el = ImageBuilder.create(DATA_URL).build();
		expect(el.x).toBe(100);
		expect(el.y).toBe(100);
		expect(el.width).toBe(400);
		expect(el.height).toBe(300);
	});

	it('generates a unique id with img prefix', () => {
		const el = ImageBuilder.create(DATA_URL).build();
		expect(el.id).toMatch(/^img_/);
	});

	it('sets altText', () => {
		const el = ImageBuilder.create(DATA_URL).altText('Company logo').build();
		expect(el.altText).toBe('Company logo');
	});

	it('sets crop', () => {
		const el = ImageBuilder.create(DATA_URL).crop(0.1, 0.2, 0.15, 0.25).build();
		expect(el.cropLeft).toBe(0.1);
		expect(el.cropTop).toBe(0.2);
		expect(el.cropRight).toBe(0.15);
		expect(el.cropBottom).toBe(0.25);
	});

	it('sets position', () => {
		const el = ImageBuilder.create(DATA_URL).position(50, 60).build();
		expect(el.x).toBe(50);
		expect(el.y).toBe(60);
	});

	it('sets size', () => {
		const el = ImageBuilder.create(DATA_URL).size(200, 150).build();
		expect(el.width).toBe(200);
		expect(el.height).toBe(150);
	});

	it('sets bounds', () => {
		const el = ImageBuilder.create(DATA_URL).bounds(10, 20, 300, 200).build();
		expect(el.x).toBe(10);
		expect(el.y).toBe(20);
		expect(el.width).toBe(300);
		expect(el.height).toBe(200);
	});

	it('sets rotation', () => {
		const el = ImageBuilder.create(DATA_URL).rotation(180).build();
		expect(el.rotation).toBe(180);
	});

	it('sets opacity', () => {
		const el = ImageBuilder.create(DATA_URL).opacity(0.9).build();
		expect(el.opacity).toBe(0.9);
	});
});

// ---------------------------------------------------------------------------
// TableBuilder
// ---------------------------------------------------------------------------

describe('tableBuilder', () => {
	it('creates a table with rows from addRow', () => {
		const el = TableBuilder.create().addRow(['Alice', '95']).addRow(['Bob', '87']).build();
		expect(el.type).toBe('table');
		expect(el.tableData.rows).toHaveLength(2);
		expect(el.tableData.rows[0].cells[0].text).toBe('Alice');
		expect(el.tableData.rows[0].cells[1].text).toBe('95');
		expect(el.tableData.rows[1].cells[0].text).toBe('Bob');
	});

	it('generates a unique id with tbl prefix', () => {
		const el = TableBuilder.create().addRow(['A']).build();
		expect(el.id).toMatch(/^tbl_/);
	});

	it('uses default position for tables', () => {
		const el = TableBuilder.create().addRow(['A']).build();
		expect(el.x).toBe(50);
		expect(el.y).toBe(150);
		expect(el.width).toBe(860);
	});

	it('headerRow sets firstRow flag and adds the row', () => {
		const el = TableBuilder.create().headerRow(['Name', 'Score']).addRow(['Alice', '95']).build();
		expect(el.tableData.firstRowHeader).toBeTruthy();
		expect(el.tableData.rows).toHaveLength(2);
		expect(el.tableData.rows[0].cells[0].text).toBe('Name');
		expect(el.tableData.rows[0].cells[1].text).toBe('Score');
	});

	it('addRow auto-converts string cells to TableCellInput objects', () => {
		const el = TableBuilder.create().addRow(['A', 'B']).build();
		expect(el.tableData.rows[0].cells[0].text).toBe('A');
		expect(el.tableData.rows[0].cells[1].text).toBe('B');
	});

	it('addRow accepts TableCellInput objects with styling', () => {
		const el = TableBuilder.create()
			.addRow([{ text: 'Styled', style: { bold: true, fontSize: 14 } }, { text: 'Normal' }])
			.build();
		expect(el.tableData.rows[0].cells[0].text).toBe('Styled');
		expect(el.tableData.rows[0].cells[0].style?.bold).toBeTruthy();
		expect(el.tableData.rows[0].cells[0].style?.fontSize).toBe(14);
		expect(el.tableData.rows[0].cells[1].text).toBe('Normal');
	});

	it('addRow accepts TableCellInput objects with gridSpan and rowSpan', () => {
		const el = TableBuilder.create()
			.addRow([{ text: 'Merged', gridSpan: 2, rowSpan: 3 }])
			.build();
		expect(el.tableData.rows[0].cells[0].gridSpan).toBe(2);
		expect(el.tableData.rows[0].cells[0].rowSpan).toBe(3);
	});

	it('sets columnWidths (normalized to proportions)', () => {
		const el = TableBuilder.create().addRow(['A', 'B', 'C']).columnWidths([1, 2, 1]).build();
		expect(el.tableData.columnWidths).toStrictEqual([0.25, 0.5, 0.25]);
	});

	it('uses equal column widths when columnWidths not set', () => {
		const el = TableBuilder.create().addRow(['A', 'B']).build();
		expect(el.tableData.columnWidths).toHaveLength(2);
		expect(el.tableData.columnWidths[0]).toBeCloseTo(0.5);
		expect(el.tableData.columnWidths[1]).toBeCloseTo(0.5);
	});

	it('sets bandRows', () => {
		const el = TableBuilder.create().addRow(['A']).bandRows().build();
		expect(el.tableData.bandedRows).toBeTruthy();
	});

	it('bandRows(false) disables banding', () => {
		const el = TableBuilder.create().addRow(['A']).bandRows(false).build();
		expect(el.tableData.bandedRows).toBeFalsy();
	});

	it('sets bandColumns', () => {
		const el = TableBuilder.create().addRow(['A']).bandColumns().build();
		expect(el.tableData.bandedColumns).toBeTruthy();
	});

	it('bandColumns(false) disables banding', () => {
		const el = TableBuilder.create().addRow(['A']).bandColumns(false).build();
		expect(el.tableData.bandedColumns).toBeFalsy();
	});

	it('sets style', () => {
		const el = TableBuilder.create()
			.addRow(['A'])
			.style('{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}')
			.build();
		expect(el.tableData.tableStyleId).toBe('{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}');
	});

	it('sets position', () => {
		const el = TableBuilder.create().addRow(['A']).position(100, 200).build();
		expect(el.x).toBe(100);
		expect(el.y).toBe(200);
	});

	it('sets size', () => {
		const el = TableBuilder.create().addRow(['A']).size(700, 300).build();
		expect(el.width).toBe(700);
		expect(el.height).toBe(300);
	});

	it('sets bounds', () => {
		const el = TableBuilder.create().addRow(['A']).bounds(10, 20, 800, 250).build();
		expect(el.x).toBe(10);
		expect(el.y).toBe(20);
		expect(el.width).toBe(800);
		expect(el.height).toBe(250);
	});
});

// ---------------------------------------------------------------------------
// ChartBuilder
// ---------------------------------------------------------------------------

describe('chartBuilder', () => {
	it('creates a bar chart with categories and series', () => {
		const el = ChartBuilder.create('bar')
			.categories(['Q1', 'Q2', 'Q3'])
			.addSeries('Revenue', [100, 150, 130])
			.build();
		expect(el.type).toBe('chart');
		expect(el.chartData.chartType).toBe('bar');
		expect(el.chartData.categories).toStrictEqual(['Q1', 'Q2', 'Q3']);
		expect(el.chartData.series).toHaveLength(1);
		expect(el.chartData.series[0].name).toBe('Revenue');
		expect(el.chartData.series[0].values).toStrictEqual([100, 150, 130]);
	});

	it('uses default position and size for charts', () => {
		const el = ChartBuilder.create('line').categories(['A']).addSeries('S', [1]).build();
		expect(el.x).toBe(100);
		expect(el.y).toBe(150);
		expect(el.width).toBe(600);
		expect(el.height).toBe(400);
	});

	it('generates a unique id with cht prefix', () => {
		const el = ChartBuilder.create('pie').categories(['A']).addSeries('S', [1]).build();
		expect(el.id).toMatch(/^cht_/);
	});

	it('sets series color', () => {
		const el = ChartBuilder.create('bar').categories(['A']).addSeries('S', [1], '#4472C4').build();
		expect(el.chartData.series[0].color).toBe('#4472C4');
	});

	it('supports multiple series', () => {
		const el = ChartBuilder.create('bar')
			.categories(['Q1', 'Q2'])
			.addSeries('Revenue', [100, 150], '#4472C4')
			.addSeries('Cost', [80, 90], '#ED7D31')
			.build();
		expect(el.chartData.series).toHaveLength(2);
		expect(el.chartData.series[0].name).toBe('Revenue');
		expect(el.chartData.series[1].name).toBe('Cost');
		expect(el.chartData.series[1].color).toBe('#ED7D31');
	});

	it('sets title', () => {
		const el = ChartBuilder.create('bar')
			.categories(['A'])
			.addSeries('S', [1])
			.title('Quarterly Revenue')
			.build();
		expect(el.chartData.title).toBe('Quarterly Revenue');
	});

	it('sets legend visibility and position', () => {
		const el = ChartBuilder.create('bar')
			.categories(['A'])
			.addSeries('S', [1])
			.legend(true, 'b')
			.build();
		expect(el.chartData.style?.hasLegend).toBeTruthy();
		expect(el.chartData.style?.legendPosition).toBe('b');
	});

	it('legend(false) hides the legend', () => {
		const el = ChartBuilder.create('bar')
			.categories(['A'])
			.addSeries('S', [1])
			.legend(false)
			.build();
		expect(el.chartData.style?.hasLegend).toBeFalsy();
	});

	it('legend without position only sets visibility', () => {
		const el = ChartBuilder.create('bar')
			.categories(['A'])
			.addSeries('S', [1])
			.legend(true)
			.build();
		expect(el.chartData.style?.hasLegend).toBeTruthy();
		expect(el.chartData.style?.legendPosition).toBeUndefined();
	});

	it('sets grouping', () => {
		const el = ChartBuilder.create('bar')
			.categories(['A'])
			.addSeries('S', [1])
			.grouping('stacked')
			.build();
		expect(el.chartData.grouping).toBe('stacked');
	});

	it('sets position', () => {
		const el = ChartBuilder.create('bar')
			.categories(['A'])
			.addSeries('S', [1])
			.position(50, 60)
			.build();
		expect(el.x).toBe(50);
		expect(el.y).toBe(60);
	});

	it('sets size', () => {
		const el = ChartBuilder.create('bar')
			.categories(['A'])
			.addSeries('S', [1])
			.size(800, 500)
			.build();
		expect(el.width).toBe(800);
		expect(el.height).toBe(500);
	});

	it('sets bounds', () => {
		const el = ChartBuilder.create('bar')
			.categories(['A'])
			.addSeries('S', [1])
			.bounds(10, 20, 700, 450)
			.build();
		expect(el.x).toBe(10);
		expect(el.y).toBe(20);
		expect(el.width).toBe(700);
		expect(el.height).toBe(450);
	});

	it('supports different chart types', () => {
		const types = ['line', 'pie', 'doughnut', 'area', 'scatter'] as const;
		for (const chartType of types) {
			const el = ChartBuilder.create(chartType).categories(['A']).addSeries('S', [1]).build();
			expect(el.chartData.chartType).toBe(chartType);
		}
	});
});

// ---------------------------------------------------------------------------
// ConnectorBuilder
// ---------------------------------------------------------------------------

describe('connectorBuilder', () => {
	it('creates a connector element with defaults', () => {
		const el = ConnectorBuilder.create().build();
		expect(el.type).toBe('connector');
		expect(el.shapeType).toBe('straightConnector1');
	});

	it('uses default position and size for connectors', () => {
		const el = ConnectorBuilder.create().build();
		expect(el.x).toBe(100);
		expect(el.y).toBe(100);
		expect(el.width).toBe(200);
		expect(el.height).toBe(0);
	});

	it('generates a unique id with cxn prefix', () => {
		const el = ConnectorBuilder.create().build();
		expect(el.id).toMatch(/^cxn_/);
	});

	it("type('straight') maps to straightConnector1", () => {
		const el = ConnectorBuilder.create().type('straight').build();
		expect(el.shapeType).toBe('straightConnector1');
	});

	it("type('bent') maps to bentConnector3", () => {
		const el = ConnectorBuilder.create().type('bent').build();
		expect(el.shapeType).toBe('bentConnector3');
	});

	it("type('curved') maps to curvedConnector3", () => {
		const el = ConnectorBuilder.create().type('curved').build();
		expect(el.shapeType).toBe('curvedConnector3');
	});

	it('sets stroke', () => {
		const el = ConnectorBuilder.create().stroke({ color: '#FF0000', width: 2 }).build();
		expect(el.shapeStyle?.strokeColor).toBe('#FF0000');
		expect(el.shapeStyle?.strokeWidth).toBe(2);
	});

	it('sets startArrow', () => {
		const el = ConnectorBuilder.create().startArrow('triangle').build();
		expect(el.shapeStyle?.connectorStartArrow).toBe('triangle');
	});

	it('sets endArrow', () => {
		const el = ConnectorBuilder.create().endArrow('stealth').build();
		expect(el.shapeStyle?.connectorEndArrow).toBe('stealth');
	});

	it('defaults arrows to none when not set', () => {
		const el = ConnectorBuilder.create().build();
		expect(el.shapeStyle?.connectorStartArrow).toBe('none');
		expect(el.shapeStyle?.connectorEndArrow).toBe('none');
	});

	it('sets from connection endpoint', () => {
		const el = ConnectorBuilder.create().from('shp_1', 2).build();
		expect(el.shapeStyle?.connectorStartConnection).toStrictEqual({
			shapeId: 'shp_1',
			connectionSiteIndex: 2,
		});
	});

	it('sets to connection endpoint', () => {
		const el = ConnectorBuilder.create().to('shp_2', 0).build();
		expect(el.shapeStyle?.connectorEndConnection).toStrictEqual({
			shapeId: 'shp_2',
			connectionSiteIndex: 0,
		});
	});

	it('sets both from and to endpoints', () => {
		const el = ConnectorBuilder.create().from('shp_1', 2).to('shp_2', 0).build();
		expect(el.shapeStyle?.connectorStartConnection?.shapeId).toBe('shp_1');
		expect(el.shapeStyle?.connectorEndConnection?.shapeId).toBe('shp_2');
	});

	it('sets position', () => {
		const el = ConnectorBuilder.create().position(50, 75).build();
		expect(el.x).toBe(50);
		expect(el.y).toBe(75);
	});

	it('sets size', () => {
		const el = ConnectorBuilder.create().size(300, 100).build();
		expect(el.width).toBe(300);
		expect(el.height).toBe(100);
	});

	it('sets bounds', () => {
		const el = ConnectorBuilder.create().bounds(10, 20, 400, 50).build();
		expect(el.x).toBe(10);
		expect(el.y).toBe(20);
		expect(el.width).toBe(400);
		expect(el.height).toBe(50);
	});

	it('sets rotation', () => {
		const el = ConnectorBuilder.create().rotation(45).build();
		expect(el.rotation).toBe(45);
	});

	it('chains all methods fluently', () => {
		const el = ConnectorBuilder.create()
			.type('curved')
			.stroke({ color: '#FF0000', width: 2 })
			.startArrow('oval')
			.endArrow('triangle')
			.from('shp_1', 2)
			.to('shp_2', 0)
			.position(100, 100)
			.size(300, 0)
			.rotation(10)
			.build();

		expect(el.type).toBe('connector');
		expect(el.shapeType).toBe('curvedConnector3');
		expect(el.shapeStyle?.strokeColor).toBe('#FF0000');
		expect(el.shapeStyle?.strokeWidth).toBe(2);
		expect(el.shapeStyle?.connectorStartArrow).toBe('oval');
		expect(el.shapeStyle?.connectorEndArrow).toBe('triangle');
		expect(el.shapeStyle?.connectorStartConnection?.shapeId).toBe('shp_1');
		expect(el.shapeStyle?.connectorEndConnection?.shapeId).toBe('shp_2');
		expect(el.x).toBe(100);
		expect(el.y).toBe(100);
		expect(el.width).toBe(300);
		expect(el.height).toBe(0);
		expect(el.rotation).toBe(10);
	});
});

// ---------------------------------------------------------------------------
// Cross-builder: each build() produces independent elements
// ---------------------------------------------------------------------------

describe('builder independence', () => {
	it('each build() call produces a new element with a unique id', () => {
		const a = TextBuilder.create('A').build();
		const b = TextBuilder.create('B').build();
		expect(a.id).not.toBe(b.id);
	});

	it('different builder types produce different element types', () => {
		const text = TextBuilder.create('Hi').build();
		const shape = ShapeBuilder.create('rect').build();
		const image = ImageBuilder.create('data:image/png;base64,AA==').build();
		const table = TableBuilder.create().addRow(['A']).build();
		const chart = ChartBuilder.create('bar').categories(['A']).addSeries('S', [1]).build();
		const connector = ConnectorBuilder.create().build();

		expect(text.type).toBe('text');
		expect(shape.type).toBe('shape');
		expect(image.type).toBe('image');
		expect(table.type).toBe('table');
		expect(chart.type).toBe('chart');
		expect(connector.type).toBe('connector');
	});
});
