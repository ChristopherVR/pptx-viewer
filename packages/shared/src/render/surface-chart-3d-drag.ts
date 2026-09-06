/**
 * Value-drag calibration for a selected surface3D grid vertex.
 *
 * Unlike line3D/area3D (`cartesian-chart-3d-drag.ts`), whose value axis maps
 * world Y 0 to a raw value of exactly 0, a surface's heightMap normalises
 * each cell to `[0, 1]` relative to the WHOLE grid's `[min, max]` value
 * range (`buildSurfaceChart3DData`: `t = (val - range.min) / range.span`),
 * so a vertex's own world Y 0 corresponds to the grid's MINIMUM value, not
 * zero (and world Y `MAX_HEIGHT` to its maximum). Reusing
 * `calibrateCartesianChart3DDrag`'s "Y 0 means value 0" assumption here
 * would silently miscalibrate every drag's speed, and for a vertex already
 * sitting at the grid's minimum, collapse both calibration points onto the
 * same screen position (world Y 0 would then represent BOTH the assumed
 * value-0 reference and the vertex's own current value), making the drag
 * fail outright for exactly the cells most likely to be dragged upward.
 *
 * Feeds {@link Chart3DDragCalibrationInput} to
 * `chart-3d-pointer-interaction.ts`, the SAME contract
 * `calibrateCartesianChart3DDrag`/`calibrateBarChart3DDrag` feed.
 *
 * @module surface-chart-3d-drag
 */
import type { Chart3DDragCalibrationInput } from './chart-3d-pointer-interaction';
import { MAX_HEIGHT } from './surface-chart-3d-geom';

/**
 * Calibrate a value drag for one surface3D vertex, given its own (already
 * height-displaced) world position, its raw value, and every raw value in the
 * grid (to recover the `[min, max]` the heightMap normalised against; the
 * scene already holds this flat array for the hover tooltip, so no extra data
 * needs threading through). Returns `null` when every cell shares the same
 * value: there is then no vertical axis to calibrate a drag against.
 */
export function calibrateSurfaceChart3DDrag(
	position: readonly [number, number, number],
	value: number,
	values: Float32Array,
): Chart3DDragCalibrationInput | null {
	let min = Infinity;
	let max = -Infinity;
	for (const v of values) {
		if (v < min) {
			min = v;
		}
		if (v > max) {
			max = v;
		}
	}
	if (!(max > min)) {
		return null;
	}
	// A reference point at a DIFFERENT value on the SAME vertical column
	// (fixed x/z), exact by construction: world Y 0 <-> the grid minimum,
	// world Y MAX_HEIGHT <-> the grid maximum. Use whichever end differs from
	// this vertex's own value (a vertex already at the minimum needs the
	// maximum as its reference, and vice versa).
	const [x, , z] = position;
	const atMin = value === min;
	return {
		worldAtValue0: [x, atMin ? MAX_HEIGHT : 0, z],
		value0: atMin ? max : min,
		worldAtValue1: position,
		value1: value,
	};
}
