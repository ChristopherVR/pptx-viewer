/**
 * Public API for shape boolean operations on SVG path strings and polygon
 * arrays.
 *
 * Provides {@link unionShapes}, {@link intersectShapes},
 * {@link subtractShapes}, {@link fragmentShapes}, {@link combineShapes},
 * and the dispatcher {@link mergeShapes}, plus their polygon-array and
 * SVG-path alias counterparts.
 *
 * @module geometry/shape-boolean-ops
 */

import { clipPolygons } from './shape-boolean-clipping';
import { svgPathToPolygons, polygonsToSvgPath } from './shape-boolean-svg';
import type { Vec2 } from './shape-boolean-types';
import { ensureCCW, ensureCW, polygonArea, EPSILON } from './shape-boolean-types';
import { computeUnionWalk } from './shape-boolean-union';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Subtract one convex or concave polygon from another.
 *
 * @param subject - Subject polygon.
 * @param clip - Clip polygon to subtract.
 * @returns Resulting polygon(s) after subtraction.
 */
function subtractSinglePoly(subject: Vec2[], clip: Vec2[]): Vec2[][] {
	// Compute intersection
	const intersection = clipPolygons(subject, clip);

	if (intersection.length === 0) {
		// No overlap, subject unchanged
		return [subject];
	}

	// Check if clip fully contains subject
	const interArea = intersection.reduce((sum, p) => sum + polygonArea(p), 0);
	const subjectArea = polygonArea(subject);

	if (Math.abs(interArea - subjectArea) < EPSILON * 100) {
		// Clip fully contains subject
		return [];
	}

	// Use the clip polygon (reversed) as a hole in the subject.
	// The SVG fill-rule evenodd will handle the rendering.
	// We construct this as: subject outline + reversed clip intersection.
	const results: Vec2[][] = [];

	// For each intersection polygon, create a "hole" by reversing it
	// and appending it as a separate sub-path
	results.push(subject);
	for (const inter of intersection) {
		// Reverse the intersection polygon to create a hole
		results.push(ensureCW(inter));
	}

	return results;
}

/** Convert number[][] polygon to Vec2[]. */
function toVec2(poly: number[][]): Vec2[] {
	return poly.map(([x, y]) => ({ x, y }));
}

/** Convert Vec2[] polygon to number[][]. */
function fromVec2(poly: Vec2[]): number[][] {
	return poly.map((p) => [p.x, p.y]);
}

// ---------------------------------------------------------------------------
// Public API: Boolean operations on SVG path strings
// ---------------------------------------------------------------------------

/**
 * Compute the union of two SVG path shapes.
 *
 * Merges the outer boundaries of both shapes into a single path.
 * For non-overlapping shapes, returns a multi-sub-path result.
 *
 * @param paths1 - First SVG path data string.
 * @param paths2 - Second SVG path data string.
 * @returns SVG path data string of the union.
 */
export function unionShapes(paths1: string, paths2: string): string {
	const polys1 = svgPathToPolygons(paths1);
	const polys2 = svgPathToPolygons(paths2);

	if (polys1.length === 0) {
		return paths2;
	}
	if (polys2.length === 0) {
		return paths1;
	}

	let result: Vec2[][] = [];

	// Start with all polygons from paths1
	let accumulated = polys1.map((p) => ensureCCW(p));

	// Union each polygon from paths2
	for (const poly2 of polys2) {
		const p2 = ensureCCW(poly2);
		const newAccumulated: Vec2[][] = [];
		let merged = false;

		for (const p1 of accumulated) {
			if (!merged) {
				const unionResult = computeUnionWalk(p1, p2);
				if (unionResult.length === 1) {
					// Successfully merged into one polygon
					newAccumulated.push(unionResult[0]);
					merged = true;
				} else if (unionResult.length === 2) {
					// Disjoint: keep both separate for now
					newAccumulated.push(p1);
				} else {
					newAccumulated.push(p1);
				}
			} else {
				newAccumulated.push(p1);
			}
		}

		if (!merged) {
			newAccumulated.push(p2);
		}

		accumulated = newAccumulated;
	}

	result = accumulated;
	return polygonsToSvgPath(result);
}

/**
 * Compute the intersection of two SVG path shapes.
 *
 * Keeps only the overlapping region of both shapes.
 *
 * @param paths1 - First SVG path data string.
 * @param paths2 - Second SVG path data string.
 * @returns SVG path data string of the intersection.
 */
