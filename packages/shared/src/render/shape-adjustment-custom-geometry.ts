/**
 * `shape-adjustment-custom-geometry`: PowerPoint's `a:ahLst` adjust handles
 * for a `a:custGeom` (freeform) shape, the counterpart to
 * `shape-adjustment-handles.ts`'s preset-only derivation (G3 of the D3
 * geometry audit: `ahXY`/`ahPolar` were parsed and round-tripped but the
 * on-canvas drag system only ever looked at `PresetShapeGeometryDefinition`).
 *
 * ## Why this can't reuse the preset "probe the geometry" trick
 *
 * `shape-adjustment-handles.ts` measures a preset handle by nudging a guide
 * and finding which PATH VERTEX moved (`dominantDisplacement`), because
 * `presetShapeDefinitions.xml` never spells out `a:ahLst` explicitly for this
 * repo to transcribe. A custom geometry does not have that problem: its own
 * `a:ahXY`/`a:ahPolar` already declares its handle's position (`a:pos`) as a
 * formula, so the position is evaluated directly rather than searched for.
 * What IS unknown is the handle's drag scale (px moved per unit of guide
 * value), so that part still uses the same finite-difference probe: evaluate
 * `pos` once at the guide's current value and once a hair away, exactly as
 * `computeHandles` does for a preset `adj`.
 *
 * ## Coordinate space
 *
 * `a:pos`/`a:min*`/`a:max*` formulas are expressed in the custom geometry's
 * OWN path coordinate space (`customGeometryPaths[].width/height`, from
 * `a:pathLst/@w`/`@h`), not necessarily the element's pixel box - the same
 * space `connector-sites.ts` scales `a:cxn` positions out of. Every handle
 * here is scaled the same way.
 *
 * ## Angular handles: a documented approximation
 *
 * `a:ahPolar`'s `gdRefAng` guide is swung with the same `kind: 'angular'`
 * primitive `shape-adjustment-solver.ts` already has for a preset `pie`/`arc`,
 * pivoting on the ELEMENT's own centre. That is exactly right when the
 * geometry's `pos` formula is itself `centre + r*cos/sin(ang)` (the
 * conventional way `a:ahPolar` is authored), but is not derived from the
 * geometry the way the preset probe is - an arbitrary custom geometry could
 * author its own off-centre pivot, which this does not detect.
 *
 * @module render/shape-adjustment-custom-geometry
 */
import { resolveCustomGeometryGuideContext, resolveCustomGeometryToken } from 'pptx-viewer-core';
import type {
	AdjustHandlePolar,
	AdjustHandleXY,
	CustomGeometryRawData,
	PptxElement,
} from 'pptx-viewer-core';

import { mergeCoincidentHandles } from './shape-adjustment-model';
import type {
	AdjustmentAxisSolver,
	DerivedAdjustmentHandle,
	ShapeAdjustmentSolver,
} from './shape-adjustment-model';
import { ANGLE_UNITS_PER_TURN } from './shape-adjustment-probe';

/** Structural view of the custom-geometry fields a handle is derived from. */
interface CustomGeometryAdjustFields {
	customGeometryAdjustHandlesXY?: AdjustHandleXY[];
	customGeometryAdjustHandlesPolar?: AdjustHandlePolar[];
	customGeometryRawData?: CustomGeometryRawData;
	pathWidth?: number;
	pathHeight?: number;
	shapeAdjustments?: Record<string, number>;
}

/** Fallback clamp for a `gdRef` axis with no authored `min*`/`max*`. */
const UNBOUNDED_CARTESIAN = 1000000;

/** A hair of `[min, max]`, signed away from whichever bound `value` sits on. */
function probeStep(value: number, min: number, max: number): number {
	const span = Math.max(Math.abs(max - min), 1);
	const magnitude = Math.max(span * 1e-4, 1e-3);
	return value + magnitude > max ? -magnitude : magnitude;
}

