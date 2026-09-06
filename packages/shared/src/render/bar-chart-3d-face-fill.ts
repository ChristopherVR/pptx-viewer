/**
 * bar-chart-3d-face-fill.ts: pure (no `three` import) resolution of which
 * `THREE.BoxGeometry`/`THREE.CylinderGeometry`/`THREE.ConeGeometry`
 * material-group of an interactive bar3D mesh should paint a
 * `c:pictureOptions` picture fill vs. a plain/derived colour.
 *
 * Mirrors the flat SVG oblique-projection bar3D renderer's own face-targeting
 * decision (`chart-datapoint-style.ts`'s `resolveActiveDataPointPicture` /
 * `resolveBarFaceTargets` / `resolveDataPointPictureFill`,
 * `chart-bar3d-face-picture.ts`'s `resolveUntargetedBarFaceFill`), so the
 * true-3D scene and its 2D fallback always agree on WHICH face gets a
 * picture. Split out of `bar-chart-3d-materials.ts` (which turns this
 * module's descriptors into actual `THREE.Material`/texture objects) so the
 * face-targeting DECISION - pure data in, pure data out - is unit-testable
 * with no `three` mock at all (CLAUDE.md Rule 2's "pure decision function"
 * shape).
 *
 * Scope: a `box`-shaped bar gets full front/side/end targeting
 * ({@link resolveBarBoxFaceFills}). A round shape (cylinder/cone/pyramid/
 * coneToMax/pyramidToMax) has no separate "front" PowerPoint's
 * `applyToFront` can target - there is one continuous lateral surface, not
 * six rectangular faces - so {@link resolveBarRoundFaceFills} maps
 * `applyToSides` onto that whole lateral surface and `applyToEnd` onto the
 * top cap, following `CylinderGeometry`/`ConeGeometry`'s own material-group
 * order (group 0 = lateral "torso", group 1 = top cap, group 2 = bottom cap;
 * see three.js's own `CylinderGeometry` source). A full cone/pyramid has no
 * top cap at all (its top radius is 0, so three never generates that group),
 * so `applyToEnd` simply has nothing to paint there, matching there being no
 * visible "end" surface on a shape that comes to a point.
 *
 * @module bar-chart-3d-face-fill
 */
import type { BarChart3DBox } from './bar-chart-3d-layout';
import { resolveUntargetedBarFaceFill } from './chart-bar3d-face-picture';
import type { ChartSeriesLike } from './chart-datapoint-style';
import {
	resolveActiveDataPointPicture,
	resolveDataPointPictureFill,
} from './chart-datapoint-style';

/** One face-group's resolved fill: a plain colour, or a picture with texture-repeat maths already resolved. */
export type BarBoxFaceFill =
	| { kind: 'color'; color: string }
	| { kind: 'picture'; imageUrl: string; repeatX: number; repeatY: number };

/** The six `BoxGeometry` face-group fills, in three.js's own material-array order (`+x,-x,+y,-y,+z,-z`). */
export interface BarBoxFaceFills {
	posX: BarBoxFaceFill;
	negX: BarBoxFaceFill;
	posY: BarBoxFaceFill;
	negY: BarBoxFaceFill;
	posZ: BarBoxFaceFill;
	negZ: BarBoxFaceFill;
}

/**
 * A round bar shape's three `CylinderGeometry`/`ConeGeometry` material-group
 * fills, in three's own `materialIndex` order (0 = lateral surface, 1 = top
 * cap, 2 = bottom cap - see this module's doc comment).
 */
export interface BarRoundFaceFills {
	side: BarBoxFaceFill;
	end: BarBoxFaceFill;
	bottom: BarBoxFaceFill;
}

function colorFace(color: string): BarBoxFaceFill {
	return { kind: 'color', color };
}

