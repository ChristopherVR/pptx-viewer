/**
 * OOXML gradient fill (`a:gradFill`) → SVG paint server.
 *
 * The CSS resolvers in `fill-style.ts` cover every shape a binding paints as an
 * HTML box (a `background-image` clipped by `clip-path`). Freeform geometry is
 * different: `a:custGeom` shapes are painted as a real SVG `<path>`, and an SVG
 * `fill` attribute cannot take a CSS gradient. Renderers therefore fell back to
 * the parser's *representative* solid colour, so a freeform authored with a
 * left-to-right fade rendered as one flat block and any transparent region of
 * the gradient became opaque (issue #132).
 *
 * This module converts the same structured `ShapeStyle` gradient data into an
 * SVG `<linearGradient>` / `<radialGradient>` descriptor plus the `url(#id)`
 * reference to put in `fill`. It stays framework-agnostic: JSX/template
 * bindings read {@link SvgGradientDef} and emit their own elements, while
 * string-building bindings can use {@link svgGradientMarkup}.
 *
 * Reference: ECMA-376 Part 1, §20.1.8.35 (gradFill) and §20.1.8.49 (path).
 */
import type { ShapeStyle } from 'pptx-viewer-core';

import { computeGradientCenter, sanitizeGradientStops } from './fill-style';
import type { SvgRectPathGradientDef } from './svg-gradient-rect-path';
import { buildRectPathGradientDef, rectPathGradientMarkup } from './svg-gradient-rect-path';
import type { SvgPatternDef } from './svg-stroke-pattern-paint';
import { escapeSvgAttr } from './visual-effects';

// Re-exported so existing `import { buildSvgStrokePatternDef } from
// 'pptx-viewer-shared'` call sites (this file's own barrel neighbour,
// `svg-gradient-paint.test.ts`, etc.) keep working unchanged after the split.
export type { SvgPatternDef } from './svg-stroke-pattern-paint';
export { buildSvgStrokePatternDef } from './svg-stroke-pattern-paint';

/** One `<stop>` of an SVG gradient. */
export interface SvgGradientStopDef {
	/** Stop offset as a fraction of the gradient line (0-1). */
	offset: number;
	/** Stop colour as `#RRGGBB`. */
	color: string;
	/** Stop alpha (0-1). Omitted when the stop is fully opaque. */
	opacity?: number;
}

/** An SVG `<linearGradient>` in `objectBoundingBox` units. */
export interface SvgLinearGradientDef {
	kind: 'linear';
	id: string;
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	stops: SvgGradientStopDef[];
}

/** An SVG `<radialGradient>` in `objectBoundingBox` units. */
export interface SvgRadialGradientDef {
	kind: 'radial';
	id: string;
	cx: number;
	cy: number;
	r: number;
	stops: SvgGradientStopDef[];
}

export type { SvgRectPathGradientDef } from './svg-gradient-rect-path';

/** Either flavour of SVG gradient produced by {@link buildSvgGradientDef}. */
export type SvgGradientDef = SvgLinearGradientDef | SvgRadialGradientDef | SvgRectPathGradientDef;

/** Round to 4 decimals so the emitted markup stays stable and compact. */
function round4(value: number): number {
	return Math.round(value * 10000) / 10000;
}

/**
 * Namespace a gradient id to its owning element. SVG ids are document-global,
 * so two shapes with different gradients would otherwise collide on the first
 * one rendered; element ids carry `/` and `.` (`ppt/slides/slide2.xml-shape-4`),
 * which are not valid in a bare `url(#…)` fragment.
 */
export function svgGradientId(elementId: string, suffix = 'grad'): string {
	const seed = String(elementId).replace(/[^a-zA-Z0-9_-]/gu, '_');
	return `pptx-${suffix}-${seed}`;
}

