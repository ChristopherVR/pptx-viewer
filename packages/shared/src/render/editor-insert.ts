/**
 * editor-insert.ts: Pure factory functions for creating new slide elements.
 *
 * Framework-agnostic: no framework imports. Each factory returns a `PptxElement`
 * with `id: ''` so that the caller's editor state can assign a real id before
 * persisting the element.
 *
 * Default position/size places elements near the slide centre (slides are
 * typically 960 x 540 px in the viewer's coordinate space).
 */

import type { PptxElement, PptxSmartArtNode, PptxTableCell, PptxTableRow } from 'pptx-viewer-core';

import { substituteFieldText } from './text-field-substitution';

/** Default x position for newly inserted elements (px). */
const DEFAULT_X = 100;
/** Default y position for newly inserted elements (px). */
const DEFAULT_Y = 100;
/** Default width for newly inserted text boxes (px). */
const TEXT_WIDTH = 200;
/** Default height for newly inserted text boxes (px). */
const TEXT_HEIGHT = 60;
/** Default width for newly inserted shapes (px). */
const SHAPE_WIDTH = 200;
/** Default height for newly inserted shapes (px). */
const SHAPE_HEIGHT = 120;
/** Default table width (px). */
const TABLE_WIDTH = 600;
/** Default table height (px). */
const TABLE_HEIGHT = 250;
/** Default table y offset (px): slightly below the title area. */
const TABLE_DEFAULT_Y = 150;
/** Default SmartArt width (px). */
const SMART_ART_WIDTH = 600;
/** Default SmartArt height (px). */
const SMART_ART_HEIGHT = 300;
/** Default SmartArt y offset (px). */
const SMART_ART_DEFAULT_Y = 120;
/** Default equation/shape width (px). */
const EQUATION_WIDTH = 400;
/** Default equation/shape height (px). */
const EQUATION_HEIGHT = 80;
/** Default equation y offset (px). */
const EQUATION_DEFAULT_Y = 200;
/** Default field placeholder width (px). */
const FIELD_WIDTH = 200;
/** Default field placeholder height (px). */
const FIELD_HEIGHT = 40;
/** Default field placeholder y offset (px). */
const FIELD_DEFAULT_Y = 200;

function newFieldGuid(): string {
	const cryptoApi = globalThis.crypto;
	if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
		return `{${cryptoApi.randomUUID().toUpperCase()}}`;
	}
	return `{${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}}`;
}

/** Resolve the initial visible text for an inserted PowerPoint field. */
export function resolveInsertedFieldText(
	fieldType: string,
	slideNumber: number,
	value?: string,
): string {
	if (value) {
		return value;
	}
	return substituteFieldText(fieldType, fieldType, {
		slideNumber,
		headerText: 'Header',
		footerText: 'Footer',
	});
}

/** Create a text-bearing shape containing one OOXML field segment. */
export function newFieldElement(
	fieldType: string,
	displayText: string,
	x: number = DEFAULT_X,
	y: number = FIELD_DEFAULT_Y,
): PptxElement {
	return {
		type: 'shape',
		id: '',
		name: 'Field',
		x,
		y,
		width: FIELD_WIDTH,
		height: FIELD_HEIGHT,
		text: displayText,
		textStyle: { fontSize: 14 },
		textSegments: [
			{
				text: displayText,
				style: { fontSize: 14 },
				fieldType,
				fieldGuid: newFieldGuid(),
			},
		],
	} as PptxElement;
}

/**
 * Create a new text box element with sensible defaults.
 *
 * @param x - Left position in pixels (default: 100).
 * @param y - Top position in pixels (default: 100).
 */
export function newTextElement(x: number = DEFAULT_X, y: number = DEFAULT_Y): PptxElement {
	return {
		type: 'text',
		id: '',
		name: 'Text Box',
		x,
		y,
		width: TEXT_WIDTH,
		height: TEXT_HEIGHT,
		text: 'Text',
		textStyle: {
			color: '#000000',
			fontSize: 18,
		},
	} as PptxElement;
}

/**
 * Create a new shape element with sensible defaults.
 *
 * @param shapeType - Preset geometry: `'rect'`, `'ellipse'`, or `'line'`.
 * @param x - Left position in pixels (default: 100).
 * @param y - Top position in pixels (default: 100).
 */
export function newShapeElement(
	shapeType: 'rect' | 'ellipse' | 'line',
	x: number = DEFAULT_X,
	y: number = DEFAULT_Y,
): PptxElement {
	return {
		type: 'shape',
		id: '',
		name: shapeType.charAt(0).toUpperCase() + shapeType.slice(1),
		x,
		y,
		width: SHAPE_WIDTH,
		height: SHAPE_HEIGHT,
		shapeType,
		shapeStyle: {
			fillColor: '#4f86ff',
			strokeColor: '#1e3a8a',
			strokeWidth: 1,
		},
	} as PptxElement;
}