/** Evaluate `posX`/`posY` (path-space) into element-local px. */
function evaluatePosition(
	pos: { posX?: string; posY?: string },
	vars: Map<string, number>,
	scaleX: number,
	scaleY: number,
): { x: number; y: number } {
	return {
		x: resolveCustomGeometryToken(pos.posX, vars, 0) * scaleX,
		y: resolveCustomGeometryToken(pos.posY, vars, 0) * scaleY,
	};
}

/** Context every axis-solver builder needs, threaded through unchanged. */
interface BuildContext {
	rawData: CustomGeometryRawData | undefined;
	pathW: number;
	pathH: number;
	overrides: Record<string, number>;
	scaleX: number;
	scaleY: number;
}

/**
 * A LINEAR axis solver for one `gdRef` guide: probes how far `pos` moves per
 * unit of that guide (holding every other guide at its current value), the
 * same finite-difference technique `shape-adjustment-handles.ts` uses for a
 * preset `adj`. Returns `null` when the guide moves nothing (a mis-authored
 * or already-pinned handle).
 */
function buildLinearAxis(
	gdRef: string,
	pos: { posX?: string; posY?: string },
	minToken: string | undefined,
	maxToken: string | undefined,
	anchor: { x: number; y: number },
	vars: Map<string, number>,
	ctx: BuildContext,
): ShapeAdjustmentSolver | null {
	const value = vars.get(gdRef) ?? 0;
	const min = resolveCustomGeometryToken(minToken, vars, -UNBOUNDED_CARTESIAN);
	const max = resolveCustomGeometryToken(maxToken, vars, UNBOUNDED_CARTESIAN);
	const step = probeStep(value, min, max);
	const probeVars = resolveCustomGeometryGuideContext(ctx.rawData, ctx.pathW, ctx.pathH, {
		...ctx.overrides,
		[gdRef]: value + step,
	});
	const probe = evaluatePosition(pos, probeVars, ctx.scaleX, ctx.scaleY);
	const dirX = (probe.x - anchor.x) / step;
	const dirY = (probe.y - anchor.y) / step;
	if (dirX === 0 && dirY === 0) {
		return null;
	}
	return {
		kind: 'linear',
		anchorX: anchor.x,
		anchorY: anchor.y,
		dirX,
		dirY,
		centerX: anchor.x,
		centerY: anchor.y,
		startValue: value,
		min,
		max,
	};
}

/** The cursor for a handle whose only travel is along one cartesian axis. */
function axisCursor(solver: ShapeAdjustmentSolver): string {
	return Math.abs(solver.dirX) >= Math.abs(solver.dirY) ? 'ew-resize' : 'ns-resize';
}

function buildXyHandle(
	handle: AdjustHandleXY,
	vars: Map<string, number>,
	ctx: BuildContext,
): DerivedAdjustmentHandle | null {
	const anchor = evaluatePosition(handle, vars, ctx.scaleX, ctx.scaleY);
	const solvers: AdjustmentAxisSolver[] = [];
	if (handle.gdRefX) {
		const solver = buildLinearAxis(
			handle.gdRefX,
			handle,
			handle.minX,
			handle.maxX,
			anchor,
			vars,
			ctx,
		);
		if (solver) {
			solvers.push({ key: handle.gdRefX, solver });
		}
	}
	if (handle.gdRefY) {
		const solver = buildLinearAxis(
			handle.gdRefY,
			handle,
			handle.minY,
			handle.maxY,
			anchor,
			vars,
			ctx,
		);
		if (solver) {
			solvers.push({ key: handle.gdRefY, solver });
		}
	}
	if (solvers.length === 0) {
		return null;
	}
	return {
		key: solvers[0].key,
		x: anchor.x,
		y: anchor.y,
		value: vars.get(solvers[0].key) ?? 0,
		cursor: solvers.length > 1 ? 'move' : axisCursor(solvers[0].solver),
		solvers,
	};
}

