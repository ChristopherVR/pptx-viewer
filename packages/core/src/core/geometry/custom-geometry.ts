/**
 * Utilities for converting between structured CustomGeometryPath[] and
 * SVG path data strings, plus serialization to/from OOXML a:custGeom XML.
 */
import type {
	AdjustHandlePolar,
	AdjustHandleXY,
	ConnectionSite,
	CustomGeometryPath,
	CustomGeometryPoint,
	CustomGeometryRawData,
	CustomGeometrySegment,
	CustomGeometryTextRect,
	XmlObject,
} from '../types';
import { orderedXmlKey } from './custom-geometry-command-order';
import { ooxmlArcToSvg } from './guide-formula-paths';

// ---------------------------------------------------------------------------
// Structured paths -> SVG path data string
// ---------------------------------------------------------------------------

/**
 * Convert structured custom geometry paths to a single SVG path data string.
 *
 * Iterates through all paths and their segments, translating each segment
 * type (moveTo, lineTo, cubicBezTo, quadBezTo, arcTo, close) into the
 * corresponding SVG path command. Arc segments are converted via
 * {@link ooxmlArcToSvg} which handles the OOXML-to-SVG arc parameter mapping.
 *
 * @param paths - Array of structured custom geometry paths.
 * @returns A single SVG path data string combining all paths.
 */
export function customGeometryPathsToSvg(paths: CustomGeometryPath[]): string {
	const parts: string[] = [];
	// Track pen position for arcTo conversion (needs current position
	// to derive the implicit ellipse center)
	let penX = 0;
	let penY = 0;
	// Track most recent moveTo for close commands
	let moveX = 0;
	let moveY = 0;
	for (const path of paths) {
		for (const seg of path.segments) {
			switch (seg.type) {
				case 'moveTo':
					parts.push(`M ${seg.pt.x} ${seg.pt.y}`);
					penX = seg.pt.x;
					penY = seg.pt.y;
					moveX = penX;
					moveY = penY;
					break;
				case 'lineTo':
					parts.push(`L ${seg.pt.x} ${seg.pt.y}`);
					penX = seg.pt.x;
					penY = seg.pt.y;
					break;
				case 'cubicBezTo':
					parts.push(
						`C ${seg.pts[0].x} ${seg.pts[0].y} ${seg.pts[1].x} ${seg.pts[1].y} ${seg.pts[2].x} ${seg.pts[2].y}`,
					);
					penX = seg.pts[2].x;
					penY = seg.pts[2].y;
					break;
				case 'quadBezTo':
					parts.push(`Q ${seg.pts[0].x} ${seg.pts[0].y} ${seg.pts[1].x} ${seg.pts[1].y}`);
					penX = seg.pts[1].x;
					penY = seg.pts[1].y;
					break;
				case 'arcTo': {
					const result = ooxmlArcToSvg(seg.wR, seg.hR, seg.stAng, seg.swAng, penX, penY);
					if (result) {
						parts.push(result.svg);
						penX = result.endX;
						penY = result.endY;
					}
					break;
				}
				case 'close':
					parts.push('Z');
					penX = moveX;
					penY = moveY;
					break;
			}
		}
	}
	return parts.join(' ');
}

/**
 * One sub-path of a custom geometry, emitted as its own SVG `d` string plus the
 * OOXML fill/stroke flags that decide how it should be painted. Produced by
 * {@link customGeometryPathsToSvgSubpaths}.
 */
export interface CustomGeometrySubpathSvg {
	/** SVG path data for this single sub-path (already in the target space). */
	d: string;
	/** `a:path/@fill`; `undefined` means the default (`norm`, i.e. filled). */
	fillMode?: CustomGeometryPath['fillMode'];
	/** `a:path/@stroke`; `undefined`/`true` means stroked, `false` unstroked. */
	stroke?: boolean;
}

