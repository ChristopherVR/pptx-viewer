/**
 * SVG builders for gallery tiles. Every tile is one self-contained `<svg>`
 * string, so each binding injects it verbatim (`dangerouslySetInnerHTML`,
 * `v-html`, `[innerHTML]` through a trusted value, `{@html}`, `innerHTML`)
 * and the five galleries cannot drift in how a preset LOOKS.
 *
 * Inputs are catalogue data and theme colours only; {@link escapeSvgText} and
 * {@link safeColor} still guard every interpolated value.
 *
 * @module render/ribbon-galleries/gallery-preview-svg
 */
import type { ShapeStyle } from 'pptx-viewer-core';

/** A paint for a tile: flat colour or a linear gradient. */
export interface TilePaint {
	color?: string;
	opacity?: number;
	/** Gradient stops (position 0-100). */
	stops?: ReadonlyArray<{ color: string; position: number; opacity?: number }>;
	/** Gradient angle in degrees (OOXML `lin/@ang` / 60000). */
	angle?: number;
}

/** The decoration a shape/text tile can carry. */
export interface TileEffects {
	shadow?: {
		color: string;
		opacity: number;
		blur: number;
		dx: number;
		dy: number;
		inner?: boolean;
	};
	glow?: { color: string; opacity: number; radius: number };
	softEdge?: number;
	reflection?: { startOpacity: number; endPosition: number; distance: number };
}

/** Escape text for an SVG text node or attribute. */
export function escapeSvgText(text: string): string {
	return text
		.replace(/&/gu, '&amp;')
		.replace(/</gu, '&lt;')
		.replace(/>/gu, '&gt;')
		.replace(/"/gu, '&quot;');
}

/** A colour safe to put in an attribute: hex, rgb()/rgba(), or `none`. */
export function safeColor(color: string | undefined, fallback = 'none'): string {
	if (!color) {
		return fallback;
	}
	const c = color.trim();
	if (/^#[0-9a-f]{3,8}$/iu.test(c) || /^rgba?\([\d\s.,%]+\)$/iu.test(c) || c === 'none') {
		return c;
	}
	if (c === 'transparent') {
		return 'none';
	}
	return fallback;
}

function num(value: number): string {
	return String(Math.round(value * 100) / 100);
}

/** `id` made safe for an SVG id / url() reference. */
export function svgId(raw: string): string {
	return raw.replace(/[^\w-]/gu, '_');
}

/** Build the `fill` attribute value plus any `<defs>` it needs. */
export function paintDefs(
	paint: TilePaint | undefined,
	id: string,
): { defs: string; fill: string } {
	if (!paint) {
		return { defs: '', fill: 'none' };
	}
	if (paint.stops && paint.stops.length > 1) {
		const rad = (((paint.angle ?? 90) % 360) * Math.PI) / 180;
		const x = Math.cos(rad) / 2;
		const y = Math.sin(rad) / 2;
		const stops = paint.stops
			.map(
				(s) =>
					`<stop offset="${num(s.position)}%" stop-color="${safeColor(s.color, '#000000')}"${
						s.opacity !== undefined && s.opacity < 1 ? ` stop-opacity="${num(s.opacity)}"` : ''
					}/>`,
			)
			.join('');
		const defs = `<linearGradient id="${id}" x1="${num(0.5 - x)}" y1="${num(0.5 - y)}" x2="${num(0.5 + x)}" y2="${num(0.5 + y)}">${stops}</linearGradient>`;
		return { defs, fill: `url(#${id})` };
	}
	return { defs: '', fill: safeColor(paint.color) };
}

function filterDefs(effects: TileEffects | undefined, id: string): { defs: string; attr: string } {
	if (!effects) {
		return { defs: '', attr: '' };
	}
	const parts: string[] = [];
	if (effects.glow) {
		const g = effects.glow;
		parts.push(
			`<feMorphology in="SourceAlpha" operator="dilate" radius="${num(g.radius / 2)}" result="gd"/>`,
			`<feGaussianBlur in="gd" stdDeviation="${num(g.radius / 2)}" result="gb"/>`,
			`<feFlood flood-color="${safeColor(g.color, '#000000')}" flood-opacity="${num(g.opacity)}"/>`,
			'<feComposite in2="gb" operator="in" result="glow"/>',
		);
	}
	if (effects.shadow && !effects.shadow.inner) {
		const s = effects.shadow;
		parts.push(
			`<feDropShadow dx="${num(s.dx)}" dy="${num(s.dy)}" stdDeviation="${num(s.blur / 2)}" flood-color="${safeColor(s.color, '#000000')}" flood-opacity="${num(s.opacity)}" result="shadow"/>`,
		);
	}
	if (effects.softEdge) {
		parts.push(
			`<feGaussianBlur in="SourceGraphic" stdDeviation="${num(effects.softEdge / 2)}" result="soft"/>`,
		);
	}
	if (parts.length === 0) {
		return { defs: '', attr: '' };
	}
	const merge: string[] = [];
	if (effects.glow) merge.push('<feMergeNode in="glow"/>');
	merge.push(
		`<feMergeNode in="${effects.shadow && !effects.shadow.inner ? 'shadow' : effects.softEdge ? 'soft' : 'SourceGraphic'}"/>`,
	);
	const defs = `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">${parts.join('')}<feMerge>${merge.join('')}</feMerge></filter>`;
	return { defs, attr: ` filter="url(#${id})"` };
}

/** The shared shell every tile uses. */
export function svgTile(width: number, height: number, defs: string, body: string): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`;
}

export interface ShapeTileSpec {
	id: string;
	width: number;
	height: number;
	fill?: TilePaint;
	stroke?: { color: string; width: number; opacity?: number; dash?: string };
	effects?: TileEffects;
	/** Preview text drawn centred inside the shape. */
	text?: { value: string; color: string };
	/** `rect` (default), `roundRect` or `ellipse`. */
	geometry?: 'rect' | 'roundRect' | 'ellipse';
	inset?: number;
}

/** A shape tile: the preview for shape, picture and effect presets. */
export function shapeTileSvg(spec: ShapeTileSpec): string {
	const id = svgId(spec.id);
	const inset = spec.inset ?? 6;
	const w = spec.width - inset * 2;
	const h = spec.height - inset * 2 - (spec.effects?.reflection ? h3(spec) : 0);
	const paint = paintDefs(spec.fill, `${id}-f`);
	const filter = filterDefs(spec.effects, `${id}-x`);
	const stroke =
		spec.stroke && spec.stroke.width > 0
			? ` stroke="${safeColor(spec.stroke.color, '#000000')}" stroke-width="${num(Math.min(spec.stroke.width, 6))}"${spec.stroke.opacity !== undefined && spec.stroke.opacity < 1 ? ` stroke-opacity="${num(spec.stroke.opacity)}"` : ''}${spec.stroke.dash ? ` stroke-dasharray="${spec.stroke.dash}"` : ''}`
			: '';
	const fillOpacity =
		spec.fill?.opacity !== undefined && spec.fill.opacity < 1
			? ` fill-opacity="${num(spec.fill.opacity)}"`
			: '';
	const shape = geometryMarkup(
		spec.geometry,
		inset,
		inset,
		w,
		h,
		`fill="${paint.fill}"${fillOpacity}${stroke}${filter.attr}`,
	);
	let body = shape;
	if (spec.effects?.reflection) {
		const r = spec.effects.reflection;
		const gy = inset + h + r.distance;
		body += `<g opacity="${num(r.startOpacity)}" transform="translate(0 ${num(gy * 2)}) scale(1 -1)" mask="url(#${id}-m)">${geometryMarkup(spec.geometry, inset, inset, w, h, `fill="${paint.fill}"${stroke}`)}</g>`;
		paint.defs += `<linearGradient id="${id}-mg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="${num(r.endPosition)}" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="${id}-m"><rect x="0" y="${num(gy)}" width="${spec.width}" height="${num(h)}" fill="url(#${id}-mg)"/></mask>`;
	}
	if (spec.effects?.shadow?.inner) {
		const s = spec.effects.shadow;
		body += geometryMarkup(
			spec.geometry,
			inset + s.dx / 2,
			inset + s.dy / 2,
			w - Math.abs(s.dx),
			h - Math.abs(s.dy),
			`fill="none" stroke="${safeColor(s.color, '#000000')}" stroke-opacity="${num(s.opacity / 2)}" stroke-width="${num(Math.max(1, s.blur / 2))}"`,
		);
	}
	if (spec.text) {
		body += `<text x="${num(inset + w / 2)}" y="${num(inset + h / 2)}" text-anchor="middle" dominant-baseline="central" font-family="Calibri, Arial, sans-serif" font-size="${num(Math.min(h * 0.55, 14))}" fill="${safeColor(spec.text.color, '#000000')}">${escapeSvgText(spec.text.value)}</text>`;
	}
	return svgTile(spec.width, spec.height, paint.defs + filter.defs, body);
}

