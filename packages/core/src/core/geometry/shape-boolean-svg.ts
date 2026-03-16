/**
 * SVG path data parsing and serialization for polygon-based operations.
 *
 * Converts between SVG path data strings and arrays of polygon vertex arrays
 * ({@link Vec2}[][]).  Only linear commands (M, L, H, V, Z and their relative
 * variants) are supported — curves are not handled.
 *
 * @module geometry/shape-boolean-svg
 */

import type { Vec2 } from './shape-boolean-types';
import { dedupPoly, fmtNum } from './shape-boolean-types';

// ---------------------------------------------------------------------------
// SVG path → Polygons
// ---------------------------------------------------------------------------

/**
 * Parse an SVG path data string into an array of polygon vertex arrays.
 *
 * Only absolute M, L, H, V, and Z commands (and their relative lower-case
 * variants) are supported. Each sub-path (delimited by M..Z) becomes a
 * separate polygon.
 *
 * @param pathData - SVG path data string.
 * @returns Array of polygons (each polygon is an array of Vec2).
 */
export function svgPathToPolygons(pathData: string): Vec2[][] {
	const polygons: Vec2[][] = [];
	let current: Vec2[] = [];
	let penX = 0;
	let penY = 0;

	// Tokenize on command letters
	const tokens = pathData.match(/[MLHVZCSQTAmlhvzcsqta][^MLHVZCSQTAmlhvzcsqta]*/gi) ?? [];

	for (const token of tokens) {
		const cmd = token[0];
		const nums = (token.slice(1).match(/-?[\d.]+(?:e[+-]?\d+)?/gi) ?? []).map(Number);

		switch (cmd) {
			case 'M':
				// Start a new sub-path
				if (current.length >= 3) {
					polygons.push(dedupPoly(current));
				}
				current = [];
				if (nums.length >= 2) {
					penX = nums[0];
					penY = nums[1];
					current.push({ x: penX, y: penY });
					// Implicit lineTo for subsequent coordinate pairs
					for (let i = 2; i + 1 < nums.length; i += 2) {
						penX = nums[i];
						penY = nums[i + 1];
						current.push({ x: penX, y: penY });
					}
				}
				break;

			case 'm': {
				if (current.length >= 3) {
					polygons.push(dedupPoly(current));
				}
				current = [];
				if (nums.length >= 2) {
					penX += nums[0];
					penY += nums[1];
					current.push({ x: penX, y: penY });
					for (let i = 2; i + 1 < nums.length; i += 2) {
						penX += nums[i];
						penY += nums[i + 1];
						current.push({ x: penX, y: penY });
					}
				}
				break;
			}

			case 'L':
				for (let i = 0; i + 1 < nums.length; i += 2) {
					penX = nums[i];
					penY = nums[i + 1];
					current.push({ x: penX, y: penY });
				}
				break;

			case 'l':
				for (let i = 0; i + 1 < nums.length; i += 2) {
					penX += nums[i];
					penY += nums[i + 1];
					current.push({ x: penX, y: penY });
				}
				break;

			case 'H':
				if (nums.length >= 1) {
					penX = nums[0];
					current.push({ x: penX, y: penY });
				}
				break;

			case 'h':
				if (nums.length >= 1) {
					penX += nums[0];
					current.push({ x: penX, y: penY });
				}
				break;

			case 'V':
				if (nums.length >= 1) {
					penY = nums[0];
					current.push({ x: penX, y: penY });
				}
				break;

			case 'v':
				if (nums.length >= 1) {
					penY += nums[0];
					current.push({ x: penX, y: penY });
				}
				break;

			case 'Z':
			case 'z':
				if (current.length >= 3) {
					polygons.push(dedupPoly(current));
				}
				// Reset pen to start of sub-path
				if (current.length > 0) {
					penX = current[0].x;
					penY = current[0].y;
				}
				current = [];
				break;
		}
	}

	// Flush any unclosed sub-path
	if (current.length >= 3) {
		polygons.push(dedupPoly(current));
	}

	return polygons;
}

// ---------------------------------------------------------------------------
// Polygons → SVG path
// ---------------------------------------------------------------------------

/**
 * Convert polygon vertex arrays to an SVG path data string.
 *
 * Each polygon becomes an M ... L ... Z sub-path.
 *
 * @param polygons - Array of polygons (each an array of Vec2).
 * @returns SVG path data string.
 */
export function polygonsToSvgPath(polygons: Vec2[][]): string {
	const parts: string[] = [];
	for (const poly of polygons) {
		if (poly.length < 3) {
			continue;
		}
		parts.push(`M ${fmtNum(poly[0].x)} ${fmtNum(poly[0].y)}`);
		for (let i = 1; i < poly.length; i++) {
			parts.push(`L ${fmtNum(poly[i].x)} ${fmtNum(poly[i].y)}`);
		}
		parts.push('Z');
	}
	return parts.join(' ');
}
