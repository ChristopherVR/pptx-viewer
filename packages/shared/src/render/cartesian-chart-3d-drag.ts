/**
 * Value-drag calibration for a line3D/area3D data-point marker: the marker
 * mesh sits exactly AT its data point's world position (see
 * `line-chart-3d-scene.ts`/`area-chart-3d-scene.ts`, `marker.position.set(...
 * v.position)`), and both scenes plot from a world value-zero plane (the grid
 * floor sits at world Y 0, `gridFloor.position.y = -0.02`), so the marker's
 * own position IS the (value) point and its floor projection (same X/Z,
 * value-axis coordinate zeroed) IS the (0) point - no separate box geometry
 * to consult, unlike bar3D (see `bar-chart-3d-drag.ts`).
 *
 * Feeds {@link Chart3DDragCalibrationInput} to
 * `chart-3d-pointer-interaction.ts`.
 *
 * @module cartesian-chart-3d-drag
 */
import type { Chart3DDragCalibrationInput } from './chart-3d-pointer-interaction';

/**
 * Calibrate a value drag for one line3D/area3D marker, given its world
 * position (value axis = world Y) and its own data value. Returns `null` when
 * the value is (near) zero: the marker then sits on the floor itself, so the
 * two calibration points would coincide and no direction could be recovered.
 */
export function calibrateCartesianChart3DDrag(
	markerPosition: readonly [number, number, number],
	value: number,
): Chart3DDragCalibrationInput | null {
	if (Math.abs(value) < 1e-9) {
		return null;
	}
	return {
		worldAtValue0: [markerPosition[0], 0, markerPosition[2]],
		value0: 0,
		worldAtValue1: markerPosition,
		value1: value,
	};
}
