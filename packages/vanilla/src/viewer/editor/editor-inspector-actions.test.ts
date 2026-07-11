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
});
