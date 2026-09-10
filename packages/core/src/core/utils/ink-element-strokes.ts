/**
 * `InkPptxElement` -> `ContentPartInkStroke[]`: the pure conversion shared by
 * the OOXML content-part writer (`PptxHandlerRuntimeSaveContentPartInk.ts`)
 * and the legacy binary `.ppt` writer's ink round-trip package
 * (`ppt/writer/ink-roundtrip-writer.ts`), so both save paths build the exact
 * same stroke list from the same in-memory element.
 *
 * @module ink-element-strokes
 */

import type { ContentPartInkStroke, InkPptxElement } from '../types';
import { tiltChannelsFromXY } from './inkml-trace-decode';

/**
 * Convert one path's raw per-point `tiltX`/`tiltY` (degrees, from
 * `PointerEvent.tiltX`/`tiltY`) into the `{angles, magnitudes}` shape
 * `ContentPartInkStroke` (and the InkML writer's `OTx`/`OTy` authoring) both
 * expect, or `undefined` when the path has no tilt data at all.
 */
function tiltChannelsForPath(
	el: InkPptxElement,
	index: number,
): { tiltAngles: number[]; tiltMagnitudes: number[] } | undefined {
	const tiltX = el.inkPointTiltX?.[index];
	const tiltY = el.inkPointTiltY?.[index];
	if (!tiltX?.length || !tiltY?.length) {
		return undefined;
	}
	const tilt = tiltChannelsFromXY(tiltX, tiltY);
	return tilt ? { tiltAngles: tilt.angles, tiltMagnitudes: tilt.magnitudes } : undefined;
}

/**
 * Build the `ContentPartInkStroke[]` an `InkPptxElement`'s paths decode to,
 * skipping any path with no geometry. Empty (whitespace-only or all-blank)
 * elements yield an empty array.
 */
export function inkElementToStrokes(el: InkPptxElement): ContentPartInkStroke[] {
	return el.inkPaths.flatMap((path, index) => {
		if (!path.trim()) {
			return [];
		}
		const width = el.inkWidths?.[index] ?? 2;
		const opacity = el.inkOpacities?.[index] ?? 1;
		return [
			{
				path,
				color: el.inkColors?.[index] ?? '#000000',
				width: Number.isFinite(width) && width > 0 ? width : 2,
				opacity: Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1,
				...(el.inkPointPressures?.[index]?.length
					? { pressures: el.inkPointPressures[index] }
					: {}),
				...(tiltChannelsForPath(el, index) ?? {}),
			},
		];
	});
}
