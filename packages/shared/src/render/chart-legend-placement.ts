/**
 * chart-legend-placement.ts: `c:legendPos` -> layout behaviour, shared by
 * every chart-type builder's plot-area reservation and legend positioning.
 *
 * `ST_LegendPos` has five values: `b`/`t`/`l`/`r` reserve a band of plot-area
 * space on that side, but `tr` (top-right corner) is an OVERLAY per
 * PowerPoint's own quick-layout behaviour: it floats over the plot rather
 * than reserving space anywhere. Every legend-placement branch across the
 * shared chart engine used to test only `'b'`/`'t'`/`'r'`/`'l'`, so a `tr`
 * legend fell through every branch: no space was reserved (harmless) but the
 * legend positioning code ALSO had no branch for it, so it rendered wherever
 * the untouched default (bottom-centred) put it instead of the top-right
 * corner.
 *
 * No dependencies: kept separate from `chart-legend-layout.ts` (which needs
 * `ChartViewModel`) so every legend-placement call site, including the
 * plot-layout reservation code that runs before a `ChartViewModel` exists,
 * can import this with no risk of a circular import.
 *
 * @module chart-legend-placement
 */

/** The four sides a legend can occupy; `tr`'s corner styling maps to `'r'`. */
export type LegendPlacementSide = 'b' | 't' | 'l' | 'r';

/** Resolved behaviour for one `c:legendPos` value. */
export interface LegendPlacement {
	/**
	 * The side other legend-positioning code should treat this as: `'tr'`
	 * shares its coordinate math with `'r'` (a right-aligned column starting at
	 * the top), since positioning it there already reads as "top-right corner"
	 * without inventing a fifth branch everywhere.
	 */
	side: LegendPlacementSide;
	/**
	 * `true` when the legend floats OVER the plot instead of reserving band
	 * space for itself (only `'tr'`, matching PowerPoint's own quick-layout
	 * behaviour for a top-right legend).
	 */
	overlaysPlot: boolean;
}

const KNOWN_SIDES = new Set<string>(['b', 't', 'l', 'r']);

/**
 * Resolve a `c:legendPos` value (`b`/`t`/`l`/`r`/`tr`, or absent) to its
 * placement behaviour. An unrecognised or absent value defaults to `'b'`,
 * matching every builder's pre-existing fallback.
 */
export function resolveLegendPlacement(legendPos: string | undefined): LegendPlacement {
	if (legendPos === 'tr') {
		return { side: 'r', overlaysPlot: true };
	}
	const side =
		legendPos !== undefined && KNOWN_SIDES.has(legendPos)
			? (legendPos as LegendPlacementSide)
			: 'b';
	return { side, overlaysPlot: false };
}

/** A plot rectangle in the same terms `computePlotLayout`/`computeLayout` build one in. */
export interface LegendReservationRect {
	plotLeft: number;
	plotTop: number;
	plotRight: number;
	plotBottom: number;
}

/**
 * Shrink `rect` to reserve a legend band for `legendPos`, or return it
 * unchanged for an overlay (`'tr'`) legend or one with no reservation side.
 * The single source of the `20`/`80` reservation constants every chart-type
 * builder's plot-layout function used to repeat.
 */
export function reserveLegendSpace(
	legendPos: string | undefined,
	rect: LegendReservationRect,
): LegendReservationRect {
	const placement = resolveLegendPlacement(legendPos);
	if (placement.overlaysPlot) {
		return rect;
	}
	if (placement.side === 'b') {
		return { ...rect, plotBottom: rect.plotBottom - 20 };
	}
	if (placement.side === 't') {
		return { ...rect, plotTop: rect.plotTop + 20 };
	}
	if (placement.side === 'r') {
		return { ...rect, plotRight: rect.plotRight - 80 };
	}
	if (placement.side === 'l') {
		return { ...rect, plotLeft: rect.plotLeft + 80 };
	}
	return rect;
}
