/**
 * `shape-adjustment-model`: the vocabulary the adjust-handle modules share.
 *
 * The `a:ahLst` work is split three ways for the repo's file-size budget:
 * `shape-adjustment-probe` measures the geometry, `shape-adjustment-handles`
 * derives the handles from those measurements, and `shape-adjustment-solver`
 * turns a pointer position back into guide values. All three need these types
 * and the one rule that operates purely on them, so they live here and the
 * dependency graph stays a DAG rather than a cycle.
 *
 * @module render/shape-adjustment-model
 */

/**
 * How a pointer position becomes a guide value, captured once when the gesture
 * starts so `pointermove` stays pure arithmetic.
 */
export interface ShapeAdjustmentSolver {
	/** `linear`: the handle slides. `angular`: it swings about {@link centerX}. */
	kind: 'linear' | 'angular';
	/** Handle position in element-local px at {@link startValue}. */
	anchorX: number;
	anchorY: number;
	/** Element-local px the handle travels per ONE unit of guide value. */
	dirX: number;
	dirY: number;
	/** Pivot for an angular handle (the shape centre). */
	centerX: number;
	centerY: number;
	/** The guide value the anchor was measured at. */
	startValue: number;
	/** Guide-space bounds, taken from the preset's own `pin` clamp. */
	min: number;
	max: number;
}

/** One guide a handle drives. */
export interface AdjustmentAxisSolver {
	key: string;
	solver: ShapeAdjustmentSolver;
}

/**
 * One derived handle: where it sits and which guides its drag writes.
 *
 * A handle usually drives ONE guide, but the callout family binds two to a
 * single diamond (`<ahXY gdRefX="adj2" gdRefY="adj1">`), so `solvers` is a
 * list: one drag writes the leader line's x AND y offsets, as PowerPoint does.
 */
export interface DerivedAdjustmentHandle {
	/** The primary `a:avLst` guide name (`adj`, `adj1`, ...). */
	key: string;
	/** Element-local px, origin = element top-left. */
	x: number;
	y: number;
	/** The primary guide's current value. */
	value: number;
	cursor: string;
	solvers: AdjustmentAxisSolver[];
}

/**
 * Fold two single-axis handles that landed on the SAME vertex into one
 * two-guide handle.
 *
 * The callout family declares exactly that shape (`<ahXY gdRefX="adj2"
 * gdRefY="adj1">`): one diamond on the leader-line elbow that writes an x
 * offset and a y offset. Derived independently, `adj1` and `adj2` come back as
 * two handles sitting on top of each other, only one of which the user could
 * ever grab. Only two LINEAR guides on roughly perpendicular axes are folded;
 * an angular guide keeps its own handle, because sweeping an arc and thickening
 * it are separate gestures in PowerPoint.
 */
export function mergeCoincidentHandles(
	handles: DerivedAdjustmentHandle[],
): DerivedAdjustmentHandle[] {
	const out: DerivedAdjustmentHandle[] = [];
	const consumed = new Set<number>();
	for (let i = 0; i < handles.length; i++) {
		if (consumed.has(i)) {
			continue;
		}
		const handle = handles[i];
		const primary = handle.solvers[0].solver;
		if (primary.kind !== 'linear') {
			out.push(handle);
			continue;
		}
		let merged = handle;
		for (let j = i + 1; j < handles.length; j++) {
			if (consumed.has(j)) {
				continue;
			}
			const other = handles[j];
			const secondary = other.solvers[0].solver;
			if (
				secondary.kind !== 'linear' ||
				Math.abs(other.x - handle.x) > 0.5 ||
				Math.abs(other.y - handle.y) > 0.5
			) {
				continue;
			}
			const perpendicular =
				Math.abs(primary.dirX) >= Math.abs(primary.dirY) !==
				Math.abs(secondary.dirX) >= Math.abs(secondary.dirY);
			if (!perpendicular) {
				continue;
			}
			consumed.add(j);
			merged = {
				...merged,
				cursor: 'move',
				solvers: [...merged.solvers, ...other.solvers],
			};
			break;
		}
		out.push(merged);
	}
	return out;
}
