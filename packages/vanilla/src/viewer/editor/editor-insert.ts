import type { PptxElement } from 'pptx-viewer-core';
import {
	createConnectorElement,
	createEditorId,
	createShapeElement,
	createTextElement,
} from 'pptx-viewer-core';
import type { CanvasSize } from 'pptx-viewer-shared';
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

/** The shape/text/table element kinds the insert menu can create directly. */
export type InsertKind = 'text' | 'rect' | 'ellipse' | 'line' | 'table';

/** Default box sizes (px) per insert kind, mirroring the Vue insert defaults. */
const SIZES: Record<InsertKind, { width: number; height: number }> = {
	text: { width: 320, height: 80 },
	rect: { width: 240, height: 160 },
	ellipse: { width: 240, height: 160 },
	line: { width: 240, height: 0 },
	table: { width: 600, height: 250 },
};

/** Centre an element's box on the slide canvas (top-left clamped to >= 0). */
export function centerOnCanvas(el: PptxElement, canvasSize: CanvasSize): void {
	el.x = Math.max(0, Math.round((canvasSize.width - el.width) / 2));
	el.y = Math.max(0, Math.round((canvasSize.height - el.height) / 2));
}

/** Build a new (centred, freshly-identified) element for the given kind. */
export function buildInsertElement(kind: InsertKind, canvasSize: CanvasSize): PptxElement {
	const size = SIZES[kind];
	let el: PptxElement;
	switch (kind) {
		case 'text':
			el = createTextElement('Text', { fontSize: 18, color: '#000000' });
			break;
		case 'rect':
			el = createShapeElement('rect');
			break;
		case 'ellipse':
			el = createShapeElement('ellipse');
			break;
		case 'line':
			el = createConnectorElement({ type: 'straight', stroke: { color: '#000000', width: 2 } });
			break;
		case 'table':
			el = { ...newTableElement(3, 3), id: createEditorId('table') } as PptxElement;
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
