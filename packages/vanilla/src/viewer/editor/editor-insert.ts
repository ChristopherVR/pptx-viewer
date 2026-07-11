import type { PptxElement } from 'pptx-viewer-core';
import {
	createConnectorElement,
	createEditorId,
	createShapeElement,
	createTextElement,
} from 'pptx-viewer-core';
import type { CanvasSize, ShapePresetType } from 'pptx-viewer-shared';
import { newTableElement } from 'pptx-viewer-shared';

/**
 * Insert-element factories for the vanilla editor.
 *
 * The pure builders wrap the framework-agnostic core/shared factories
 * (`createTextElement`, `createShapeElement`, `createConnectorElement`,
 * `newTableElement`) and centre the new element on the slide canvas. The one
 * async helper (`pickImageElement`) owns the file-picker + `FileReader` DOM
 * side effects needed to turn a chosen image file into a data-URL image
 * element; it too returns a centred, ready-to-insert element.
 */

/** The element kinds the Insert ribbon tab can create directly. */
export type InsertKind = 'text' | 'table' | 'shape';

/** Default box size (px) for a freshly-inserted text box. */
const TEXT_SIZE = { width: 320, height: 80 };
/** Default box size (px) for a freshly-inserted table. */
const TABLE_SIZE = { width: 600, height: 250 };
/** Default box size (px) for most inserted shapes (see {@link SHAPE_PRESET_DEFS}). */
const SHAPE_SIZE = { width: 200, height: 150 };
/** Default box size (px) for the zero-height line/connector presets. */
const LINE_SIZE = { width: 240, height: 0 };

/** Centre an element's box on the slide canvas (top-left clamped to >= 0). */
export function centerOnCanvas(el: PptxElement, canvasSize: CanvasSize): void {
	el.x = Math.max(0, Math.round((canvasSize.width - el.width) / 2));
	el.y = Math.max(0, Math.round((canvasSize.height - el.height) / 2));
}

/**
 * Build a new (centred, freshly-identified) element for the given kind. For
 * `'shape'`, `shapeType` selects the preset from the shared
 * `SHAPE_PRESET_DEFS` catalogue (`'connector'` maps to a real connector
 * element; every other preset, including `'line'`, maps to a shape with that
 * `a:prstGeom` type). Defaults to `'rect'` when omitted.
 */
export function buildInsertElement(
	kind: InsertKind,
	canvasSize: CanvasSize,
	shapeType: ShapePresetType = 'rect',
): PptxElement {
	let el: PptxElement;
	let size: { width: number; height: number };
	switch (kind) {
		case 'text':
			el = createTextElement('Text', { fontSize: 18, color: '#000000' });
			size = TEXT_SIZE;
			break;
		case 'table':
			el = { ...newTableElement(3, 3), id: createEditorId('table') } as PptxElement;
			size = TABLE_SIZE;
			break;
		case 'shape':
			if (shapeType === 'connector') {
				el = createConnectorElement({ type: 'straight', stroke: { color: '#000000', width: 2 } });
				size = LINE_SIZE;
			} else {
				el = createShapeElement(shapeType);
				size = shapeType === 'line' ? LINE_SIZE : SHAPE_SIZE;
			}
			break;
	}
	el.width = size.width;
	el.height = size.height;
	centerOnCanvas(el, canvasSize);
	return el;
}

/** Load an image file's natural dimensions, capped to `maxWidth` (aspect kept). */
function measureImage(
	dataUrl: string,
	maxWidth: number,
): Promise<{ width: number; height: number }> {
	return new Promise((resolve) => {
		const probe = new Image();
		probe.onload = () => {
			const ratio = probe.width / Math.max(1, probe.height);
			const width = Math.min(maxWidth, probe.width || maxWidth);
			const height = Math.max(1, Math.round(width / (ratio || 1)));
			resolve({ width, height });
		};
		probe.onerror = () => resolve({ width: maxWidth, height: Math.round(maxWidth * 0.6) });
		probe.src = dataUrl;
	});
}

/**
 * Open a native image file picker, read the chosen file as a data URL, size it
 * to ~60% of the slide width (aspect preserved), and return a centred image
 * element. Resolves `null` when the user cancels or the file cannot be read.
 */
export function pickImageElement(
	doc: Document,
	canvasSize: CanvasSize,
): Promise<PptxElement | null> {
	return new Promise((resolve) => {
		const input = doc.createElement('input');
		input.type = 'file';
		input.accept = 'image/*';
		input.style.display = 'none';
		doc.body.appendChild(input);
		const cleanup = (): void => input.remove();
		input.addEventListener('cancel', () => {
			cleanup();
			resolve(null);
		});
		input.addEventListener('change', () => {
			const file = input.files?.[0];
			cleanup();
			if (!file) {
				resolve(null);
				return;
			}
			const reader = new FileReader();
			reader.onload = async () => {
				const dataUrl = typeof reader.result === 'string' ? reader.result : '';
				if (!dataUrl) {
					resolve(null);
					return;
				}
				const maxW = Math.round(canvasSize.width * 0.6);
				const { width, height } = await measureImage(dataUrl, maxW);
				const el = {
					id: createEditorId('image'),
					type: 'image',
					name: 'Image',
					x: 0,
					y: 0,
					width,
					height,
					imageData: dataUrl,
				} as unknown as PptxElement;
				centerOnCanvas(el, canvasSize);
				resolve(el);
			};
			reader.onerror = () => resolve(null);
			reader.readAsDataURL(file);
		});
		input.click();
	});
}