/** Convert sanitized 0-100 gradient stops into SVG 0-1 offsets. */
function toSvgStops(stops: ShapeStyle['fillGradientStops']): SvgGradientStopDef[] {
	return sanitizeGradientStops(stops).map((stop) => ({
		offset: round4(stop.position / 100),
		color: stop.color,
		...(typeof stop.opacity === 'number' ? { opacity: round4(stop.opacity) } : {}),
	}));
}

/**
 * Endpoints of the gradient line for an OOXML `a:lin/@ang`, in
 * `objectBoundingBox` units.
 *
 * `ang` is measured clockwise from the positive x-axis with y pointing down, so
 * the direction vector is `(cos a, sin a)` with no CSS-style quarter turn: SVG
 * shares OOXML's axis convention. The line is centred on the box and extended by
 * `|dx| + |dy|`, the projection of the unit square onto that direction, so the
 * first and last stops land exactly on the box edges the way PowerPoint draws
 * them.
 *
 * `a:lin/@scaled="1"` (the default) means the angle is measured in the shape's
 * unit square and then stretched to the real box - which is precisely what
 * `gradientUnits="objectBoundingBox"` does, so the raw angle is used as-is and
 * no aspect correction is applied here (unlike the CSS path, where the stretch
 * has to be simulated).
 */
function linearEndpoints(angleDegrees: number): { x1: number; y1: number; x2: number; y2: number } {
	const radians = (angleDegrees * Math.PI) / 180;
	const dx = Math.cos(radians);
	const dy = Math.sin(radians);
	const span = (Math.abs(dx) + Math.abs(dy)) / 2;
	return {
		x1: round4(0.5 - dx * span),
		y1: round4(0.5 - dy * span),
		x2: round4(0.5 + dx * span),
		y2: round4(0.5 + dy * span),
	};
}

/** The parts of a gradient a paint server needs, from either a fill or a line. */
interface GradientSource {
	stops: SvgGradientStopDef[];
	type: ShapeStyle['fillGradientType'];
	/** `a:path/@type`: only `rect` gets the nested-rectangle band treatment; `circle`/`shape` stay elliptical. */
	pathType?: ShapeStyle['fillGradientPathType'];
	angle: number | undefined;
	fillToRect?: ShapeStyle['fillGradientFillToRect'];
	focalPoint?: ShapeStyle['fillGradientFocalPoint'];
}

/** Shared builder behind the fill and stroke entry points. */
function buildFromSource(source: GradientSource, id: string): SvgGradientDef | undefined {
	const { stops } = source;
	if (stops.length === 0) {
		return undefined;
	}

	if ((source.type || 'linear') === 'radial') {
		if ((source.pathType || 'circle') === 'rect') {
			// The true field is nested axis-aligned rectangles (Chebyshev distance),
			// which SVG's native <radialGradient> cannot express; delegate to the
			// dedicated rect-path pattern builder (`svg-gradient-rect-path.ts`).
			return buildRectPathGradientDef(stops, id, source.focalPoint, source.fillToRect);
		}
		// Path gradients run from the `fillToRect` outwards, so stop 0 sits at the
		// centre exactly as an SVG radial gradient's offset 0 does.
		const { cx, cy } = computeGradientCenter(source.fillToRect, source.focalPoint);
		const fx = cx / 100;
		const fy = cy / 100;
		// Reach the farthest corner of the box, mirroring CSS's default
		// `farthest-corner` sizing, so the last stop is not cropped mid-shape.
		const r = Math.hypot(Math.max(fx, 1 - fx), Math.max(fy, 1 - fy));
		return { kind: 'radial', id, cx: round4(fx), cy: round4(fy), r: round4(r), stops };
	}

	const angle =
		typeof source.angle === 'number' && Number.isFinite(source.angle) ? source.angle : 90;
	return { kind: 'linear', id, ...linearEndpoints(angle), stops };
}

