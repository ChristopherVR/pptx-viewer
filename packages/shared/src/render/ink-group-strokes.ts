/**
 * Framework-neutral view model for a Draw-tab `InkPptxElement`'s own strokes.
 *
 * Mirrors `content-part-strokes.ts` (the same decision for a loaded
 * `p:contentPart`), but reads an `InkPptxElement`'s parallel per-path arrays
 * (`inkPaths`/`inkColors`/`inkWidths`/`inkOpacities`/`inkPointPressures`/
 * `inkPointTiltX`/`inkPointTiltY`) instead of a `ContentPartInkStroke[]`.
 *
 * Every binding used to hand-roll this exact pressure-circle decision (with
 * two subtly different legacy-fallback conditions: `inkWidths.length > 1` in
 * React/Angular vs. the more correct `inkWidths.length > el.inkPaths.length`
 * in Vue/Svelte/vanilla, since a per-PATH widths array of length 2 on a
 * 3-path stroke is not per-POINT legacy data), and none of them rendered a
 * tilt-driven calligraphic nib for this element type at all (only the loaded
 * `contentPart` path had it). One decision function closes both gaps for all
 * five bindings at once.
 *
 * @module render/ink-group-strokes
 */
import type { InkPptxElement } from 'pptx-viewer-core';

import { resolveInkOpacity } from './ink-rendering';
import type { InkStrokeView } from './ink-stroke-view';
import { buildInkStrokeView } from './ink-stroke-view';
import { tiltChannelsFromVectors } from './ink-tilt-nib';

/** One rendered ink-group stroke, keyed for list rendering. */
export interface InkGroupStrokeView extends InkStrokeView {
	key: string;
}

/** Per-binding fallback defaults for an ink path missing a colour/width entry. */
export interface InkGroupStrokeDefaults {
	color: string;
	width: number;
}

/** SVG `viewBox` for the ink element's bounding box (min 1x1). */
export function inkGroupViewBox(element: InkPptxElement): string {
	return `0 0 ${Math.max(element.width, 1)} ${Math.max(element.height, 1)}`;
}

/** Project an `InkPptxElement`'s parallel arrays into per-stroke view models. */
export function buildInkGroupStrokes(
	element: InkPptxElement,
	defaults: InkGroupStrokeDefaults,
): InkGroupStrokeView[] {
	const paths = element.inkPaths ?? [];
	return paths.map((path, i) => {
		const color = element.inkColors?.[i] ?? defaults.color;
		const width = element.inkWidths?.[i] ?? defaults.width;
		const opacity = resolveInkOpacity(element.inkOpacities, i);
		const pressures = element.inkPointPressures?.[i];
		// Legacy fallback: treat `inkWidths` as per-point widths only when it
		// carries more entries than there are paths, so a normal per-path
		// widths array is never mistaken for per-point legacy data.
		const legacyPointWidths =
			element.inkWidths && element.inkWidths.length > paths.length ? element.inkWidths : undefined;
		const tilt = tiltChannelsFromVectors(
			element.inkPointTiltX?.[i] ?? [],
			element.inkPointTiltY?.[i] ?? [],
		);
		return {
			key: `stroke${i}`,
			...buildInkStrokeView({
				path,
				color,
				width,
				opacity,
				pressures,
				legacyPointWidths,
				tiltAngles: tilt?.angles,
				tiltMagnitudes: tilt?.magnitudes,
			}),
		};
	});
}
