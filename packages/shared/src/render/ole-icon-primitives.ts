/**
 * Data-driven placeholder icon primitives for `ole` (embedded object)
 * elements: the Excel grid, Word document, PDF, Visio diagram, MathType
 * `f(x)`, and generic linked-objects glyphs.
 *
 * Extracted from the identical `rect`/`line`/`text` builders + `ICONS` table
 * that Svelte's `render/ole-view.ts` and Vanilla's
 * `render/elements/ole-icons.ts` both hand-rolled byte-for-byte (down to the
 * shape coordinates). Every binding's OLE renderer maps `OleIconShape[]` onto
 * its own `<rect>`/`<line>`/`<text>` (or `createSvgEl`) primitives; only the
 * DOM/JSX emission stays per binding.
 */
import type { ResolvedOleType } from './ole-renderer-helpers';

/** One primitive of a data-driven placeholder icon. */
export interface OleIconShape {
	tag: 'rect' | 'line' | 'text';
	attrs: Record<string, string | number>;
	/** Text content, only present when `tag === 'text'`. */
	text?: string;
}

function rect(x: number, y: number, width: number, height: number, rx: number): OleIconShape {
	return {
		tag: 'rect',
		attrs: { x, y, width, height, rx, 'stroke-width': 1.5, fill: 'none' },
	};
}

function line(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	strokeWidth = 1,
	round = false,
): OleIconShape {
	return {
		tag: 'line',
		attrs: {
			x1,
			y1,
			x2,
			y2,
			'stroke-width': strokeWidth,
			...(round ? { 'stroke-linecap': 'round' } : {}),
		},
	};
}

function text(
	x: number,
	y: number,
	content: string,
	fontSize: number,
	italic = false,
): OleIconShape {
	return {
		tag: 'text',
		attrs: {
			x,
			y,
			'text-anchor': 'middle',
			'font-size': fontSize,
			'font-weight': 'bold',
			...(italic ? { 'font-style': 'italic' } : {}),
		},
		text: content,
	};
}

const ICONS: Record<ResolvedOleType, OleIconShape[]> = {
	excel: [
		rect(3, 3, 18, 18, 2),
		line(3, 9, 21, 9),
		line(3, 15, 21, 15),
		line(9, 3, 9, 21),
		line(15, 3, 15, 21),
	],
	word: [
		rect(4, 2, 16, 20, 2),
		line(7, 7, 17, 7, 1.5, true),
		line(7, 11, 17, 11, 1.5, true),
		line(7, 15, 13, 15, 1.5, true),
	],
	pdf: [rect(4, 2, 16, 20, 2), text(12, 14, 'PDF', 7)],
	visio: [
		rect(8, 2, 8, 5, 1),
		line(12, 7, 12, 10, 1.5),
		line(6, 10, 18, 10, 1.5),
		line(6, 10, 6, 13, 1.5),
		line(18, 10, 18, 13, 1.5),
		rect(2, 13, 8, 5, 1),
		rect(14, 13, 8, 5, 1),
	],
	mathtype: [rect(2, 4, 20, 16, 2), text(12, 15, 'f(x)', 9, true)],
	unknown: [rect(2, 5, 9, 7, 1.5), rect(13, 12, 9, 7, 1.5), line(11, 8.5, 13, 15.5, 1.5, true)],
};

/** Icon primitives for a resolved OLE type. */
export function getOleIconShapes(type: ResolvedOleType): OleIconShape[] {
	return ICONS[type];
}
