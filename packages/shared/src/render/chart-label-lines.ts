/**
 * chart-label-lines.ts: turn a data label whose text contains line breaks
 * (for example a pie's default "Category" + newline + "25%") into one
 * single-line `SvgText` per line.
 *
 * SVG `<text>` collapses a newline to a space, and each binding paints an
 * `SvgText` as one `<text>` node, so splitting here (pure, shared) makes every
 * binding draw the lines without any template change.
 *
 * @module chart-label-lines
 */
import { DATA_LABEL_LINE_HEIGHT } from './chart-label-measure';
import type { SvgText } from './chart-svg-primitives';

/**
 * Split `label` on `\n` into stacked single-line labels. A single-line label is
 * returned as-is (same object). A vertically centred label (`central` /
 * `middle`) stays centred as a block; otherwise `y` is the first line's
 * baseline and the rest stack below it.
 */
export function splitLabelLines(label: SvgText): SvgText[] {
	const lines = label.text.split(/\r?\n/);
	if (lines.length < 2) {
		return [label];
	}
	const step = label.fontSize * DATA_LABEL_LINE_HEIGHT;
	const centred = label.dominantBaseline === 'central' || label.dominantBaseline === 'middle';
	const top = centred ? label.y - ((lines.length - 1) * step) / 2 : label.y;
	return lines.map((text, i) => ({ ...label, text, y: top + i * step }));
}
