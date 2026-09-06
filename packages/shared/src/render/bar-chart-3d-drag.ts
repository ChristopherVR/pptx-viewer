import type { BarChart3DHit } from './bar-chart-3d-hit-test';
import type { BarChart3DBox } from './bar-chart-3d-layout';
/**
 * Value-drag calibration for a bar3D box mesh: two world points, at two
 * distinct data values, on the box's own value axis. Feeds
 * {@link Chart3DDragCalibrationInput} to `chart-3d-pointer-interaction.ts`.
 *
 * Uses the box's OWN plain layout data (`center`/`size`, from
 * `bar-chart-3d-layout.ts`) rather than reading state back off a `THREE.Mesh`,
 * so the maths is exact regardless of camera orbit and needs no `three`
 * import: `layoutClustered` always sits a box's base at world value-zero and
 * its opposite face at the box's own value (see that module's `bottom`/`top`
 * construction), so `center +/- size/2` along the value axis IS the (0, value)
 * pair, for every value's sign, with no separate range lookup needed.
 *
 * Only `grouping === 'clustered'` boxes have this "spans from zero" shape: a
 * stacked/percentStacked box spans a running-sum SEGMENT, so it is
 * deliberately excluded (returns `null`) rather than dragging a value that
 * would not track the pointer.
 *
 * @module bar-chart-3d-drag
 */
import type { Chart3DDragCalibrationInput } from './chart-3d-pointer-interaction';

/** World-space axis index the value axis occupies: Y normally, X for a horizontal (`c:barDir val="bar"`) chart. */
function valueAxisIndex(horizontal: boolean): 0 | 1 {
	return horizontal ? 0 : 1;
}

/**
 * Calibrate a value drag for the box a raycast hit landed on, or `null` when
 * the chart's grouping has no per-box "spans from zero" shape, the matching
 * box cannot be found, or the box has (near) zero extent along the value axis.
 */
export function calibrateBarChart3DDrag(
	boxes: ReadonlyArray<BarChart3DBox>,
	hit: BarChart3DHit,
	grouping: 'clustered' | 'stacked' | 'percentStacked',
	horizontal: boolean,
): Chart3DDragCalibrationInput | null {
	if (grouping !== 'clustered') {
		return null;
	}
	const box = boxes.find(
		(b) => b.seriesIndex === hit.seriesIndex && b.categoryIndex === hit.categoryIndex,
	);
	if (!box) {
		return null;
	}
	const axis = valueAxisIndex(horizontal);
	const half = box.size[axis] / 2;
	const center = box.center[axis];
	const lo = center - half;
	const hi = center + half;
	// One of the two faces sits at world value-zero (see module doc); the
	// closer-to-zero extreme is that face, the other is the box's own value.
	const zeroIsLo = Math.abs(lo) <= Math.abs(hi);
	const zeroCoord = zeroIsLo ? lo : hi;
	const valueCoord = zeroIsLo ? hi : lo;
	if (Math.abs(valueCoord - zeroCoord) < 1e-9) {
		return null;
	}
	const at = (coord: number): readonly [number, number, number] =>
		axis === 0 ? [coord, box.center[1], box.center[2]] : [box.center[0], coord, box.center[2]];
	return {
		worldAtValue0: at(zeroCoord),
		value0: 0,
		worldAtValue1: at(valueCoord),
		value1: hit.value,
	};
}