/** Emit one sub-path's segments as an SVG `d` string, scaling coords by sx/sy. */
function subpathSegmentsToSvg(path: CustomGeometryPath, sx: number, sy: number): string {
	const parts: string[] = [];
	// Pen resets per sub-path (each normally opens with a moveTo). Coordinates
	// are scaled into the shared target coordinate space so sub-paths that carry
	// their own @w/@h line up with the first path's viewBox.
	let penX = 0;
	let penY = 0;
	let moveX = 0;
	let moveY = 0;
	for (const seg of path.segments) {
		switch (seg.type) {
			case 'moveTo':
				parts.push(`M ${seg.pt.x * sx} ${seg.pt.y * sy}`);
				penX = seg.pt.x * sx;
				penY = seg.pt.y * sy;
				moveX = penX;
				moveY = penY;
				break;
			case 'lineTo':
				parts.push(`L ${seg.pt.x * sx} ${seg.pt.y * sy}`);
				penX = seg.pt.x * sx;
				penY = seg.pt.y * sy;
				break;
			case 'cubicBezTo':
				parts.push(
					`C ${seg.pts[0].x * sx} ${seg.pts[0].y * sy} ${seg.pts[1].x * sx} ${seg.pts[1].y * sy} ${seg.pts[2].x * sx} ${seg.pts[2].y * sy}`,
				);
				penX = seg.pts[2].x * sx;
				penY = seg.pts[2].y * sy;
				break;
			case 'quadBezTo':
				parts.push(
					`Q ${seg.pts[0].x * sx} ${seg.pts[0].y * sy} ${seg.pts[1].x * sx} ${seg.pts[1].y * sy}`,
				);
				penX = seg.pts[1].x * sx;
				penY = seg.pts[1].y * sy;
				break;
			case 'arcTo': {
				const result = ooxmlArcToSvg(seg.wR * sx, seg.hR * sy, seg.stAng, seg.swAng, penX, penY);
				if (result) {
					parts.push(result.svg);
					penX = result.endX;
					penY = result.endY;
				}
				break;
			}
			case 'close':
				parts.push('Z');
				penX = moveX;
				penY = moveY;
				break;
		}
	}
	return parts.join(' ');
}

/**
 * Convert structured custom geometry paths to one SVG `d` string *per* sub-path,
 * preserving each sub-path's `@fill`/`@stroke` flags.
 *
 * Unlike {@link customGeometryPathsToSvg} (which concatenates every sub-path
 * into a single `d` that must be painted with one uniform fill), this keeps
 * sub-paths separate so a renderer can honour per-sub-path fill modes: a
 * `fill="none"` open stroke, a filled outer contour, etc.
 *
 * Each sub-path is scaled from its own `@w`/`@h` coordinate space into the
 * shared `targetWidth`/`targetHeight` space (that of the first path, i.e. the
 * viewBox), so multi-`@w`/`@h` geometries line up.
 *
 * @param paths        Structured sub-paths.
 * @param targetWidth  Shared coordinate-space width (viewBox width).
 * @param targetHeight Shared coordinate-space height (viewBox height).
 */
export function customGeometryPathsToSvgSubpaths(
	paths: CustomGeometryPath[],
	targetWidth: number,
	targetHeight: number,
): CustomGeometrySubpathSvg[] {
	return paths.map((path) => {
		const sx = path.width > 0 ? targetWidth / path.width : 1;
		const sy = path.height > 0 ? targetHeight / path.height : 1;
		return {
			d: subpathSegmentsToSvg(path, sx, sy),
			fillMode: path.fillMode,
			stroke: path.stroke,
		};
	});
}

// ---------------------------------------------------------------------------
// SVG path data string -> structured paths (basic parser)
// ---------------------------------------------------------------------------

/**
 * Parse a simple SVG path data string into structured {@link CustomGeometryPath}.
 *
 * Supports absolute M, L, C, Q, and Z commands. Does not handle relative
 * commands or the SVG A (arc) command, as the primary use case is round-tripping
 * paths that were originally generated from structured data.
 *
 * @param pathData - An SVG path data string (e.g. `"M 0 0 L 100 100 Z"`).
 * @param width - The coordinate-space width of the path.
 * @param height - The coordinate-space height of the path.
 * @returns An array containing a single {@link CustomGeometryPath} with the parsed segments.
 */
