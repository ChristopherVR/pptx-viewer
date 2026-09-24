/**
 * Stitch a gradient/pattern text fill (`background-clip: text`, see
 * `text-fill.ts`) into ONE continuous fill across every consecutive run that
 * shares the identical gradient/pattern, instead of each run repainting the
 * same 0%-100% fill inside its own (narrower) box.
 *
 * `splitStyledRun` (`text-run-spacing.ts`) already keeps a single gradient RUN
 * from being fragmented into per-word pieces, which fixes the fill restarting
 * INSIDE one run. It cannot fix two authored SIBLING runs that both carry the
 * identical gradient (`p(r('GRADIENT ', grad) + r('SPANS RUNS', grad))`,
 * verified against PowerPoint through COM: it paints "GRADIENT SPANS RUNS" as
 * one uninterrupted fill, not two): each run is still its own inline box, and
 * `background-clip: text` still scopes to that box alone. Sizing the
 * `background` to the group's total measured width and offsetting each run's
 * `background-position` by its own position within that width paints the
 * identical CSS gradient/pattern image once, sliced across the group.
 */

import type { RunFontSpec } from './text-metric-tracking';
import type { RunStyle } from './text-run-style';

let measureContext: CanvasRenderingContext2D | null | undefined;

/** Lazily created, cached measurement canvas; `null` outside a DOM. */
function getMeasureContext(): CanvasRenderingContext2D | null {
	if (measureContext !== undefined) {
		return measureContext;
	}
	measureContext =
		typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
	return measureContext;
}

/** The font a `RunStyle` (already-resolved CSS) renders with, for measuring. */
function fontSpecFromStyle(style: RunStyle): RunFontSpec {
	const parsedSize =
		typeof style.fontSize === 'string' ? Number.parseFloat(style.fontSize) : undefined;
	return {
		fontFamily: typeof style.fontFamily === 'string' ? style.fontFamily : undefined,
		fontSizePx: parsedSize !== undefined && Number.isFinite(parsedSize) ? parsedSize : undefined,
		bold: style.fontWeight === 'bold',
		italic: style.fontStyle === 'italic',
	};
}

/** `text`'s rendered width in CSS px with `font`, or `0` without a DOM. */
function measureWidth(text: string, font: RunFontSpec): number {
	const ctx = getMeasureContext();
	if (!ctx || !text) {
		return 0;
	}
	const size = font.fontSizePx && font.fontSizePx > 0 ? font.fontSizePx : 16;
	const family = font.fontFamily || 'sans-serif';
	ctx.font = `${font.italic ? 'italic ' : ''}${font.bold ? 'bold ' : ''}${size}px ${family}`;
	return ctx.measureText(text).width;
}

/** The minimal shape this needs from a rendered run (structurally a `BuiltRun`). */
export interface GradientSpanRun {
	text: string;
	style: RunStyle;
}

/**
 * Mutate `runs` in place: every maximal group of consecutive entries whose
 * `style.background` is the SAME gradient/pattern text-fill string gets a
 * `backgroundSize` equal to the group's total measured width and a
 * `backgroundPosition` offset by its own cumulative position in the group.
 *
 * A group of one (a plain run, or an isolated gradient run with plain
 * neighbours) is left untouched - the default `background-size`/
 * `background-position` already paint exactly that run's own box, which is
 * the correct, unchanged behaviour.
 *
 * Measuring returns `0` outside a DOM (no `document`), in which case the
 * group is left as authored rather than dividing by a zero total.
 */
export function stitchContinuousGradientFill(runs: readonly GradientSpanRun[]): void {
	let index = 0;
	while (index < runs.length) {
		const fill = runs[index].style.background;
		if (typeof fill !== 'string' || fill.length === 0) {
			index += 1;
			continue;
		}
		let end = index + 1;
		while (end < runs.length && runs[end].style.background === fill) {
			end += 1;
		}
		if (end - index > 1) {
			const widths = runs
				.slice(index, end)
				.map((run) => measureWidth(run.text, fontSpecFromStyle(run.style)));
			const total = widths.reduce((sum, width) => sum + width, 0);
			if (total > 0) {
				let offset = 0;
				for (let i = index; i < end; i++) {
					runs[i].style.backgroundSize = `${total}px 100%`;
					runs[i].style.backgroundPosition = `-${offset}px 0`;
					offset += widths[i - index];
				}
			}
		}
		index = end;
	}
}
