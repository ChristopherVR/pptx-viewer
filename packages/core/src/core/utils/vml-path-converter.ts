/**
 * VML path and polyline conversion to SVG path data.
 *
 * Converts VML path commands (`m`, `l`, `c`, `x`, `e`, `qb`, `t`, `r`,
 * `nf`, `ns`) and `v:polyline` point lists into standard SVG path data
 * strings.
 *
 * @module vml-path-converter
 */

import type { XmlObject } from '../types';
import { parseCssDimension } from './vml-style-parser';

// ── VML path → SVG path ──────────────────────────────────────────────

/**
 * Convert a VML `path` attribute (the `v` attribute on `v:shape`) to an
 * SVG path data string.
 *
 * VML path commands are similar to SVG but use different keywords:
 * - `m` — moveTo
 * - `l` — lineTo (multiple pairs)
 * - `c` — curveTo (3 coordinate pairs)
 * - `x` — close path
 * - `e` — end
 * - `qb` — quadratic bezier
 * - `t` — relative lineTo
 * - `r` — relative curveTo
 * - `nf` / `ns` — no fill / no stroke hints (skipped)
 *
 * Coordinates are scaled from the VML `coordsize` space to the target
 * pixel dimensions.
 *
 * @param vmlPath - Raw VML path string.
 * @param coordSizeW - Width of the VML coordinate space.
 * @param coordSizeH - Height of the VML coordinate space.
 * @param targetW - Target width in pixels.
 * @param targetH - Target height in pixels.
 * @returns SVG path data string, or `undefined` if the input is empty or
 *   produces no commands.
 */
export function convertVmlPathToSvg(
	vmlPath: string | undefined,
	coordSizeW: number,
	coordSizeH: number,
	targetW: number,
	targetH: number,
): string | undefined {
	if (!vmlPath) {
		return undefined;
	}

	const scaleX = coordSizeW > 0 ? targetW / coordSizeW : 1;
	const scaleY = coordSizeH > 0 ? targetH / coordSizeH : 1;

	// Tokenize the VML path
	const tokens = vmlPath.match(/[a-zA-Z]+|[-+]?\d+/g);
	if (!tokens) {
		return undefined;
	}

	const parts: string[] = [];
	let i = 0;

	while (i < tokens.length) {
		const cmd = tokens[i];
		switch (cmd) {
			case 'm': {
				// moveTo
				if (i + 2 < tokens.length) {
					const x = parseInt(tokens[i + 1], 10) * scaleX;
					const y = parseInt(tokens[i + 2], 10) * scaleY;
					parts.push(`M ${x} ${y}`);
					i += 3;
				} else {
					i++;
				}
				break;
			}
			case 'l': {
				// lineTo — can have multiple coordinate pairs
				i++;
				while (
					i + 1 < tokens.length &&
					/^[-+]?\d+$/.test(tokens[i]) &&
					/^[-+]?\d+$/.test(tokens[i + 1])
				) {
					const x = parseInt(tokens[i], 10) * scaleX;
					const y = parseInt(tokens[i + 1], 10) * scaleY;
					parts.push(`L ${x} ${y}`);
					i += 2;
				}
				break;
			}
			case 'c': {
				// curveTo — 3 coordinate pairs per curve
				i++;
				while (i + 5 < tokens.length && /^[-+]?\d+$/.test(tokens[i])) {
					const x1 = parseInt(tokens[i], 10) * scaleX;
					const y1 = parseInt(tokens[i + 1], 10) * scaleY;
					const x2 = parseInt(tokens[i + 2], 10) * scaleX;
					const y2 = parseInt(tokens[i + 3], 10) * scaleY;
					const x = parseInt(tokens[i + 4], 10) * scaleX;
					const y = parseInt(tokens[i + 5], 10) * scaleY;
					parts.push(`C ${x1} ${y1} ${x2} ${y2} ${x} ${y}`);
					i += 6;
				}
				break;
			}
			case 'x':
				// close path
				parts.push('Z');
				i++;
				break;
			case 'e':
				// end — just stop
				i = tokens.length;
				break;
			case 't': {
				// relative lineTo
				i++;
				while (
					i + 1 < tokens.length &&
					/^[-+]?\d+$/.test(tokens[i]) &&
					/^[-+]?\d+$/.test(tokens[i + 1])
				) {
					const dx = parseInt(tokens[i], 10) * scaleX;
					const dy = parseInt(tokens[i + 1], 10) * scaleY;
					parts.push(`l ${dx} ${dy}`);
					i += 2;
				}
				break;
			}
			case 'r': {
				// relative curveTo
				i++;
				while (i + 5 < tokens.length && /^[-+]?\d+$/.test(tokens[i])) {
					const dx1 = parseInt(tokens[i], 10) * scaleX;
					const dy1 = parseInt(tokens[i + 1], 10) * scaleY;
					const dx2 = parseInt(tokens[i + 2], 10) * scaleX;
					const dy2 = parseInt(tokens[i + 3], 10) * scaleY;
					const dx = parseInt(tokens[i + 4], 10) * scaleX;
					const dy = parseInt(tokens[i + 5], 10) * scaleY;
					parts.push(`c ${dx1} ${dy1} ${dx2} ${dy2} ${dx} ${dy}`);
					i += 6;
				}
				break;
			}
			case 'qb': {
				// quad bezier
				i++;
				while (
					i + 1 < tokens.length &&
					/^[-+]?\d+$/.test(tokens[i]) &&
					/^[-+]?\d+$/.test(tokens[i + 1])
				) {
					const x = parseInt(tokens[i], 10) * scaleX;
					const y = parseInt(tokens[i + 1], 10) * scaleY;
					parts.push(`Q ${x} ${y}`);
					i += 2;
				}
				break;
			}
			case 'nf':
			case 'ns':
				// no fill / no stroke hints — skip
				i++;
				break;
			default:
				// Unknown command or coordinate — skip
				i++;
				break;
		}
	}

	return parts.length > 0 ? parts.join(' ') : undefined;
}

