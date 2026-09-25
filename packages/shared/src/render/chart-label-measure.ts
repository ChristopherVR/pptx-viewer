/**
 * The box PowerPoint draws around a chart data label, sized from the label
 * text's MEASURED width.
 *
 * COM ground truth (`DataLabel.Width/Height` of boxed pie labels in
 * `chart-pie-best-fit.pptx`, 12pt Calibri): the box is the text's advance
 * width plus 3pt of padding on each side, and one line box (ascent + descent
 * + line gap, 1.2207em for Calibri) plus 1.5pt above and below: "25" is
 * 18.16 x 17.65pt, "Cat 1" (two lines) 30.86 x 32.3pt. The width used to be
 * estimated as 0.52em per character, which is about right for digits but
 * off by a third for narrow or wide text.
 *
 * The width comes from a {@link ChartTextMeasurer}. By default that is a
 * shared `<canvas>` 2D context, which measures identically in all five
 * bindings; a host (or a test) can inject its own with
 * {@link setChartTextMeasurer}. Where there is no DOM (node, vitest's default
 * environment) the old per-character estimate is the fallback.
 *
 * @module chart-label-measure
 */
import type { SvgText } from './chart-svg-primitives';

/** The font a label paints with, as its `SvgText` carries it. */
export interface ChartTextFont {
	/** px */
	fontSize: number;
	fontFamily?: string;
	fontWeight?: 'normal' | 'bold';
	fontStyle?: 'normal' | 'italic';
}

/** Measures the advance width of `text` in px, or `undefined` when it cannot. */
export type ChartTextMeasurer = (text: string, font: ChartTextFont) => number | undefined;

/** px per pt. */
const PX_PER_PT = 4 / 3;
/** COM: 3pt of padding left and right of the text. */
export const DATA_LABEL_PAD_X = 3 * PX_PER_PT;
/** COM: 1.5pt of padding above and below the text. */
export const DATA_LABEL_PAD_Y = 1.5 * PX_PER_PT;
/** One line box as a fraction of the font size (Calibri's win ascent + descent). */
export const DATA_LABEL_LINE_HEIGHT = 1.2207;
/** Where the line box's top sits above the baseline, as a fraction of the font size. */
const ASCENT = 0.952;

let injected: ChartTextMeasurer | undefined;
let canvasContext: CanvasRenderingContext2D | null | undefined;

/**
 * Replace the text measurer (`undefined` restores the canvas default). Meant
 * for hosts that render charts somewhere a canvas cannot measure, and tests.
 */
export function setChartTextMeasurer(measurer: ChartTextMeasurer | undefined): void {
	injected = measurer;
}

function canvasMeasure(text: string, font: ChartTextFont): number | undefined {
	if (canvasContext === undefined) {
		try {
			canvasContext =
				typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
		} catch {
			canvasContext = null;
		}
	}
	if (!canvasContext) {
		return undefined;
	}
	const style = font.fontStyle === 'italic' ? 'italic ' : '';
	const weight = font.fontWeight === 'bold' ? 'bold ' : '';
	const family = font.fontFamily ? `"${font.fontFamily}", sans-serif` : 'sans-serif';
	canvasContext.font = `${style}${weight}${font.fontSize}px ${family}`;
	const width = canvasContext.measureText(text).width;
	return Number.isFinite(width) && width > 0 ? width : undefined;
}

/** The old per-character estimate, kept as the no-DOM fallback. */
export function estimateChartTextWidth(text: string, fontSize: number): number {
	return text.length * fontSize * 0.52;
}

/** The advance width of `text` in px: measured when possible, else estimated. */
export function measureChartTextWidth(text: string, font: ChartTextFont): number {
	if (!text) {
		return 0;
	}
	const measured = injected ? injected(text, font) : canvasMeasure(text, font);
	return measured ?? estimateChartTextWidth(text, font.fontSize);
}

/** A label box's size in px: the widest line plus padding, by the line count. */
export function dataLabelBoxSize(label: SvgText): { w: number; h: number } {
	const lines = label.text.split('\n');
	const font: ChartTextFont = {
		fontSize: label.fontSize,
		...(label.fontFamily ? { fontFamily: label.fontFamily } : {}),
		...(label.fontWeight ? { fontWeight: label.fontWeight } : {}),
		...(label.fontStyle ? { fontStyle: label.fontStyle } : {}),
	};
	const textWidth = Math.max(...lines.map((line) => measureChartTextWidth(line, font)));
	return {
		w: textWidth + DATA_LABEL_PAD_X * 2,
		h: lines.length * label.fontSize * DATA_LABEL_LINE_HEIGHT + DATA_LABEL_PAD_Y * 2,
	};
}

/** The rectangle PowerPoint draws around `label`, from its anchor and baseline. */
export function dataLabelBox(label: SvgText): { x: number; y: number; w: number; h: number } {
	const { w, h } = dataLabelBoxSize(label);
	const x =
		label.textAnchor === 'middle'
			? label.x - w / 2
			: label.textAnchor === 'end'
				? label.x - w + DATA_LABEL_PAD_X
				: label.x - DATA_LABEL_PAD_X;
	const centred = label.dominantBaseline === 'central' || label.dominantBaseline === 'middle';
	const y = centred ? label.y - h / 2 : label.y - label.fontSize * ASCENT - DATA_LABEL_PAD_Y;
	return { x, y, w, h };
}