export function svgToCustomGeometryPaths(
	pathData: string,
	width: number,
	height: number,
): CustomGeometryPath[] {
	const segments: CustomGeometrySegment[] = [];
	// Tokenize: split the path string on SVG command letters, keeping each
	// letter attached to its subsequent coordinate data
	const tokens = pathData.match(/[MLCQZAmlcqza][^MLCQZAmlcqza]*/gi) ?? [];
	for (const token of tokens) {
		const cmd = token[0];
		const nums = (token.slice(1).match(/-?[\d.]+/g) ?? []).map(Number);
		switch (cmd.toUpperCase()) {
			case 'M':
				if (nums.length >= 2) {
					segments.push({ type: 'moveTo', pt: { x: nums[0], y: nums[1] } });
				}
				break;
			case 'L':
				if (nums.length >= 2) {
					segments.push({ type: 'lineTo', pt: { x: nums[0], y: nums[1] } });
				}
				break;
			case 'C':
				if (nums.length >= 6) {
					segments.push({
						type: 'cubicBezTo',
						pts: [
							{ x: nums[0], y: nums[1] },
							{ x: nums[2], y: nums[3] },
							{ x: nums[4], y: nums[5] },
						],
					});
				}
				break;
			case 'Q':
				if (nums.length >= 4) {
					segments.push({
						type: 'quadBezTo',
						pts: [
							{ x: nums[0], y: nums[1] },
							{ x: nums[2], y: nums[3] },
						],
					});
				}
				break;
			case 'Z':
				segments.push({ type: 'close' });
				break;
		}
	}
	return [{ width, height, segments }];
}

// ---------------------------------------------------------------------------
// Structured paths -> OOXML a:custGeom XML object
// ---------------------------------------------------------------------------

/**
 * Convert a geometry point to an OOXML `a:pt` XML object.
 *
 * Coordinates are rounded to integers for clean XML output.
 *
 * @param pt - The point to serialize.
 * @returns An XML object with `@_x` and `@_y` string attributes.
 */
function pointToXml(pt: CustomGeometryPoint): XmlObject {
	return { '@_x': String(Math.round(pt.x)), '@_y': String(Math.round(pt.y)) };
}

/**
 * Optional typed inputs for {@link customGeometryPathsToXml}.
 *
 * When typed values are provided they take precedence over the matching
 * raw-XML slot in {@link CustomGeometryRawData} so SDK-built shapes that
 * never carried raw XML still emit a populated `a:ahLst` / `a:cxnLst` /
 * `a:rect`.
 */
export interface CustomGeometryTypedExtras {
	adjustHandlesXY?: AdjustHandleXY[];
	adjustHandlesPolar?: AdjustHandlePolar[];
	connectionSites?: ConnectionSite[];
	textRect?: CustomGeometryTextRect;
}

function adjustHandleXyToXml(handle: AdjustHandleXY): XmlObject {
	const node: XmlObject = {};
	if (handle.gdRefX !== undefined) {
		node['@_gdRefX'] = handle.gdRefX;
	}
	if (handle.gdRefY !== undefined) {
		node['@_gdRefY'] = handle.gdRefY;
	}
	if (handle.minX !== undefined) {
		node['@_minX'] = handle.minX;
	}
	if (handle.maxX !== undefined) {
		node['@_maxX'] = handle.maxX;
	}
	if (handle.minY !== undefined) {
		node['@_minY'] = handle.minY;
	}
	if (handle.maxY !== undefined) {
		node['@_maxY'] = handle.maxY;
	}
	const pos: XmlObject = {};
	if (handle.posX !== undefined) {
		pos['@_x'] = handle.posX;
	}
	if (handle.posY !== undefined) {
		pos['@_y'] = handle.posY;
	}
	if (Object.keys(pos).length > 0) {
		node['a:pos'] = pos;
	}
	return node;
}

function adjustHandlePolarToXml(handle: AdjustHandlePolar): XmlObject {
	const node: XmlObject = {};
	if (handle.gdRefR !== undefined) {
		node['@_gdRefR'] = handle.gdRefR;
	}
	if (handle.gdRefAng !== undefined) {
		node['@_gdRefAng'] = handle.gdRefAng;
	}
	if (handle.minR !== undefined) {
		node['@_minR'] = handle.minR;
	}
	if (handle.maxR !== undefined) {
		node['@_maxR'] = handle.maxR;
	}
	if (handle.minAng !== undefined) {
		node['@_minAng'] = handle.minAng;
	}
	if (handle.maxAng !== undefined) {
		node['@_maxAng'] = handle.maxAng;
	}
	const pos: XmlObject = {};
	if (handle.posX !== undefined) {
		pos['@_x'] = handle.posX;
	}
	if (handle.posY !== undefined) {
		pos['@_y'] = handle.posY;
	}
	if (Object.keys(pos).length > 0) {
		node['a:pos'] = pos;
	}
	return node;
}