function buildPolarHandle(
	handle: AdjustHandlePolar,
	vars: Map<string, number>,
	elementCenter: { x: number; y: number },
	ctx: BuildContext,
): DerivedAdjustmentHandle | null {
	const anchor = evaluatePosition(handle, vars, ctx.scaleX, ctx.scaleY);
	const solvers: AdjustmentAxisSolver[] = [];
	if (handle.gdRefR) {
		const solver = buildLinearAxis(
			handle.gdRefR,
			handle,
			handle.minR,
			handle.maxR,
			anchor,
			vars,
			ctx,
		);
		if (solver) {
			solvers.push({ key: handle.gdRefR, solver });
		}
	}
	if (handle.gdRefAng) {
		const value = vars.get(handle.gdRefAng) ?? 0;
		const min = resolveCustomGeometryToken(handle.minAng, vars, 0);
		const max = resolveCustomGeometryToken(handle.maxAng, vars, ANGLE_UNITS_PER_TURN);
		solvers.push({
			key: handle.gdRefAng,
			solver: {
				kind: 'angular',
				anchorX: anchor.x,
				anchorY: anchor.y,
				dirX: 0,
				dirY: 0,
				centerX: elementCenter.x,
				centerY: elementCenter.y,
				startValue: value,
				min,
				max,
			},
		});
	}
	if (solvers.length === 0) {
		return null;
	}
	return {
		key: solvers[0].key,
		x: anchor.x,
		y: anchor.y,
		value: vars.get(solvers[0].key) ?? 0,
		cursor:
			solvers.length > 1
				? 'move'
				: solvers[0].solver.kind === 'angular'
					? 'crosshair'
					: axisCursor(solvers[0].solver),
		solvers,
	};
}

/**
 * Every adjust handle a `a:custGeom` shape's own `a:ahLst` declares, derived
 * by evaluating each `a:ahXY`/`a:ahPolar` against the geometry's `a:avLst`/
 * `a:gdLst` (overridden by any in-progress `shapeAdjustments` patch, so a
 * drag repositions the handle live) and probing its drag scale.
 *
 * Empty for a shape with no `a:ahLst`, or one whose `customGeometryRawData`
 * did not survive parse (nothing to evaluate `a:gdLst` against).
 */
export function deriveCustomGeometryAdjustmentHandles(
	element: PptxElement,
): DerivedAdjustmentHandle[] {
	const el = element as PptxElement & CustomGeometryAdjustFields;
	const xy = el.customGeometryAdjustHandlesXY ?? [];
	const polar = el.customGeometryAdjustHandlesPolar ?? [];
	if (xy.length === 0 && polar.length === 0) {
		return [];
	}
	const pathW = el.pathWidth && el.pathWidth > 0 ? el.pathWidth : element.width;
	const pathH = el.pathHeight && el.pathHeight > 0 ? el.pathHeight : element.height;
	if (!(pathW > 0) || !(pathH > 0) || !(element.width > 0) || !(element.height > 0)) {
		return [];
	}
	const ctx: BuildContext = {
		rawData: el.customGeometryRawData,
		pathW,
		pathH,
		overrides: el.shapeAdjustments ?? {},
		scaleX: element.width / pathW,
		scaleY: element.height / pathH,
	};
	const vars = resolveCustomGeometryGuideContext(ctx.rawData, pathW, pathH, ctx.overrides);
	const elementCenter = { x: element.width / 2, y: element.height / 2 };

	const handles: DerivedAdjustmentHandle[] = [];
	for (const handle of xy) {
		const built = buildXyHandle(handle, vars, ctx);
		if (built) {
			handles.push(built);
		}
	}
	for (const handle of polar) {
		const built = buildPolarHandle(handle, vars, elementCenter, ctx);
		if (built) {
			handles.push(built);
		}
	}
	return mergeCoincidentHandles(handles);
}