/**
 * Create a new table element with sensible defaults.
 *
 * Produces a `rows x cols` grid of empty cells with equal column widths and
 * a 1 px solid border on every cell edge. The first row is styled as a header
 * (bold, blue background) so the table is immediately recognisable.
 *
 * @param rows - Number of rows (default: 3).
 * @param cols - Number of columns (default: 3).
 * @param x    - Left position in pixels (default: 100).
 * @param y    - Top position in pixels (default: 150).
 */
export function newTableElement(
	rows: number = 3,
	cols: number = 3,
	x: number = DEFAULT_X,
	y: number = TABLE_DEFAULT_Y,
): PptxElement {
	const colWidth = 1 / cols;
	const columnWidths = Array.from<number>({ length: cols }).fill(colWidth);

	const tableRows: PptxTableRow[] = Array.from({ length: rows }, (_, rowIdx): PptxTableRow => {
		const isHeader = rowIdx === 0;
		const cells: PptxTableCell[] = Array.from(
			{ length: cols },
			(__, colIdx): PptxTableCell => ({
				text: isHeader ? `Header ${colIdx + 1}` : '',
				style: {
					borderTopWidth: 1,
					borderBottomWidth: 1,
					borderLeftWidth: 1,
					borderRightWidth: 1,
					borderTopColor: '#cccccc',
					borderBottomColor: '#cccccc',
					borderLeftColor: '#cccccc',
					borderRightColor: '#cccccc',
					...(isHeader
						? {
								bold: true,
								backgroundColor: '#2563eb',
								color: '#ffffff',
							}
						: {}),
				},
			}),
		);
		return { cells, height: isHeader ? 40 : 36 };
	});

	return {
		type: 'table',
		id: '',
		name: 'Table',
		x,
		y,
		width: TABLE_WIDTH,
		height: TABLE_HEIGHT,
		tableData: {
			rows: tableRows,
			columnWidths,
			firstRowHeader: true,
			bandedRows: true,
		},
	} as PptxElement;
}

/**
 * Create a new SmartArt element with sensible defaults.
 *
 * Inserts a `basicBlockList` layout with three placeholder nodes using the
 * `colorful1` palette and `flat` style. The `drawingShapes` field is left
 * undefined so the renderer falls back to its stacked-block view-model,
 * which is always renderable without pre-computed SVG geometry.
 *
 * @param x - Left position in pixels (default: 100).
 * @param y - Top position in pixels (default: 120).
 */
export function newSmartArtElement(
	x: number = DEFAULT_X,
	y: number = SMART_ART_DEFAULT_Y,
): PptxElement {
	const timestamp = Date.now();
	const nodes: PptxSmartArtNode[] = [
		{ id: `node-${timestamp}-0`, text: 'Item 1' },
		{ id: `node-${timestamp}-1`, text: 'Item 2' },
		{ id: `node-${timestamp}-2`, text: 'Item 3' },
	];

	return {
		type: 'smartArt',
		id: '',
		name: 'SmartArt',
		x,
		y,
		width: SMART_ART_WIDTH,
		height: SMART_ART_HEIGHT,
		smartArtData: {
			layout: 'basicBlockList',
			colorScheme: 'colorful1',
			style: 'flat',
			nodes,
		},
	} as PptxElement;
}

/**
 * Create a new equation element with a simple default OMML expression.
 *
 * Following the React approach the equation is stored as a `shape` element
 * whose single text segment carries an `equationXml` field: the same
 * structure an equation renderer consumes when rendering inline equations
 * within a text paragraph. The OMML payload encodes the expression
 * `E = mc2` as a minimal Office Math Markup Language object tree.
 *
 * @param x - Left position in pixels (default: 100).
 * @param y - Top position in pixels (default: 200).
 */
export function newEquationElement(
	x: number = DEFAULT_X,
	y: number = EQUATION_DEFAULT_Y,
): PptxElement {
	// OMML object tree representing E = mc^2. The keys mirror what fast-xml-parser
	// produces from real OOXML (m:oMath -> m:r runs + m:sSup superscript). The
	// converter walks keys in insertion order, so the leading run ("E = m") is
	// emitted before the superscript group (base "c", sup "2") -> "E = mc2".
	const omml: Record<string, unknown> = {
		'm:oMath': {
			'm:r': { 'm:t': 'E = m' },
			'm:sSup': {
				'm:e': { 'm:r': { 'm:t': 'c' } },
				'm:sup': { 'm:r': { 'm:t': '2' } },
			},
		},
	};

	return {
		type: 'shape',
		id: '',
		name: 'Equation',
		x,
		y,
		width: EQUATION_WIDTH,
		height: EQUATION_HEIGHT,
		text: 'E = mc²',
		textStyle: { fontSize: 18, fontFamily: 'Cambria Math' },
		textSegments: [
			{
				text: 'E = mc²',
				style: { fontSize: 18, fontFamily: 'Cambria Math' },
				equationXml: omml,
			},
		],
	} as PptxElement;
}