function connectionSiteToXml(site: ConnectionSite): XmlObject {
	const node: XmlObject = {};
	if (site.ang !== undefined) {
		node['@_ang'] = site.ang;
	}
	const pos: XmlObject = {};
	if (site.posX !== undefined) {
		pos['@_x'] = site.posX;
	}
	if (site.posY !== undefined) {
		pos['@_y'] = site.posY;
	}
	if (Object.keys(pos).length > 0) {
		node['a:pos'] = pos;
	}
	return node;
}

function textRectToXml(rect: CustomGeometryTextRect): XmlObject {
	const node: XmlObject = {};
	if (rect.l !== undefined) {
		node['@_l'] = rect.l;
	}
	if (rect.t !== undefined) {
		node['@_t'] = rect.t;
	}
	if (rect.r !== undefined) {
		node['@_r'] = rect.r;
	}
	if (rect.b !== undefined) {
		node['@_b'] = rect.b;
	}
	return node;
}

/**
 * Serialize structured custom geometry paths to an OOXML `a:custGeom` XML object.
 *
 * Produces a complete custom geometry XML structure including
 * `a:avLst`, `a:gdLst`, `a:ahLst`, `a:cxnLst`, and a `a:rect`
 * referencing the built-in position variables. The `a:pathLst`
 * contains the serialized path segments.
 *
 * Typed extras (`extras.adjustHandlesXY`/`Polar`, `connectionSites`, `textRect`)
 * take precedence over the raw-XML slot they correspond to. This lets
 * SDK-built shapes emit populated handle/connection/rect data even though
 * they never round-tripped any raw XML.
 *
 * @param paths - Array of structured custom geometry paths to serialize.
 * @returns An XML object representing the complete `a:custGeom` element.
 */
export function customGeometryPathsToXml(
	paths: CustomGeometryPath[],
	rawData?: CustomGeometryRawData,
	extras?: CustomGeometryTypedExtras,
): XmlObject {
	const xmlPaths: XmlObject[] = paths.map((path) => {
		const pathXml: XmlObject = {
			'@_w': String(Math.round(path.width)),
			'@_h': String(Math.round(path.height)),
		};
		// G-H2: path-level attributes
		if (path.fillMode) {
			pathXml['@_fill'] = path.fillMode;
		}
		if (path.stroke === false) {
			pathXml['@_stroke'] = '0';
		} else if (path.stroke === true) {
			pathXml['@_stroke'] = '1';
		}
		if (path.extrusionOk === true) {
			pathXml['@_extrusionOk'] = '1';
		} else if (path.extrusionOk === false) {
			pathXml['@_extrusionOk'] = '0';
		}

		let previousName: string | undefined;
		let previousKey: string | undefined;
		let order = 0;
		const appendCommand = (name: string, value: XmlObject): void => {
			if (name === previousName && previousKey) {
				const existing = pathXml[previousKey] as XmlObject | XmlObject[];
				pathXml[previousKey] = Array.isArray(existing) ? [...existing, value] : [existing, value];
				return;
			}
			const seen = Object.keys(pathXml).some((key) => key === name || key.startsWith(`${name}#`));
			previousKey = seen ? orderedXmlKey(name, order++) : name;
			pathXml[previousKey] = value;
			previousName = name;
		};

		for (const seg of path.segments) {
			switch (seg.type) {
				case 'moveTo':
					appendCommand('a:moveTo', { 'a:pt': pointToXml(seg.pt) });
					break;
				case 'lineTo':
					appendCommand('a:lnTo', { 'a:pt': pointToXml(seg.pt) });
					break;
				case 'cubicBezTo':
					appendCommand('a:cubicBezTo', {
						'a:pt': seg.pts.map(pointToXml),
					});
					break;
				case 'quadBezTo':
					appendCommand('a:quadBezTo', {
						'a:pt': seg.pts.map(pointToXml),
					});
					break;
				case 'arcTo':
					appendCommand('a:arcTo', {
						'@_wR': String(Math.round(seg.wR)),
						'@_hR': String(Math.round(seg.hR)),
						'@_stAng': String(Math.round(seg.stAng)),
						'@_swAng': String(Math.round(seg.swAng)),
					});
					break;
				case 'close':
					appendCommand('a:close', {});
					break;
			}
		}

		return pathXml;
	});

	// Build typed a:ahLst when typed extras present
	let ahLstXml: XmlObject | undefined;
	const typedXy = extras?.adjustHandlesXY ?? [];
	const typedPolar = extras?.adjustHandlesPolar ?? [];
	if (typedXy.length > 0 || typedPolar.length > 0) {
		const node: XmlObject = {};
		if (typedXy.length > 0) {
			const items = typedXy.map(adjustHandleXyToXml);
			node['a:ahXY'] = items.length === 1 ? items[0] : items;
		}
		if (typedPolar.length > 0) {
			const items = typedPolar.map(adjustHandlePolarToXml);
			node['a:ahPolar'] = items.length === 1 ? items[0] : items;
		}
		ahLstXml = node;
	} else if (rawData?.ahLstXml !== undefined) {
		ahLstXml = rawData.ahLstXml as XmlObject;
	}

	let cxnLstXml: XmlObject | undefined;
	const typedCxn = extras?.connectionSites ?? [];
	if (typedCxn.length > 0) {
		const items = typedCxn.map(connectionSiteToXml);
		cxnLstXml = { 'a:cxn': items.length === 1 ? items[0] : items };
	} else if (rawData?.cxnLstXml !== undefined) {
		cxnLstXml = rawData.cxnLstXml as XmlObject;
	}

	let rectXml: XmlObject | undefined;
	if (extras?.textRect && Object.keys(extras.textRect).length > 0) {
		rectXml = textRectToXml(extras.textRect);
	} else if (rawData?.rectXml !== undefined) {
		rectXml = rawData.rectXml as XmlObject;
	}

	const result: XmlObject = {
		'a:avLst': (rawData?.avLstXml as XmlObject | undefined) ?? {},
		'a:gdLst': (rawData?.gdLstXml as XmlObject | undefined) ?? {},
		'a:ahLst': ahLstXml ?? {},
		'a:cxnLst': cxnLstXml ?? {},
		'a:rect': rectXml ?? {
			'@_l': 'l',
			'@_t': 't',
			'@_r': 'r',
			'@_b': 'b',
		},
		'a:pathLst': {
			'a:path': xmlPaths.length === 1 ? xmlPaths[0] : xmlPaths,
		},
	};
	return result;
}