export function intersectShapes(paths1: string, paths2: string): string {
	const polys1 = svgPathToPolygons(paths1);
	const polys2 = svgPathToPolygons(paths2);

	if (polys1.length === 0 || polys2.length === 0) {
		return '';
	}

	const results: Vec2[][] = [];

	for (const p1 of polys1) {
		for (const p2 of polys2) {
			const ccw1 = ensureCCW(p1);
			const ccw2 = ensureCCW(p2);

			const clipped = clipPolygons(ccw1, ccw2);
			results.push(...clipped);
		}
	}

	return polygonsToSvgPath(results);
}

/**
 * Compute the subtraction of two SVG path shapes (paths1 - paths2).
 *
 * Removes the overlapping region of paths2 from paths1.
 *
 * @param paths1 - Subject SVG path data string.
 * @param paths2 - Clip SVG path data string to subtract.
 * @returns SVG path data string of the difference.
 */
export function subtractShapes(paths1: string, paths2: string): string {
	const polys1 = svgPathToPolygons(paths1);
	const polys2 = svgPathToPolygons(paths2);

	if (polys1.length === 0) {
		return '';
	}
	if (polys2.length === 0) {
		return paths1;
	}

	const results: Vec2[][] = [];

	for (const p1 of polys1) {
		let remainders = [ensureCCW(p1)];

		for (const p2 of polys2) {
			const clipPoly = ensureCCW(p2);
			const newRemainders: Vec2[][] = [];

			for (const rem of remainders) {
				const subtracted = subtractSinglePoly(rem, clipPoly);
				newRemainders.push(...subtracted);
			}

			remainders = newRemainders;
		}

		results.push(...remainders);
	}

	return polygonsToSvgPath(results);
}

/**
 * Fragment two SVG path shapes into non-overlapping pieces.
 *
 * Splits the shapes into up to 3 regions:
 * - Parts of paths1 not overlapping paths2
 * - Parts of paths2 not overlapping paths1
 * - The overlapping region
 *
 * @param paths1 - First SVG path data string.
 * @param paths2 - Second SVG path data string.
 * @returns Array of SVG path data strings, one per fragment.
 */
export function fragmentShapes(paths1: string, paths2: string): string[] {
	const polys1 = svgPathToPolygons(paths1);
	const polys2 = svgPathToPolygons(paths2);

	if (polys1.length === 0 && polys2.length === 0) {
		return [];
	}
	if (polys1.length === 0) {
		return [paths2];
	}
	if (polys2.length === 0) {
		return [paths1];
	}

	const results: string[] = [];

	// 1. Intersection (overlap region)
	const intersectionPath = intersectShapes(paths1, paths2);

	// 2. paths1 - paths2 (unique to paths1)
	const onlyIn1 = subtractShapes(paths1, paths2);

	// 3. paths2 - paths1 (unique to paths2)
	const onlyIn2 = subtractShapes(paths2, paths1);

	// Collect non-empty results
	if (onlyIn1) {
		results.push(onlyIn1);
	}
	if (onlyIn2) {
		results.push(onlyIn2);
	}
	if (intersectionPath) {
		results.push(intersectionPath);
	}

	return results.filter((r) => r.length > 0);
}

/**
 * Compute the symmetric difference (XOR / Combine) of two SVG path shapes.
 *
 * Returns the regions that belong to exactly one of the two shapes,
 * excluding the overlap. This is the PowerPoint "Combine" operation.
 *
 * @param paths1 - First SVG path data string.
 * @param paths2 - Second SVG path data string.
 * @returns SVG path data string of the combined (XOR) result.
 */
export function combineShapes(paths1: string, paths2: string): string {
	const onlyIn1 = subtractShapes(paths1, paths2);
	const onlyIn2 = subtractShapes(paths2, paths1);

	if (!onlyIn1 && !onlyIn2) {
		return '';
	}
	if (!onlyIn1) {
		return onlyIn2;
	}
	if (!onlyIn2) {
		return onlyIn1;
	}

	// Merge the two subtraction results into a single multi-sub-path string
	return `${onlyIn1} ${onlyIn2}`.trim();
}

// ---------------------------------------------------------------------------
// Merge shapes operation type
// ---------------------------------------------------------------------------

/** Supported merge shape operations (matching PowerPoint's Merge Shapes menu). */
export type MergeShapeOperation = 'union' | 'intersect' | 'subtract' | 'fragment' | 'combine';

/**
 * Apply a merge shape operation to two SVG path strings.
 *
 * @param operation - The boolean operation to perform.
 * @param paths1 - First SVG path data string.
 * @param paths2 - Second SVG path data string.
 * @returns Result SVG path string(s). Fragment returns multiple strings; others return one.
 */
