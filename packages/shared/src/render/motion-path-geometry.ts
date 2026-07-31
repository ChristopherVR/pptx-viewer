/**
 * `motion-path-geometry`: turn an OOXML motion path into the things the
 * authoring UI needs - an SVG outline to draw over the canvas, the draggable
 * start/end handles, an edited path string after a drag, and the `@keyframes`
 * block that plays the motion.
 *
 * WHY this is separate from `animation-motion-path`: that module samples a path
 * into waypoints for the native-timeline playback engine and expresses them as
 * percentages of the element box. Authoring needs the *slide* space PowerPoint
 * actually stores (`@path` numbers are fractions of the slide, measured from
 * the element centre), plus the ability to write a modified path back out. Both
 * share the sampler; only this module knows about pixels and editing.
 *
 * @module render/motion-path-geometry
 */

import { parseMotionPathPoints } from './animation-motion-path';

/** A point in slide pixels. */
export interface MotionPixelPoint {
	x: number;
	y: number;
}

/** The canvas geometry a motion path is drawn against. */
export interface MotionPathFrame {
	/** Element centre in slide pixels: the path's origin. */
	originX: number;
	originY: number;
	/** Slide canvas size in pixels: the unit the path fractions scale by. */
	slideWidth: number;
	slideHeight: number;
}

/** One parsed path command with its raw coordinate list. */
interface PathSegment {
	cmd: string;
	coords: number[];
}

/** Commands this module can rewrite. Anything else makes a path read-only. */
const EDITABLE = new Set(['M', 'L', 'C', 'Z', 'm', 'l', 'c', 'z']);

/** Coordinate count per command letter. */
const ARITY: Record<string, number> = { m: 2, l: 2, c: 6, z: 0 };

/**
 * Tokenise a path into segments. Returns `undefined` when the path contains a
 * command this module cannot faithfully rewrite (arcs, quadratics, PowerPoint's
 * trailing `E` marker), so callers can fall back to read-only behaviour instead
 * of silently corrupting the geometry.
 */
function scanPath(path: string): PathSegment[] | undefined {
	const tokens = path.match(/[A-Za-z]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/gu);
	if (!tokens) {
		return undefined;
	}
	const segments: PathSegment[] = [];
	let i = 0;
	let cmd = '';
	while (i < tokens.length) {
		if (/^[A-Za-z]$/u.test(tokens[i])) {
			cmd = tokens[i];
			i++;
			if (!EDITABLE.has(cmd)) {
				return undefined;
			}
			if (cmd === 'Z' || cmd === 'z') {
				segments.push({ cmd, coords: [] });
			}
			continue;
		}
		const arity = ARITY[cmd.toLowerCase()];
		if (!arity) {
			return undefined;
		}
		const coords: number[] = [];
		for (let n = 0; n < arity; n++) {
			const value = Number(tokens[i++]);
			if (!Number.isFinite(value)) {
				return undefined;
			}
			coords.push(value);
		}
		segments.push({ cmd, coords });
		// A repeated coordinate run after `M` is an implicit lineto, as in SVG.
		if (cmd === 'M') {
			cmd = 'L';
		} else if (cmd === 'm') {
			cmd = 'l';
		}
	}
	return segments.length > 0 ? segments : undefined;
}

/** Render segments back to a path string, trimming float noise. */
function formatPath(segments: readonly PathSegment[]): string {
	return segments
		.map((segment) =>
			segment.coords.length === 0
				? segment.cmd
				: `${segment.cmd} ${segment.coords.map((n) => trimNumber(n)).join(' ')}`,
		)
		.join(' ');
}

/** Format a coordinate with at most 4 decimals and no trailing zeros. */
function trimNumber(value: number): string {
	return String(Number(value.toFixed(4)));
}

/**
 * Sample the path into points expressed as slide fractions relative to the
 * element centre (the same space the path string uses).
 */
export function motionPathFractionPoints(path: string): MotionPixelPoint[] {
	// `parseMotionPathPoints` returns percentages; authoring works in fractions.
	return parseMotionPathPoints(path).map((point) => ({ x: point.x / 100, y: point.y / 100 }));
}

/** Convert a fraction-space point to slide pixels within `frame`. */
function toPixels(point: MotionPixelPoint, frame: MotionPathFrame): MotionPixelPoint {
	return {
		x: frame.originX + point.x * frame.slideWidth,
		y: frame.originY + point.y * frame.slideHeight,
	};
}

/**
 * Build an SVG `d` attribute (slide pixels) tracing the motion the element will
 * make, so the canvas can draw the path where the shape will travel.
 */
export function motionPathToSvgD(path: string, frame: MotionPathFrame): string {
	const points = motionPathFractionPoints(path).map((point) => toPixels(point, frame));
	if (points.length === 0) {
		return '';
	}
	const head = `M ${trimNumber(frame.originX)} ${trimNumber(frame.originY)}`;
	const rest = points.map((point) => `L ${trimNumber(point.x)} ${trimNumber(point.y)}`);
	return [head, ...rest].join(' ');
}