/**
 * World-space height one unit of the plotted VALUE spans for this specific
 * box, derived from the box's own already-resolved `size`/`value` (both set
 * by `layoutBarChart3D` from the SAME linear value-axis scale every box in
 * the chart shares). This needs no container/camera measurement at all: unlike
 * a screen-pixel height, `box.size`/`box.value` are fixed the moment the chart
 * is laid out and never change as the user orbits or zooms the scene.
 *
 * `undefined` when `box.value` is `0` (nothing to anchor a "one value unit"
 * height to); the caller falls back to a single tile. Note this is a
 * per-box approximation, not an exact axis-scale lookup: `layoutBarChart3D`
 * clamps a very small bar to a minimum visible height and a non-zero-based
 * value range offsets `box.value`, so the ratio can drift slightly from the
 * chart's true value-per-world-unit scale in those edge cases - the same
 * spirit of "closest available approximation" as this renderer's other
 * documented 3-D-scene gaps (see `chart-bar3d-face-picture.ts`'s module doc).
 */
function worldHeightPerValueUnit(box: Pick<BarChart3DBox, 'size' | 'value'>): number | undefined {
	return box.value !== 0 ? box.size[1] / box.value : undefined;
}

/**
 * Repeat count (>=1 tile) for `stack`/`stackScale` along one face axis;
 * always `1` for `stretch`. `pictureStackUnit` (`c:pictureStackUnit`) is
 * interpreted here as a VALUE-axis quantity (one tile per that many data
 * units, matching the OOXML spec's own "units per picture" semantics): the
 * number of tiles that exactly fit a box of value `box.value` is then
 * `box.value / pictureStackUnit`, which is exactly what falls out of
 * `faceWorldSize / (pictureStackUnit * worldHeightPerValueUnit(box))` when
 * `faceWorldSize` is `box.size[1]` (see {@link worldHeightPerValueUnit}).
 */
function faceRepeat(
	format: 'stretch' | 'stack' | 'stackScale',
	pictureStackUnit: number | undefined,
	faceWorldSize: number,
	box: Pick<BarChart3DBox, 'size' | 'value'>,
): number {
	if (format === 'stretch' || pictureStackUnit === undefined || pictureStackUnit <= 0) {
		return 1;
	}
	const perValueUnit = worldHeightPerValueUnit(box);
	if (!perValueUnit) {
		return 1;
	}
	const tileWorldSize = pictureStackUnit * perValueUnit;
	return tileWorldSize > 0 ? Math.max(1, faceWorldSize / tileWorldSize) : 1;
}

/** Build the picture-or-colour fill for one named face, resolving its repeat maths from `faceWorldSize`. */
function resolveTargetedFace(
	series: ChartSeriesLike,
	box: Pick<BarChart3DBox, 'categoryIndex' | 'seriesIndex' | 'color' | 'size' | 'value'>,
	face: 'front' | 'side' | 'end',
	faceWorldSize: number,
	untargetedFallback: string,
): BarBoxFaceFill {
	const resolved = resolveDataPointPictureFill(series, box.categoryIndex, box.seriesIndex, face);
	if (!resolved) {
		return colorFace(untargetedFallback);
	}
	const pictureStackUnit = resolveActiveDataPointPicture(
		series,
		box.categoryIndex,
	)?.pictureStackUnit;
	return {
		kind: 'picture',
		imageUrl: resolved.imageUrl,
		repeatX: 1,
		repeatY: faceRepeat(resolved.format, pictureStackUnit, faceWorldSize, box),
	};
}

/** `true` (and the shared colour) only when every given face resolved to the SAME plain colour. */
function allSameColor(fills: readonly BarBoxFaceFill[]): string | undefined {
	const first = fills[0];
	if (!first || first.kind !== 'color') {
		return undefined;
	}
	return fills.every((fill) => fill.kind === 'color' && fill.color === first.color)
		? first.color
		: undefined;
}

/**
 * Resolve one box's six `BoxGeometry` face fills.
 *
 * Returns all six as the box's plain, unmodified colour (no derived tint or
 * shade: the caller relies on real per-face Phong lighting for the 3-D look,
 * unlike the flat SVG renderer's manual shading) when the box is not a `box`
 * shape, or has no picture fill resolved at all - i.e. the pre-existing,
 * unchanged appearance for the overwhelming majority of bar3D charts that
 * never author `c:pictureOptions`.
 *
 * Once a point (or its series) has ANY picture fill configured, this mirrors
 * the flat SVG renderer's own per-face treatment: `front` keeps the plain
 * resolved colour when untargeted (never tinted, matching
 * `chart-datapoint-picture-fills.ts`'s front-face fallback); `side`/`end`
 * fall back to {@link resolveUntargetedBarFaceFill}'s shade/tint when
 * untargeted, matching the SVG oblique-projection renderer's own fallback for
 * those two faces (`chart-3d-depth.ts`). `back` (`-z`) and `bottom` (`-y`)
 * are never modelled by PowerPoint's `applyToFront`/`applyToSides`/
 * `applyToEnd` (they are never visible: bottom sits on the floor, back faces
 * away from the scene's default camera), so they always keep the box's plain
 * resolved colour.
 */
