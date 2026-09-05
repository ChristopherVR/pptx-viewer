import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import type { Store, ViewerState } from '../state';
import { createInitialViewerState, createStore } from '../state';
import { createApplyToSelected } from './editor-apply-to-selected';
import { createInspectorActions } from './editor-inspector-actions';
import { createEditorOps } from './editor-operations';

function textElement(): PptxElement {
	return {
		type: 'text',
		id: 't1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text: 'hi',
		textStyle: { fontSize: 18 },
	} as PptxElement;
}

function imageElement(): PptxElement {
	return {
		type: 'image',
		id: 'img1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		imagePath: 'ppt/media/image1.png',
	} as PptxElement;
}

function tableElement(): PptxElement {
	return {
		type: 'table',
		id: 'tbl1',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		tableData: {
			rows: [{ cells: [{ text: 'A' }, { text: 'B' }] }],
			columnWidths: [0.5, 0.5],
		},
	} as PptxElement;
}

function slideWith(element: PptxElement): PptxSlide {
	return { id: 's1', rId: 'rId-s1', slideNumber: 1, elements: [element] };
}

function buildActions(element: PptxElement) {
	const store = createStore({
		...createInitialViewerState(),
		slides: [slideWith(element)],
		currentSlide: 0,
		editable: true,
		selectedElementId: element.id,
	});
	const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
	const applyToSelected = createApplyToSelected(store, ops);
	const actions = createInspectorActions(applyToSelected);
	return { store, ops, actions };
}

function selectedEl(store: Store<ViewerState>): PptxElement {
	return store.get().slides[0].elements[0];
}

describe('createInspectorActions text', () => {
	it('sets vertical align, wrap, and autofit mode, each undoable', () => {
		const { store, ops, actions } = buildActions(textElement());

		actions.setTextVerticalAlign('middle');
		expect((selectedEl(store) as { textStyle?: { vAlign?: string } }).textStyle?.vAlign).toBe(
			'middle',
		);

		actions.setTextWrap('none');
		expect((selectedEl(store) as { textStyle?: { textWrap?: string } }).textStyle?.textWrap).toBe(
			'none',
		);

		actions.setAutoFitMode('shrink');
		expect(
			(selectedEl(store) as { textStyle?: { autoFitMode?: string } }).textStyle?.autoFitMode,
		).toBe('shrink');

		expect(ops.canUndo()).toBeTruthy();
		ops.undo();
		ops.undo();
		ops.undo();
		expect(
			(selectedEl(store) as { textStyle?: { vAlign?: string } }).textStyle?.vAlign,
		).toBeUndefined();
	});

	it('sets advanced paragraph and text direction properties', () => {
		const { store, actions } = buildActions(textElement());

		actions.setTextAdvanced({
			characterSpacing: 1.5,
			lineSpacing: 1.25,
			paragraphSpacingBefore: 8,
			paragraphIndent: 12,
			textDirection: 'vertical270',
			rtl: true,
		});

		expect((selectedEl(store) as { textStyle?: Record<string, unknown> }).textStyle).toMatchObject({
			characterSpacing: 1.5,
			lineSpacing: 1.25,
			paragraphSpacingBefore: 8,
			paragraphIndent: 12,
			textDirection: 'vertical270',
			rtl: true,
		});
	});

	it('applies rich formatting only to the selected text range', () => {
		const element = {
			...textElement(),
			text: 'hello',
			textSegments: [{ text: 'hello', style: { color: '#000000' } }],
		} as PptxElement;
		const { store, actions } = buildActions(element);

		actions.setTextStyle(
			{ bold: true, textGlowColor: '#ffff00', textWarpPreset: 'textWave1' },
			{ startSegIdx: 0, startOffset: 1, endSegIdx: 0, endOffset: 4 },
		);

		const segments = (
			selectedEl(store) as { textSegments?: Array<{ text: string; style?: unknown }> }
		).textSegments;
		expect(segments?.map(({ text }) => text)).toStrictEqual(['h', 'ell', 'o']);
		expect(segments?.[1].style).toMatchObject({ bold: true, textGlowColor: '#ffff00' });
		expect(segments?.[0].style).not.toMatchObject({ bold: true });
	});

	it('reconciles against a live open inline editor before slicing a selection range', () => {
		// The inline editor is uncontrolled: text typed since the edit session
		// began is not yet on `el.textSegments`. Regression: previously the range
		// slice ran against that stale snapshot, silently discarding anything
		// typed since once the edit session committed.
		const element = {
			...textElement(),
			text: 'hello',
			textSegments: [{ text: 'hello', style: { color: '#000000' } }],
		} as PptxElement;
		const { store, actions } = buildActions(element);

		const surface = document.createElement('div');
		surface.dataset.inlineEditor = '';
		surface.textContent = 'hello world'; // live text: 6 more chars than the model
		document.body.appendChild(surface);
		try {
			// Selection offsets are DOM-accurate (as `getInlineEditorSelection`
			// would produce against the live surface): select "world".
			actions.setTextStyle(
				{ bold: true },
				{ startSegIdx: 0, startOffset: 6, endSegIdx: 0, endOffset: 11 },
			);
		} finally {
			surface.remove();
		}

		const el = selectedEl(store) as {
			text?: string;
			textSegments?: Array<{ text: string; style?: { bold?: boolean } }>;
		};
		const combined = el.textSegments?.map(({ text }) => text).join('') ?? '';
		expect(combined).toBe('hello world');
		expect(el.text).toBe('hello world');
		const boldSegment = el.textSegments?.find((s) => s.style?.bold === true);
		expect(boldSegment?.text).toBe('world');
	});
});

