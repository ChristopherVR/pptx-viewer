import type { PptxElement } from 'pptx-viewer-core';
import type { CanvasSize } from 'pptx-viewer-shared';
import { substituteFieldText } from 'pptx-viewer-shared';

import { centerOnCanvas } from './editor-insert';

/**
 * Pure factories for the Insert > Field action: resolve a field's display
 * text via the shared `text-field-substitution.ts` module (slide number /
 * date-time / header / footer), then build a text-bearing `shape` whose
 * segment carries `fieldType` + a fresh field GUID, matching the OOXML
 * field-run shape every binding's save pipeline expects.
 */

/** Default box size (px) for a freshly-inserted field placeholder shape. */
const FIELD_SIZE = { width: 200, height: 40 };

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

/** Build a fresh, uppercased OOXML field GUID (`{XXXXXXXX-...}`). */
function newFieldGuid(): string {
	const c = globalThis.crypto;
	if (c && typeof c.randomUUID === 'function') {
		return `{${c.randomUUID().toUpperCase()}}`;
	}
	return `{${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}}`;
}

/**
 * Build a new, centred field-placeholder shape (a text-bearing shape whose
 * single segment carries `fieldType` + a fresh field GUID).
 */
export function buildFieldInsertElement(
	fieldType: string,
	displayText: string,
	canvasSize: CanvasSize,
): PptxElement {
	const el = {
		id: '',
		type: 'shape',
		name: 'Field',
		x: 0,
		y: 0,
		width: FIELD_SIZE.width,
		height: FIELD_SIZE.height,
		text: displayText,
		textStyle: { fontSize: 14 },
		textSegments: [
			{ text: displayText, style: { fontSize: 14 }, fieldType, fieldGuid: newFieldGuid() },
		],
	} as unknown as PptxElement;
	centerOnCanvas(el, canvasSize);
	return el;
}