/** The path's final waypoint in slide pixels (the draggable end handle). */
export function motionPathEndPixel(path: string, frame: MotionPathFrame): MotionPixelPoint {
	const points = motionPathFractionPoints(path);
	// Indexed rather than `.at(-1)`: Angular vendors this file and compiles it
	// against an ES2021 lib, where `Array.prototype.at` does not exist.
	const last = points.length > 0 ? points[points.length - 1] : undefined;
	return last ? toPixels(last, frame) : { x: frame.originX, y: frame.originY };
}

/** The path's final waypoint in slide fractions. */
export function motionPathEndFraction(path: string): MotionPixelPoint {
	// Indexed rather than `.at(-1)`: see the note in {@link motionPathEndPixel}.
	const points = motionPathFractionPoints(path);
	return points.length > 0 ? points[points.length - 1] : { x: 0, y: 0 };
}

/**
 * Move the path's end point to `(x, y)` (slide fractions), returning a new path
 * string. The last drawn command's endpoint is rewritten; a bezier's control
 * handles shift with it so the curve keeps its shape instead of kinking.
 * Returns the input unchanged for closed or unparseable paths, which have no
 * meaningful free end.
 */
export function setMotionPathEnd(path: string, x: number, y: number): string {
	const segments = scanPath(path);
	if (!segments) {
		return path;
	}
	// Reverse scan rather than `findLastIndex`: Angular vendors this file and
	// compiles it against an ES2021 lib, where that method does not exist.
	let lastIndex = -1;
	for (let i = segments.length - 1; i >= 0; i--) {
		if (segments[i].coords.length > 0) {
			lastIndex = i;
			break;
		}
	}
	if (lastIndex < 0 || segments.some((segment) => segment.cmd === 'Z' || segment.cmd === 'z')) {
		return path;
	}
	const last = segments[lastIndex];
	if (last.cmd === last.cmd.toLowerCase()) {
		// Relative commands would need the running cursor; not worth the risk.
		return path;
	}
	const coords = [...last.coords];
	const endX = coords[coords.length - 2];
	const endY = coords[coords.length - 1];
	const dx = x - endX;
	const dy = y - endY;
	coords[coords.length - 2] = x;
	coords[coords.length - 1] = y;
	if (last.cmd === 'C') {
		// Drag the trailing control point along so the tangent is preserved.
		coords[2] += dx;
		coords[3] += dy;
	}
	const next = segments.map((segment, index) =>
		index === lastIndex ? { ...last, coords } : segment,
	);
	return formatPath(next);
}

/**
 * Shift every absolute coordinate by `(dx, dy)` slide fractions: the "drag the
 * whole path" gesture. Relative commands are deltas and stay untouched.
 */
export function translateMotionPath(path: string, dx: number, dy: number): string {
	const segments = scanPath(path);
	if (!segments) {
		return path;
	}
	const moved = segments.map((segment) => {
		if (segment.cmd === segment.cmd.toLowerCase() || segment.coords.length === 0) {
			return segment;
		}
		return {
			cmd: segment.cmd,
			coords: segment.coords.map((value, index) => (index % 2 === 0 ? value + dx : value + dy)),
		};
	});
	return formatPath(moved);
}

/** Whether a path can be edited by {@link setMotionPathEnd} / drag handles. */
export function isEditableMotionPath(path: string): boolean {
	const segments = scanPath(path);
	if (!segments) {
		return false;
	}
	return !segments.some((segment) => segment.cmd === 'Z' || segment.cmd === 'z');
}

/**
 * Build the `@keyframes` block that plays a motion path.
 *
 * WHY pixels and not percentages: a CSS `translate(%)` resolves against the
 * ELEMENT's own box, while the path is a fraction of the SLIDE. A 25%-of-slide
 * move on a small shape would otherwise travel a fraction of the intended
 * distance, so the frame's slide size is baked in here.
 */
export function buildMotionPathKeyframes(args: {
	path: string;
	slideWidth: number;
	slideHeight: number;
	keyframeName: string;
}): { keyframeName: string; css: string } | undefined {
	const points = motionPathFractionPoints(args.path);
	if (points.length < 2) {
		return undefined;
	}
	const frames = points.map((point, index) => {
		const percent = Math.round((index / (points.length - 1)) * 100);
		const x = trimNumber(point.x * args.slideWidth);
		const y = trimNumber(point.y * args.slideHeight);
		return `\t${percent}% { transform: translate(${x}px, ${y}px); }`;
	});
	return {
		keyframeName: args.keyframeName,
		css: `@keyframes ${args.keyframeName} {\n${frames.join('\n')}\n}`,
	};
}