describe('createInspectorActions fill/gradient', () => {
	it('sets fill and stroke opacity on a shape', () => {
		const shape: PptxElement = {
			type: 'shape',
			id: 's1',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			shapeType: 'rect',
			shapeStyle: { fillColor: '#fff' },
		} as PptxElement;
		const { store, actions } = buildActions(shape);

		actions.setFillOpacity(0.5);
		actions.setStrokeOpacity(0.25);

		const el = selectedEl(store) as {
			shapeStyle?: { fillOpacity?: number; strokeOpacity?: number };
		};
		expect(el.shapeStyle?.fillOpacity).toBe(0.5);
		expect(el.shapeStyle?.strokeOpacity).toBe(0.25);
	});

	it('enables a gradient fill and can add/update/remove stops', () => {
		const shape: PptxElement = {
			type: 'shape',
			id: 's1',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			shapeType: 'rect',
			shapeStyle: { fillColor: '#fff' },
		} as PptxElement;
		const { store, actions } = buildActions(shape);

		actions.setGradientFill({
			type: 'linear',
			angle: 45,
			stops: [
				{ color: '#111111', position: 0 },
				{ color: '#eeeeee', position: 100 },
			],
		});
		type GradientEl = {
			shapeStyle?: {
				fillMode?: string;
				fillGradientAngle?: number;
				fillGradientStops?: Array<{ color: string; position: number }>;
			};
		};
		const readEl = (): GradientEl => selectedEl(store) as GradientEl;

		expect(readEl().shapeStyle?.fillMode).toBe('gradient');
		expect(readEl().shapeStyle?.fillGradientAngle).toBe(45);
		expect(readEl().shapeStyle?.fillGradientStops).toHaveLength(2);

		actions.addGradientStop('#00ff00', 50);
		expect(readEl().shapeStyle?.fillGradientStops).toHaveLength(3);

		actions.updateGradientStop(1, { color: '#123456' });
		expect(readEl().shapeStyle?.fillGradientStops?.[1]?.color).toBe('#123456');

		actions.removeGradientStop(1);
		expect(readEl().shapeStyle?.fillGradientStops).toHaveLength(2);
	});

	it('refuses to remove a stop when only two remain', () => {
		const shape: PptxElement = {
			type: 'shape',
			id: 's1',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			shapeType: 'rect',
			shapeStyle: {
				fillMode: 'gradient',
				fillGradientStops: [
					{ color: '#111111', position: 0 },
					{ color: '#eeeeee', position: 100 },
				],
			},
		} as PptxElement;
		const { store, ops, actions } = buildActions(shape);
		const before = (selectedEl(store) as { shapeStyle?: { fillGradientStops?: unknown[] } })
			.shapeStyle?.fillGradientStops;

		actions.removeGradientStop(0);

		expect(
			(selectedEl(store) as { shapeStyle?: { fillGradientStops?: unknown[] } }).shapeStyle
				?.fillGradientStops,
		).toStrictEqual(before);
		expect(ops.canUndo()).toBeFalsy();
	});
});

