import { createSvgEl } from '../dom';

/**
 * Small SVG text helpers shared by the SmartArt drawing-shapes and fallback
 * layout paths. Ports of the `textLines` helper embedded in Vue's
 * `SmartArtRenderer.vue` (kept binding-local there too; each binding only owns
 * the DOM assembly, the geometry itself comes from `pptx-viewer-shared`).
 */

/** One rendered line of a multi-line SVG label; `y` is an offset from the node centre. */
export interface SvgTextLine {
	text: string;
	y: number;
}

/**
 * Split node text on `\n` and compute per-line y offsets (in SVG px) that
 * centre the block around the node centre y (offset 0). Single-line text
 * produces one entry with y=0, preserving `dominant-baseline="central"`
 * behaviour exactly (mirrors Vue's `textLines`).
 */
export function svgTextLines(text: string, fontSize: number): SvgTextLine[] {
	const raw = text.split('\n').filter((l) => l.length > 0);
	if (raw.length === 0) {
		return [{ text: '', y: 0 }];
	}
	const lh = fontSize * 1.2;
	const totalH = raw.length * lh;
	return raw.map((line, i) => ({
		text: line,
		y: -totalH / 2 + lh / 2 + i * lh,
	}));
}

/** Options for {@link appendCenteredSvgText}. */
export interface CenteredSvgTextOptions {
	text: string;
	/** Centre x of the node (text anchor). */
	x: number;
	/** Centre y of the node (lines are offset around it). */
	y: number;
	fill: string;
	fontSize: number;
}

/**
 * Append a centred, multi-line `<text>` (one `<tspan>` per line) to `parent`.
 */
export function appendCenteredSvgText(
	doc: Document,
	parent: SVGElement,
	options: CenteredSvgTextOptions,
): void {
	const textEl = createSvgEl(doc, 'text', {
		x: options.x,
		'text-anchor': 'middle',
		'dominant-baseline': 'central',
		fill: options.fill,
		'font-size': options.fontSize,
	});
	for (const line of svgTextLines(options.text, options.fontSize)) {
		const tspan = createSvgEl(doc, 'tspan', { x: options.x, y: options.y + line.y });
		tspan.textContent = line.text;
		textEl.appendChild(tspan);
	}
	parent.appendChild(textEl);
}

/** Inline style applied to every SmartArt SVG so it fills the element box. */
export const SMARTART_SVG_STYLE = 'width:100%;height:100%;pointer-events:none;display:block';
