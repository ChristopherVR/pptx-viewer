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

/** Either flavour of SVG gradient produced by {@link buildSvgGradientDef}. */
export type SvgGradientDef = SvgLinearGradientDef | SvgRadialGradientDef;

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
function toSvgStops(style: ShapeStyle): SvgGradientStopDef[] {
	return sanitizeGradientStops(style.fillGradientStops).map((stop) => ({
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

/**
 * Build the SVG paint-server definition for a shape's gradient fill.
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
	const stops = toSvgStops(style);
	if (stops.length === 0) {
		return undefined;
	}
	const id = svgGradientId(elementId);

	if ((style.fillGradientType || 'linear') === 'radial') {
		// Path gradients run from the `fillToRect` outwards, so stop 0 sits at the
		// centre exactly as an SVG radial gradient's offset 0 does.
		const { cx, cy } = computeGradientCenter(
			style.fillGradientFillToRect,
			style.fillGradientFocalPoint,
		);
		const fx = cx / 100;
		const fy = cy / 100;
		// Reach the farthest corner of the box, mirroring CSS's default
		// `farthest-corner` sizing, so the last stop is not cropped mid-shape.
		const r = Math.hypot(Math.max(fx, 1 - fx), Math.max(fy, 1 - fy));
		return { kind: 'radial', id, cx: round4(fx), cy: round4(fy), r: round4(r), stops };
	}

	const angle =
		typeof style.fillGradientAngle === 'number' && Number.isFinite(style.fillGradientAngle)
			? style.fillGradientAngle
			: 90;
	return { kind: 'linear', id, ...linearEndpoints(angle), stops };
}

/** The `fill`/`stroke` attribute value that references a built definition. */
export function svgGradientFillRef(def: SvgGradientDef): string {
	return `url(#${def.id})`;
}

/**
 * Serialise a definition to SVG markup, for bindings that build their DOM as a
 * string (the vanilla renderer) rather than through a component tree.
 */
export function svgGradientMarkup(def: SvgGradientDef): string {
	const stops = def.stops
		.map(
			(stop) =>
				`<stop offset="${stop.offset}" stop-color="${stop.color}"${
					typeof stop.opacity === 'number' ? ` stop-opacity="${stop.opacity}"` : ''
				}/>`,
		)
		.join('');
	if (def.kind === 'radial') {
		return `<radialGradient id="${def.id}" cx="${def.cx}" cy="${def.cy}" r="${def.r}">${stops}</radialGradient>`;
	}
	return `<linearGradient id="${def.id}" x1="${def.x1}" y1="${def.y1}" x2="${def.x2}" y2="${def.y2}">${stops}</linearGradient>`;
}