// ---------------------------------------------------------------------------
// Compute bounding box of all points in structured paths
// ---------------------------------------------------------------------------

/**
 * Extract all explicit control and anchor points from structured paths.
 *
 * Collects points from moveTo, lineTo, cubicBezTo, and quadBezTo segments.
 * ArcTo and close segments are excluded as they do not contribute explicit
 * control points. This is useful for computing bounding boxes.
 *
 * @param paths - Array of structured custom geometry paths.
 * @returns Flat array of all extracted points.
 */
export function getAllPointsFromPaths(paths: CustomGeometryPath[]): CustomGeometryPoint[] {
	const points: CustomGeometryPoint[] = [];
	for (const path of paths) {
		for (const seg of path.segments) {
			switch (seg.type) {
				case 'moveTo':
				case 'lineTo':
					points.push(seg.pt);
					break;
				case 'cubicBezTo':
					points.push(...seg.pts);
					break;
				case 'quadBezTo':
					points.push(...seg.pts);
					break;
			}
		}
	}
	return points;
}

/**
 * Recalculate the coordinate-space dimensions to tightly fit all points.
 *
 * Finds the maximum X and Y values across all control/anchor points
 * and returns dimensions that encompass them. Minimum dimensions are
 * clamped to 1 to avoid degenerate geometry.
 *
 * @param paths - Array of structured custom geometry paths.
 * @returns An object with `width` and `height` that tightly bound all points.
 */
export function recalculatePathBounds(paths: CustomGeometryPath[]): {
	width: number;
	height: number;
} {
	const pts = getAllPointsFromPaths(paths);
	if (pts.length === 0) {
		return { width: 1, height: 1 };
	}
	let maxX = 0;
	let maxY = 0;
	for (const pt of pts) {
		if (pt.x > maxX) {
			maxX = pt.x;
		}
		if (pt.y > maxY) {
			maxY = pt.y;
		}
	}
	return { width: Math.max(maxX, 1), height: Math.max(maxY, 1) };
}