function h3(spec: ShapeTileSpec): number {
	return Math.round((spec.height - (spec.inset ?? 6) * 2) * 0.3);
}

function geometryMarkup(
	geometry: ShapeTileSpec['geometry'],
	x: number,
	y: number,
	w: number,
	h: number,
	attrs: string,
): string {
	if (geometry === 'ellipse') {
		return `<ellipse cx="${num(x + w / 2)}" cy="${num(y + h / 2)}" rx="${num(w / 2)}" ry="${num(h / 2)}" ${attrs}/>`;
	}
	const r = geometry === 'roundRect' ? Math.min(w, h) * 0.18 : 1.5;
	return `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" rx="${num(r)}" ${attrs}/>`;
}

/** Map a flat `ShapeStyle` (as the load path resolves it) to tile inputs. */
export function tileSpecFromShapeStyle(
	id: string,
	style: ShapeStyle,
	size: { width: number; height: number },
	textColor?: string,
): ShapeTileSpec {
	const fill: TilePaint | undefined =
		style.fillMode === 'none'
			? undefined
			: style.fillMode === 'gradient' && style.fillGradientStops?.length
				? {
						stops: style.fillGradientStops,
						angle: style.fillGradientAngle,
						opacity: style.fillOpacity,
					}
				: { color: style.fillColor, opacity: style.fillOpacity };
	const strokeWidthPx = style.strokeWidth ?? 0;
	return {
		id,
		...size,
		fill,
		stroke:
			style.strokeColor && style.strokeColor !== 'transparent' && strokeWidthPx > 0
				? {
						color: style.strokeColor,
						width: Math.max(1, strokeWidthPx),
						opacity: style.strokeOpacity,
					}
				: undefined,
		effects: style.shadowColor
			? {
					shadow: {
						color: style.shadowColor,
						opacity: style.shadowOpacity ?? 0.4,
						blur: Math.min(style.shadowBlur ?? 4, 6),
						dx: Math.max(-3, Math.min(3, style.shadowOffsetX ?? 0)),
						dy: Math.max(-3, Math.min(3, style.shadowOffsetY ?? 2)),
					},
				}
			: undefined,
		text: textColor ? { value: 'Abc', color: textColor } : undefined,
	};
}
