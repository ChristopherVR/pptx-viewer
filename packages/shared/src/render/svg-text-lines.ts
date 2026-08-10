/**
 * Line layout for centred SVG labels (SmartArt nodes and cached shapes).
 *
 * SVG has no text box: a `<text>` element does not wrap, and a multi-line label
 * has to be assembled from `<tspan>`s that the caller positions itself. Every
 * binding needs the same arithmetic to do that, so it lives here and each
 * binding is left with nothing but placing one `<tspan>` per line.
 *
 * @module svg-text-lines
 */

import { wrapTextByEstimatedWidth } from './text-wrap-estimate';

/** Multiple of the font size used as the line box height, as PowerPoint does. */
const LINE_HEIGHT_RATIO = 1.2;

/** One line of a centred label, with the baseline to draw it at. */
export interface SvgTextLine {
	text: string;
	y: number;
}

/** Options for {@link centeredSvgTextLines}. */
export interface CenteredSvgTextOptions {
	/**
	 * Available width. When given, long lines are wrapped to fit it; when
	 * omitted, only authored line breaks split the label.
	 */
	maxWidth?: number;
	/** Baseline the block is centred on. Defaults to 0, giving relative offsets. */
	centerY?: number;
}

/**
 * Split a label into lines and centre the block vertically.
 *
 * @param text - The label text; `\n` breaks are always honoured.
 * @param fontSize - Font size in the same user units as the result.
 * @param options - See {@link CenteredSvgTextOptions}.
 * @returns One entry per line. Empty text yields a single empty line so callers
 *   that always emit a `<tspan>` keep their previous single-line geometry.
 */
export function centeredSvgTextLines(
	text: string,
	fontSize: number,
	options: CenteredSvgTextOptions = {},
): SvgTextLine[] {
	const lines =
		options.maxWidth !== undefined
			? wrapTextByEstimatedWidth(text, options.maxWidth, fontSize)
			: text.split('\n').filter((line) => line.length > 0);
	const centerY = options.centerY ?? 0;
	if (lines.length === 0) {
		return [{ text: '', y: centerY }];
	}

	const lineHeight = fontSize * LINE_HEIGHT_RATIO;
	const blockTop = centerY - (lines.length * lineHeight) / 2;
	return lines.map((line, index) => ({
		text: line,
		y: blockTop + lineHeight / 2 + index * lineHeight,
	}));
}