describe('createInspectorActions image', () => {
	it('sets brightness/contrast/saturation and crop insets', () => {
		const { store, actions } = buildActions(imageElement());

		actions.setImageBrightness(20);
		actions.setImageContrast(-10);
		actions.setImageSaturation(5);
		actions.setImageCrop('left', 0.1);
		actions.setImageCrop('right', 2);

		const el = selectedEl(store) as {
			imageEffects?: { brightness?: number; contrast?: number; saturation?: number };
			cropLeft?: number;
			cropRight?: number;
		};
		expect(el.imageEffects).toStrictEqual({ brightness: 20, contrast: -10, saturation: 5 });
		expect(el.cropLeft).toBe(0.1);
		expect(el.cropRight).toBe(0.9); // clamped
	});

	it('authors artistic, transparency, bi-level, and duotone effects', () => {
		const { store, actions } = buildActions(imageElement());

		actions.setImageEffects({
			artisticEffect: 'pencilSketch',
			alphaModFix: 75,
			biLevel: 40,
			duotone: { color1: '#112233', color2: '#ddeeff' },
		});

		expect((selectedEl(store) as { imageEffects?: unknown }).imageEffects).toMatchObject({
			artisticEffect: 'pencilSketch',
			alphaModFix: 75,
			biLevel: 40,
			duotone: { color1: '#112233', color2: '#ddeeff' },
		});
	});
});

describe('createInspectorActions chart and action settings', () => {
	it('updates chart data and click actions with history', () => {
		const chart = {
			type: 'chart',
			id: 'chart1',
			x: 0,
			y: 0,
			width: 300,
			height: 200,
			chartData: { chartType: 'bar', categories: ['A'], series: [{ name: 'Sales', values: [1] }] },
		} as PptxElement;
		const { store, ops, actions } = buildActions(chart);

		actions.setChartData({
			chartType: 'line',
			categories: ['A', 'B'],
			series: [{ name: 'Sales', values: [1, 2] }],
			style: { hasLegend: true, hasDataLabels: true },
		});
		actions.setElementAction('click', { trigger: 'click', type: 'nextSlide' });

		const updated = selectedEl(store);
		expect(updated.type === 'chart' ? updated.chartData : undefined).toMatchObject({
			chartType: 'line',
			categories: ['A', 'B'],
			style: { hasLegend: true, hasDataLabels: true },
		});
		expect(updated.actionClick?.action).toContain('hlinkshowjump?jump=nextslide');
		expect(ops.canUndo()).toBeTruthy();
	});
});

describe('createInspectorActions table', () => {
	it('toggles header row / banded rows and applies uniform cell padding', () => {
		const { store, actions } = buildActions(tableElement());

		actions.setTableHeaderRow(true);
		actions.setTableBandedRows(true);
		actions.setTableCellPadding(8);

		const el = selectedEl(store) as {
			tableData?: {
				firstRowHeader?: boolean;
				bandedRows?: boolean;
				rows: Array<{ cells: Array<{ style?: { marginLeft?: number } }> }>;
			};
		};
		expect(el.tableData?.firstRowHeader).toBeTruthy();
		expect(el.tableData?.bandedRows).toBeTruthy();
		for (const row of el.tableData?.rows ?? []) {
			for (const cell of row.cells) {
				expect(cell.style?.marginLeft).toBe(8);
			}
		}
	});

	it('formats only the selected table cell', () => {
		const { store, actions } = buildActions(tableElement());

		actions.setTableCellStyle(0, 1, {
			backgroundColor: '#abcdef',
			bold: true,
			align: 'center',
			marginLeft: 6,
		});

		const cells =
			(selectedEl(store) as { tableData?: { rows: Array<{ cells: Array<{ style?: unknown }> }> } })
				.tableData?.rows[0].cells ?? [];
		expect(cells[0].style).toBeUndefined();
		expect(cells[1].style).toMatchObject({
			backgroundColor: '#abcdef',
			bold: true,
			align: 'center',
			marginLeft: 6,
		});
	});
});

