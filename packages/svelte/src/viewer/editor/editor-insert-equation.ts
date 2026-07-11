import type { PptxElement } from 'pptx-viewer-core';
import type { CanvasSize } from 'pptx-viewer-shared';

import { centerOnCanvas } from './editor-insert';

/**
 * Pure factory for the Insert > Equation action: builds a text-bearing
 * `shape` whose single text segment carries `equationXml`, the same
 * structure an equation renderer consumes when rendering inline equations
 * within a paragraph. The OMML payload is produced by the shared
 * `latex-to-omml` module (`EquationPanel.svelte` owns the LaTeX input + live
 * preview; this factory only builds the element once OMML is ready).
 */

/** Default box size (px) for a freshly-inserted equation shape. */
const EQUATION_SIZE = { width: 400, height: 80 };

/** Build a new, centred equation element from an OMML object tree. */
export function buildEquationInsertElement(
	omml: Record<string, unknown>,
	canvasSize: CanvasSize,
): PptxElement {
	const placeholder = '[Equation]';
	const el = {
		id: '',
		type: 'shape',
		name: 'Equation',
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