export function resolveBarBoxFaceFills(
	box: Pick<BarChart3DBox, 'seriesIndex' | 'categoryIndex' | 'color' | 'shape' | 'size' | 'value'>,
	series: ReadonlyArray<ChartSeriesLike>,
): BarBoxFaceFills {
	const plain: BarBoxFaceFills = {
		posX: colorFace(box.color),
		negX: colorFace(box.color),
		posY: colorFace(box.color),
		negY: colorFace(box.color),
		posZ: colorFace(box.color),
		negZ: colorFace(box.color),
	};
	if (box.shape !== undefined && box.shape !== 'box') {
		return plain;
	}
	const seriesData = series[box.seriesIndex];
	if (!seriesData) {
		return plain;
	}
	const active = resolveActiveDataPointPicture(seriesData, box.categoryIndex);
	if (!active?.imageUrl) {
		return plain;
	}

	const [, height, depth] = box.size;
	const frontFill = resolveTargetedFace(seriesData, box, 'front', height, box.color);
	const sideFill = resolveTargetedFace(
		seriesData,
		box,
		'side',
		height,
		resolveUntargetedBarFaceFill('side', box.color),
	);
	const endFill = resolveTargetedFace(
		seriesData,
		box,
		'end',
		depth,
		resolveUntargetedBarFaceFill('end', box.color),
	);

	return {
		posX: sideFill,
		negX: sideFill,
		posY: endFill,
		negY: colorFace(box.color),
		posZ: frontFill,
		negZ: colorFace(box.color),
	};
}

/**
 * Resolve one round bar's (cylinder/cone/pyramid/coneToMax/pyramidToMax)
 * three material-group fills: `side` (the lateral surface, `applyToSides`),
 * `end` (the top cap, `applyToEnd`) and `bottom` (never targeted by
 * PowerPoint, like a box's `-Y`; always the plain resolved colour). Returns
 * all three plain when the shape has no picture fill resolved at all, same
 * fast path as {@link resolveBarBoxFaceFills}.
 */
export function resolveBarRoundFaceFills(
	box: Pick<BarChart3DBox, 'seriesIndex' | 'categoryIndex' | 'color' | 'size' | 'value'>,
	series: ReadonlyArray<ChartSeriesLike>,
): BarRoundFaceFills {
	const plain: BarRoundFaceFills = {
		side: colorFace(box.color),
		end: colorFace(box.color),
		bottom: colorFace(box.color),
	};
	const seriesData = series[box.seriesIndex];
	if (!seriesData) {
		return plain;
	}
	const active = resolveActiveDataPointPicture(seriesData, box.categoryIndex);
	if (!active?.imageUrl) {
		return plain;
	}

	const [, height, depth] = box.size;
	const sideFill = resolveTargetedFace(
		seriesData,
		box,
		'side',
		height,
		resolveUntargetedBarFaceFill('side', box.color),
	);
	const endFill = resolveTargetedFace(
		seriesData,
		box,
		'end',
		depth,
		resolveUntargetedBarFaceFill('end', box.color),
	);

	return { side: sideFill, end: endFill, bottom: colorFace(box.color) };
}

/** `true` (and the shared colour) when a resolved {@link BarBoxFaceFills} is uniform across all six faces. */
export function uniformBoxColor(fills: BarBoxFaceFills): string | undefined {
	return allSameColor([fills.posX, fills.negX, fills.posY, fills.negY, fills.posZ, fills.negZ]);
}

/** `true` (and the shared colour) when a resolved {@link BarRoundFaceFills} is uniform across all three material groups. */
export function uniformRoundColor(fills: BarRoundFaceFills): string | undefined {
	return allSameColor([fills.side, fills.end, fills.bottom]);
}
