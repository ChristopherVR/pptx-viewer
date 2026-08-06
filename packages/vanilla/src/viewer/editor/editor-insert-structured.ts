import type { PptxElement, SmartArtLayout } from 'pptx-viewer-core';
import { createEditorId } from 'pptx-viewer-core';
import type { CanvasSize, InsertChartKind } from 'pptx-viewer-shared';
import {
	buildActionButtonElement,
	buildSmartArtPresetData,
	createDefaultChartElement,
	substituteFieldText,
} from 'pptx-viewer-shared';

import { centerOnCanvas } from './editor-insert';

/**
 * Pure factories for the "structured" Insert actions (chart, equation,
 * SmartArt, action button, field) that don't fit `editor-insert.ts`'s simple
 * text/table/shape trio. Each wraps a shared `pptx-viewer-shared` /
 * `pptx-viewer-core` builder and centres the result on the slide canvas,
 * mirroring `buildInsertElement`'s convention.
 */

/** Default box size (px) for a freshly-inserted equation shape. */
const EQUATION_SIZE = { width: 400, height: 80 };
/** Default box size (px) for a freshly-inserted SmartArt diagram. */
const SMARTART_SIZE = { width: 600, height: 340 };
/** Default box size (px) for a freshly-inserted field placeholder shape. */
const FIELD_SIZE = { width: 200, height: 40 };

/**
 * Build a new, centred chart element for the given insert-dropdown entry
 * (`'column'` yields vertical columns, `'bar'` horizontal bars).
 */
export function buildChartInsertElement(
	chartKind: InsertChartKind,
	canvasSize: CanvasSize,
): PptxElement {
	const el = createDefaultChartElement(chartKind);
	centerOnCanvas(el, canvasSize);
	return el;
}

/**
 * Build a new, centred SmartArt element from a gallery preset (layout +
 * default node texts), via the shared `buildSmartArtPresetData` factory.
 */
export function buildSmartArtInsertElement(
	layout: SmartArtLayout,
	defaultItems: string[],
	canvasSize: CanvasSize,
): PptxElement {
	const el = {
		id: createEditorId('smartart'),
		type: 'smartArt',
		x: 0,
		y: 0,
		width: SMARTART_SIZE.width,
		height: SMARTART_SIZE.height,
		smartArtData: buildSmartArtPresetData(layout, defaultItems, (i) =>
			createEditorId(`smartart-node-${i}`),
		),
	} as unknown as PptxElement;
	centerOnCanvas(el, canvasSize);
	return el;
}

/**
 * Build a new, centred equation element (a text-bearing shape whose single
 * segment carries `equationXml`) from an OMML object produced by the shared
 * `latex-to-omml` converter.
 */
export function buildEquationInsertElement(
	omml: Record<string, unknown>,
	canvasSize: CanvasSize,
): PptxElement {
	const placeholder = '[Equation]';
	const el = {
		id: createEditorId('equation'),
		type: 'shape',
		x: 0,
		y: 0,
		width: EQUATION_SIZE.width,
		height: EQUATION_SIZE.height,
		text: placeholder,
		textStyle: { fontSize: 18, fontFamily: 'Cambria Math' },
		textSegments: [
			{
				text: placeholder,
				style: { fontSize: 18, fontFamily: 'Cambria Math' },
				equationXml: omml,
			},
		],
	} as unknown as PptxElement;
	centerOnCanvas(el, canvasSize);
	return el;
}

/**
 * Build a new, centred action-button shape from the shared preset catalogue,
 * or `null` when `shapeType` isn't a known action-button preset.
 */
export function buildActionButtonInsertElement(
	shapeType: string,
	canvasSize: CanvasSize,
): PptxElement | null {
	const el = buildActionButtonElement(shapeType, createEditorId('actionbutton'));
	if (!el) {
		return null;
	}
	centerOnCanvas(el, canvasSize);
	return el;
}

/** Current slide-number-aware field context passed to `resolveFieldDisplayText`. */
export interface FieldInsertContext {
	slideNumber: number;
}

/**
 * Resolve the display text for a field placeholder via the shared
 * `substituteFieldText` helper (slide number / date-time / header / footer).
 */
export function resolveFieldDisplayText(fieldType: string, ctx: FieldInsertContext): string {
	return substituteFieldText(fieldType, fieldType, {
		slideNumber: ctx.slideNumber,
		headerText: 'Header',
		footerText: 'Footer',
	});
}

/**
 * Build a new, centred field-placeholder shape (a text-bearing shape whose
 * single segment carries `fieldType` + a fresh field GUID, matching the OOXML
 * field-run shape every binding's save pipeline expects).
 */
export function buildFieldInsertElement(
	fieldType: string,
	displayText: string,
	canvasSize: CanvasSize,
): PptxElement {
	const fieldGuid = `{${crypto.randomUUID().toUpperCase()}}`;
	const el = {
		id: createEditorId('field'),
		type: 'shape',
		x: 0,
		y: 0,
		width: FIELD_SIZE.width,
		height: FIELD_SIZE.height,
		text: displayText,
		textStyle: { fontSize: 14 },
		textSegments: [{ text: displayText, style: { fontSize: 14 }, fieldType, fieldGuid }],
	} as unknown as PptxElement;
	centerOnCanvas(el, canvasSize);
	return el;
}
