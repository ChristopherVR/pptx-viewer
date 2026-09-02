/**
 * Recent-colours ("Most Recently Used") support for every binding's colour
 * picker.
 *
 * `PptxData.mruColors` (parsed from `p:clrMru` / `CT_ColorMRU`, and already
 * saved back the same way) never actually reached a colour picker's "Recent
 * colours" row: React's `FillStrokeProperties` threads a `recentColors` prop
 * all the way down to `StrokeEffectsSection`, but every call site feeds it a
 * hard-coded empty array. This module is the pure, framework-neutral piece
 * that seeds that row from the deck's own MRU list and folds a newly picked
 * colour back into it; a binding owns the (small) state that holds the
 * array between picks and passes `mruColorsPatch`'s result to `save()`.
 *
 * @module render/recent-colors
 */
import type { PptxData } from 'pptx-viewer-core';

/**
 * How many recent colours a picker shows, matching PowerPoint's own "Recent
 * Colors" row. (React previously kept this as a local constant in
 * `viewer/constants/scalar.ts`; that copy is unused by any picker yet and is
 * left alone here, for the binding wiring to repoint at this one.)
 */
export const RECENT_COLOR_LIMIT = 8;

const HEX_COLOR_PATTERN = /^#?([0-9a-fA-F]{6})$/u;

/**
 * Normalise a colour to `#RRGGBB`, uppercase - the form every helper in this
 * module compares against, and the form `mruColorsPatch` writes back (OOXML
 * `a:srgbClr/@val` is conventionally upper-case hex, with no leading `#`,
 * which `mruColorsPatch`'s caller strips the same way the existing
 * `p:clrMru` writer does). Returns `undefined` for anything that is not a
 * plain 6-digit hex colour (a named colour, `rgb(...)`, a gradient, etc. -
 * none of those belong on the MRU row).
 */
function normalizeRecentColor(hex: string): string | undefined {
	const match = HEX_COLOR_PATTERN.exec(hex.trim());
	return match ? `#${match[1].toUpperCase()}` : undefined;
}

/** De-duplicate (case-insensitively, already-normalised) and cap a list. */
function dedupeAndCap(colors: readonly string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const color of colors) {
		if (seen.has(color)) {
			continue;
		}
		seen.add(color);
		result.push(color);
		if (result.length >= RECENT_COLOR_LIMIT) {
			break;
		}
	}
	return result;
}

/**
 * Seed a colour picker's "Recent colours" row from the deck's own MRU list.
 *
 * `data.mruColors` is read in its stored order (index 0 = most recent),
 * matching what {@link pushRecentColor} produces going forward. Invalid or
 * duplicate entries are dropped rather than surfaced, since a picker has
 * nothing useful to do with either.
 */
export function seedRecentColors(data: Pick<PptxData, 'mruColors'>): string[] {
	const normalized: string[] = [];
	for (const color of data.mruColors ?? []) {
		const valid = normalizeRecentColor(color);
		if (valid) {
			normalized.push(valid);
		}
	}
	return dedupeAndCap(normalized);
}

/**
 * Fold a newly picked colour into a picker's recent-colours list: the colour
 * moves to the front (or is inserted there, if new), any earlier occurrence
 * is removed rather than left as a stale duplicate further down, and the
 * list is capped at {@link RECENT_COLOR_LIMIT}.
 *
 * Returns `recent` UNCHANGED (same reference) when `hex` is not a valid
 * 6-digit colour, so a caller can use the identity of the result to decide
 * whether anything changed.
 */
export function pushRecentColor(recent: readonly string[], hex: string): string[] {
	const normalizedHex = normalizeRecentColor(hex);
	if (!normalizedHex) {
		return recent as string[];
	}
	return dedupeAndCap([normalizedHex, ...recent]);
}

/**
 * The `PptxData` patch that persists a picker's current recent-colours list
 * as the deck's `p:clrMru`, ready to pass through as (or merge into)
 * `presentationProperties` on the next `save()`. Stored in the same
 * most-recent-first order {@link seedRecentColors} reads back.
 */
export function mruColorsPatch(recent: readonly string[]): Pick<PptxData, 'mruColors'> {
	const normalized: string[] = [];
	for (const color of recent) {
		const valid = normalizeRecentColor(color);
		if (valid) {
			normalized.push(valid);
		}
	}
	return { mruColors: dedupeAndCap(normalized) };
}
