/**
 * editor-insert.ts — Pure factory functions for creating new slide elements.
 *
 * Framework-agnostic: no Angular imports. Each factory returns a `PptxElement`
 * with `id: ''` so that `EditorStateService.addElement` can assign a real id
 * before persisting the element.
 *
 * Default position/size places elements near the slide centre (slides are
 * typically 960 × 540 px in the viewer's coordinate space).
 */

import type { PptxElement } from 'pptx-viewer-core';

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