/**
 * Build the SVG paint-server definition for a shape's gradient FILL.
 *
 * Returns `undefined` unless the style is a gradient with usable structured
 * stops; callers keep their solid-colour path in that case (a prebuilt
 * `fillGradient` CSS string cannot be expressed as an SVG paint server).
 *
 * `a:gradFill/@flip` and `a:tileRect` are not modelled: SVG `spreadMethod` has
 * no per-tile mirror and freeform gradients in practice author neither.
 *
 * @param style     - The resolved shape style carrying the gradient.
 * @param elementId - The owning element id, used to namespace the gradient id.
 */
export function buildSvgGradientDef(
	style: ShapeStyle | undefined,
	elementId: string,
): SvgGradientDef | undefined {
	if (!style || style.fillMode !== 'gradient') {
		return undefined;
	}
	return buildFromSource(
		{
			stops: toSvgStops(style.fillGradientStops),
			type: style.fillGradientType,
			pathType: style.fillGradientPathType,
			angle: style.fillGradientAngle,
			fillToRect: style.fillGradientFillToRect,
			focalPoint: style.fillGradientFocalPoint,
		},
		svgGradientId(elementId),
	);
}

/**
 * Build the SVG paint-server definition for a shape's gradient OUTLINE
 * (`a:ln/a:gradFill`).
 *
 * A CSS `border` can only take one colour, so a gradient outline was painted
 * with the parser's averaged `strokeColor`: a two-tone outline came out flat and
 * a fade-to-transparent one came out fully opaque. Stroking an SVG path with
 * this paint server renders it properly.
 *
 * The id is namespaced separately from the fill's, so a shape with BOTH a
 * gradient fill and a gradient outline gets two distinct paint servers.
 */
export function buildSvgStrokeGradientDef(
	style: ShapeStyle | undefined,
	elementId: string,
): SvgGradientDef | undefined {
	if (!style || style.strokeFillMode !== 'gradient') {
		return undefined;
	}
	return buildFromSource(
		{
			stops: toSvgStops(style.strokeGradientStops),
			type: style.strokeGradientType,
			pathType: style.strokeGradientPathType,
			angle: style.strokeGradientAngle,
		},
		svgGradientId(elementId, 'stroke'),
	);
}

/** The `fill`/`stroke` attribute value that references a built definition. */
export function svgGradientFillRef(def: SvgGradientDef | SvgPatternDef): string {
	return `url(#${def.id})`;
}

/** Coerces a value to a finite number and escapes it, for numeric attributes built into markup. */
function numAttr(value: number): string {
	return escapeSvgAttr(String(Number.isFinite(value) ? value : 0));
}

/**
 * Serialise a definition to SVG markup, for bindings that build their DOM as a
 * string (the vanilla renderer) rather than through a component tree.
 *
 * Every interpolated field is escaped/coerced here even though upstream
 * builders already sanitize colours and ids: this is the string-concatenation
 * boundary that lands in `innerHTML`, so it stays safe on its own regardless
 * of how a `SvgGradientDef` was constructed.
 */
export function svgGradientMarkup(def: SvgGradientDef): string {
	if (def.kind === 'rectPath') {
		return rectPathGradientMarkup(def);
	}
	const id = escapeSvgAttr(def.id);
	const stops = def.stops
		.map(
			(stop) =>
				`<stop offset="${numAttr(stop.offset)}" stop-color="${escapeSvgAttr(stop.color)}"${
					typeof stop.opacity === 'number' ? ` stop-opacity="${numAttr(stop.opacity)}"` : ''
				}/>`,
		)
		.join('');
	if (def.kind === 'radial') {
		return `<radialGradient id="${id}" cx="${numAttr(def.cx)}" cy="${numAttr(def.cy)}" r="${numAttr(def.r)}">${stops}</radialGradient>`;
	}
	return `<linearGradient id="${id}" x1="${numAttr(def.x1)}" y1="${numAttr(def.y1)}" x2="${numAttr(def.x2)}" y2="${numAttr(def.y2)}">${stops}</linearGradient>`;
}