export function mergeShapes(
	operation: MergeShapeOperation,
	paths1: string,
	paths2: string,
): string | string[] {
	switch (operation) {
		case 'union':
			return unionShapes(paths1, paths2);
		case 'intersect':
			return intersectShapes(paths1, paths2);
		case 'subtract':
			return subtractShapes(paths1, paths2);
		case 'fragment':
			return fragmentShapes(paths1, paths2);
		case 'combine':
			return combineShapes(paths1, paths2);
	}
}

// ---------------------------------------------------------------------------
// Polygon array API (number[][] where each entry is [x, y])
// ---------------------------------------------------------------------------

/**
 * Compute the union of two polygons.
 *
 * Merges the outer boundaries of both polygons. For non-overlapping polygons,
 * returns the concatenation of both polygon point arrays.
 *
 * @param poly1 - First polygon as array of [x, y] points.
 * @param poly2 - Second polygon as array of [x, y] points.
 * @returns Union polygon(s) as array of [x, y] points. When the union is a
 *   single polygon it is the first (and only) element; disjoint polygons
 *   produce multiple elements which are concatenated into a single flat array.
 */
export function unionPolygons(poly1: number[][], poly2: number[][]): number[][] {
	const path1 = polygonsToSvgPath([toVec2(poly1)]);
	const path2 = polygonsToSvgPath([toVec2(poly2)]);
	const result = unionShapes(path1, path2);
	if (!result) {
		return [];
	}
	const polys = svgPathToPolygons(result);
	// Flatten all result polygons into a single array of points
	// When there is exactly one polygon, return its points directly
	if (polys.length === 1) {
		return fromVec2(polys[0]);
	}
	// For multiple polygons (disjoint), return each polygon's points
	// as a flat array separated by the caller's convention
	return polys.flatMap((p) => fromVec2(p));
}

/**
 * Compute the intersection of two polygons.
 *
 * Keeps only the overlapping region of both polygons using
 * Sutherland-Hodgman clipping.
 *
 * @param poly1 - First polygon as array of [x, y] points.
 * @param poly2 - Second polygon as array of [x, y] points.
 * @returns Intersection polygon as array of [x, y] points, or empty array
 *   if no overlap.
 */
export function intersectPolygons(poly1: number[][], poly2: number[][]): number[][] {
	const path1 = polygonsToSvgPath([toVec2(poly1)]);
	const path2 = polygonsToSvgPath([toVec2(poly2)]);
	const result = intersectShapes(path1, path2);
	if (!result) {
		return [];
	}
	const polys = svgPathToPolygons(result);
	if (polys.length === 0) {
		return [];
	}
	if (polys.length === 1) {
		return fromVec2(polys[0]);
	}
	return polys.flatMap((p) => fromVec2(p));
}

/**
 * Compute the subtraction of two polygons (poly1 - poly2).
 *
 * Removes the overlapping region of poly2 from poly1 using
 * Sutherland-Hodgman clipping.
 *
 * @param poly1 - Subject polygon as array of [x, y] points.
 * @param poly2 - Clip polygon to subtract as array of [x, y] points.
 * @returns Difference polygon(s) as array of [x, y] points, or empty array
 *   if nothing remains.
 */
export function subtractPolygons(poly1: number[][], poly2: number[][]): number[][] {
	const path1 = polygonsToSvgPath([toVec2(poly1)]);
	const path2 = polygonsToSvgPath([toVec2(poly2)]);
	const result = subtractShapes(path1, path2);
	if (!result) {
		return [];
	}
	const polys = svgPathToPolygons(result);
	if (polys.length === 0) {
		return [];
	}
	if (polys.length === 1) {
		return fromVec2(polys[0]);
	}
	return polys.flatMap((p) => fromVec2(p));
}

// ---------------------------------------------------------------------------
// SVG path string aliases
// ---------------------------------------------------------------------------

/**
 * Compute the union of two SVG path strings.
 * Alias for {@link unionShapes}.
 *
 * @param path1 - First SVG path data string.
 * @param path2 - Second SVG path data string.
 * @returns SVG path data string of the union.
 */
export function unionSvgPaths(path1: string, path2: string): string {
	return unionShapes(path1, path2);
}

/**
 * Compute the intersection of two SVG path strings.
 * Alias for {@link intersectShapes}.
 *
 * @param path1 - First SVG path data string.
 * @param path2 - Second SVG path data string.
 * @returns SVG path data string of the intersection.
 */
export function intersectSvgPaths(path1: string, path2: string): string {
	return intersectShapes(path1, path2);
}

/**
 * Compute the subtraction of two SVG path strings (path1 - path2).
 * Alias for {@link subtractShapes}.
 *
 * @param path1 - First SVG path data string.
 * @param path2 - Second SVG path data string.
 * @returns SVG path data string of the difference.
 */
export function subtractSvgPaths(path1: string, path2: string): string {
	return subtractShapes(path1, path2);
}
