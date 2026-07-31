/**
 * ruler-strips.ts: the visibility gate for the slide canvas's ruler strips.
 *
 * Deliberately holds NO tick or guide-drop maths: it forwards to the shared
 * `generateTicks` (the single source of truth every binding renders from), and
 * exists only because Angular components cannot be mounted in this package's
 * unit tests, so the "rulers off -> no ticks / rulers on -> shared ticks" rule
 * needs a seam that is testable without a TestBed. It replaces the deleted
 * `ruler-ticks.ts`, which generated its OWN quarter-inch, inches-only ticks and
 * so disagreed with React, Vue, Svelte and Vanilla at every zoom level.
 */

import { generateTicks } from '../internal/shared';
import type { RulerUnit, Tick } from '../internal/shared';

/** Ticks for one ruler strip, or nothing at all while the strip is hidden. */
export function rulerStripTicks(
	visible: boolean,
	slideLengthPx: number,
	scale: number,
	unit: RulerUnit,
): ReadonlyArray<Tick> {
	return visible ? generateTicks(slideLengthPx, scale, unit) : [];
}

/**
 * Selected-element extent projected onto a strip, in scaled px, or null when
 * nothing (or more than one thing) is selected. PowerPoint shades this span on
 * both rulers; React and Svelte do the same.
 */
export function rulerHighlight(
	start: number | undefined,
	span: number | undefined,
	scale: number,
): { start: number; span: number } | null {
	if (start === undefined || span === undefined) {
		return null;
	}
	return { start: start * scale, span: Math.max(span * scale, 1) };
}