// ── VML line parsing ─────────────────────────────────────────────────

/**
 * Parse a `v:line` element which uses `from` and `to` attributes
 * instead of CSS style position/size.
 *
 * @param node - Parsed XML node of the `v:line` element.
 * @returns Bounding box with integer pixel values.
 */
export function parseVmlLine(node: XmlObject): {
	x: number;
	y: number;
	width: number;
	height: number;
} {
	const from = String(node['@_from'] || '0,0');
	const to = String(node['@_to'] || '0,0');

	const [fromX, fromY] = from.split(',').map((s) => parseCssDimension(s.trim()));
	const [toX, toY] = to.split(',').map((s) => parseCssDimension(s.trim()));

	const x = Math.min(fromX, toX);
	const y = Math.min(fromY, toY);
	const width = Math.abs(toX - fromX) || 1;
	const height = Math.abs(toY - fromY) || 1;

	return {
		x: Math.round(x),
		y: Math.round(y),
		width: Math.round(width),
		height: Math.round(height),
	};
}

// ── VML polyline parsing ─────────────────────────────────────────────

/**
 * Parse a `v:polyline` element's `points` attribute into an SVG path
 * data string.
 *
 * The `points` attribute contains a comma/space-separated list of
 * coordinate pairs.
 *
 * @param node - Parsed XML node of the `v:polyline` element.
 * @param _width - Target width (currently unused, reserved for scaling).
 * @param _height - Target height (currently unused, reserved for scaling).
 * @returns SVG path data string, or `undefined` if points are missing or
 *   insufficient.
 */
export function parseVmlPolylinePoints(
	node: XmlObject,
	_width: number,
	_height: number,
): string | undefined {
	const pointsStr = String(node['@_points'] || '').trim();
	if (pointsStr.length === 0) {
		return undefined;
	}

	// Points can be comma or space separated
	const values = pointsStr
		.split(/[\s,]+/)
		.map(Number)
		.filter(Number.isFinite);
	if (values.length < 4) {
		return undefined;
	}

	const parts: string[] = [];
	for (let i = 0; i < values.length - 1; i += 2) {
		const cmd = i === 0 ? 'M' : 'L';
		parts.push(`${cmd} ${values[i]} ${values[i + 1]}`);
	}

	return parts.join(' ');
}