/**
 * A structural SmartArt edit clears the cached `dsp` drawing shapes to `[]`.
 * React has always followed such an edit with `rebuildDrawingShapesIfCleared`
 * so the richer cached-shape render path stays active; this binding never did,
 * leaving the diagram to fall back to the crude family approximation.
 */
function smartArtElement(): PptxElement {
	return {
		type: 'smartArt',
		id: 'sa1',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		smartArtData: {
			nodes: [
				{ id: 'n1', text: 'One' },
				{ id: 'n2', text: 'Two' },
			],
			resolvedLayoutType: 'list',
			// A cached PowerPoint drawing, as a real deck carries.
			drawingShapes: [
				{ id: 'dsp1', shapeType: 'roundRect', x: 0, y: 0, width: 100, height: 40, text: 'One' },
				{ id: 'dsp2', shapeType: 'roundRect', x: 0, y: 50, width: 100, height: 40, text: 'Two' },
			],
		},
	} as PptxElement;
}

function smartArtData(store: Store<ViewerState>) {
	const el = selectedEl(store);
	return el.type === 'smartArt' ? el.smartArtData : undefined;
}

describe('createInspectorActions smartArt reflow', () => {
	it('rebuilds the cached drawing shapes a structural edit cleared', () => {
		const { store, actions } = buildActions(smartArtElement());
		actions.mutateSmartArtNode('n2', 'add');
		const data = smartArtData(store)!;
		expect(data.nodes).toHaveLength(3);
		// Without the reflow this is the empty array the core op left behind.
		expect(data.drawingShapes).toHaveLength(3);
		expect(data.drawingShapes?.[0]?.id).toBe('reflow-list-n1');
	});

	it('rebuilds after a layout switch', () => {
		const { store, actions } = buildActions(smartArtElement());
		actions.setSmartArtLayout('cycle');
		const shapes = smartArtData(store)?.drawingShapes ?? [];
		expect(shapes).toHaveLength(2);
		expect(shapes[0]?.id).toBe('reflow-cycle-n1');
	});

	it('leaves an intact cached drawing alone on a text edit', () => {
		const { store, actions } = buildActions(smartArtElement());
		actions.setSmartArtNodeText('n1', 'Uno');
		const shapes = smartArtData(store)?.drawingShapes ?? [];
		// The cached `dsp` drawing still wins: patched in place, never regenerated.
		expect(shapes.map((s) => s.id)).toStrictEqual(['dsp1', 'dsp2']);
		expect(shapes[0]?.text).toBe('Uno');
	});
});

describe('createInspectorActions toggleElementLock', () => {
	it('locks an unlocked element, writing noMove/noResize (not noSelect)', () => {
		const { store, actions } = buildActions(textElement());
		actions.toggleElementLock();
		expect((selectedEl(store) as { locks?: unknown }).locks).toStrictEqual({
			noMove: true,
			noResize: true,
		});
	});

	it('unlocks an already-locked element', () => {
		const el = { ...textElement(), locks: { noMove: true, noResize: true } };
		const { store, actions } = buildActions(el);
		actions.toggleElementLock();
		expect((selectedEl(store) as { locks?: unknown }).locks).toBeUndefined();
	});

	it('is undoable', () => {
		const { store, ops, actions } = buildActions(textElement());
		actions.toggleElementLock();
		expect((selectedEl(store) as { locks?: unknown }).locks).toBeTruthy();
		ops.undo();
		expect((selectedEl(store) as { locks?: unknown }).locks).toBeUndefined();
	});
});

describe('createInspectorActions setAltText / setTitle', () => {
	it('writes altText onto a text element (a base-element field, not image-only)', () => {
		const { store, actions } = buildActions(textElement());
		actions.setAltText('A red rectangle');
		expect((selectedEl(store) as { altText?: string }).altText).toBe('A red rectangle');
	});

	it('writes title onto a text element', () => {
		const { store, actions } = buildActions(textElement());
		actions.setTitle('Callout');
		expect((selectedEl(store) as { title?: string }).title).toBe('Callout');
	});

	it('setTitle is undoable', () => {
		const { store, ops, actions } = buildActions(textElement());
		actions.setTitle('Callout');
		expect((selectedEl(store) as { title?: string }).title).toBe('Callout');
		ops.undo();
		expect((selectedEl(store) as { title?: string }).title).toBeUndefined();
	});
});
