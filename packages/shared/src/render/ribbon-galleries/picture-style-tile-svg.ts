/**
 * The Picture Styles tile: a small stock "photo" (sky, hill and sun) cut to
 * the style's geometry, framed, shadowed, reflected, soft-edged and tilted
 * the way the style is, so each tile reads like PowerPoint's own thumbnail.
 * Built only from catalogue data, never user input.
 *
 * @module render/ribbon-galleries/picture-style-tile-svg
 */
import { safeColor, svgId, svgTile } from './gallery-preview-svg';
import type { PictureStyleSpec } from './picture-styles-spec';

export const PICTURE_STYLE_TILE = { width: 64, height: 52 };

function num(value: number): string {
	return String(Math.round(value * 100) / 100);
}

/** Outline of preset `geom` in the box (x, y, w, h). */
function geometryPath(geom: string, x: number, y: number, w: number, h: number): string {
	const r = Math.min(w, h);
	const box = (d: string) => d.replace(/\s+/gu, ' ').trim();
	switch (geom) {
		case 'ellipse':
			return box(
				`M${num(x)} ${num(y + h / 2)} A${num(w / 2)} ${num(h / 2)} 0 1 0 ${num(x + w)} ${num(y + h / 2)}
				A${num(w / 2)} ${num(h / 2)} 0 1 0 ${num(x)} ${num(y + h / 2)} Z`,
			);
		case 'roundRect': {
			const c = r * 0.14;
			return box(
				`M${num(x + c)} ${num(y)} H${num(x + w - c)} Q${num(x + w)} ${num(y)} ${num(x + w)} ${num(y + c)}
				V${num(y + h - c)} Q${num(x + w)} ${num(y + h)} ${num(x + w - c)} ${num(y + h)} H${num(x + c)}
				Q${num(x)} ${num(y + h)} ${num(x)} ${num(y + h - c)} V${num(y + c)} Q${num(x)} ${num(y)} ${num(x + c)} ${num(y)} Z`,
			);
		}
		case 'round2DiagRect': {
			const c = r * 0.17;
			return box(
				`M${num(x + c)} ${num(y)} H${num(x + w)} V${num(y + h - c)} Q${num(x + w)} ${num(y + h)} ${num(x + w - c)} ${num(y + h)}
				H${num(x)} V${num(y + c)} Q${num(x)} ${num(y)} ${num(x + c)} ${num(y)} Z`,
			);
		}
		case 'snip2DiagRect': {
			const c = r * 0.17;
			return box(
				`M${num(x)} ${num(y)} H${num(x + w - c)} L${num(x + w)} ${num(y + c)} V${num(y + h)} H${num(x + c)} L${num(x)} ${num(y + h - c)} Z`,
			);
		}
		default:
			return `M${num(x)} ${num(y)} H${num(x + w)} V${num(y + h)} H${num(x)} Z`;
	}
}

/** A tilt for the perspective / rotated styles (a flat style returns ''). */
function tiltTransform(spec: PictureStyleSpec, cx: number, cy: number): string {
	const scene = spec.scene;
	if (!scene) {
		return '';
	}
	const rev = scene.rot?.[2] ?? 0;
	if (scene.camera === 'orthographicFront') {
		return rev ? ` transform="rotate(${num(rev / 60000)} ${num(cx)} ${num(cy)})"` : '';
	}
	const lon = scene.rot?.[1] ?? 0;
	const skew = lon > 10800000 ? 8 : lon > 0 ? -8 : 0;
	const lat = scene.rot?.[0] ?? 0;
	const squash = lat > 10800000 ? 0.9 : 1;
	return ` transform="translate(${num(cx)} ${num(cy)}) skewY(${skew}) scale(1 ${squash}) translate(${num(-cx)} ${num(-cy)})"`;
}

/** The tile for one picture style. */
export function pictureStyleTileSvg(spec: PictureStyleSpec): string {
	const id = svgId(`gps-${spec.key}`);
	const { width, height } = PICTURE_STYLE_TILE;
	const reflect = spec.reflection !== undefined;
	const pad = 9;
	const x = pad;
	const y = 6;
	const w = width - pad * 2;
	const h = height - y * 2 - (reflect ? 10 : 0);
	const outline = geometryPath(spec.geom, x, y, w, h);
	const stroke = spec.line ? Math.max(1, Math.min(6, (spec.line.w / 190500) * 4)) : 0;
	let defs =
		`<clipPath id="${id}-c"><path d="${outline}"/></clipPath>` +
		`<linearGradient id="${id}-s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7ec3ef"/><stop offset="1" stop-color="#d7eefb"/></linearGradient>`;
	let filter = '';
	if (spec.outer) {
		const alpha = /alpha:(\d+)/u.exec(spec.outer.color);
		const opacity = alpha ? Number(alpha[1]) / 100000 : 1;
		const rad = (((spec.outer.dir ?? 0) / 60000) * Math.PI) / 180;
		const dist = Math.min(3, (spec.outer.dist ?? 0) / 38100);
		defs += `<filter id="${id}-f" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="${num(Math.cos(rad) * dist)}" dy="${num(Math.sin(rad) * dist)}" stdDeviation="${num(Math.min(3, spec.outer.blur / 63500))}" flood-color="#000000" flood-opacity="${num(Math.min(0.8, opacity + 0.2))}"/></filter>`;
		filter = ` filter="url(#${id}-f)"`;
	} else if (spec.softEdge !== undefined) {
		defs += `<filter id="${id}-f" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2"/></filter>`;
		filter = ` filter="url(#${id}-f)"`;
	}
	const photo =
		`<g clip-path="url(#${id}-c)">` +
		`<rect x="${x}" y="${y}" width="${w}" height="${num(h)}" fill="url(#${id}-s)"/>` +
		`<circle cx="${num(x + w * 0.72)}" cy="${num(y + h * 0.3)}" r="${num(h * 0.13)}" fill="#ffd54a"/>` +
		`<path d="M${x} ${num(y + h)} L${num(x + w * 0.35)} ${num(y + h * 0.5)} L${num(x + w * 0.6)} ${num(y + h * 0.75)} L${num(x + w * 0.78)} ${num(y + h * 0.55)} L${num(x + w)} ${num(y + h * 0.8)} V${num(y + h)} Z" fill="#4c9a4a"/>` +
		`</g>`;
	const frame = spec.line
		? `<path d="${outline}" fill="none" stroke="${safeColor(spec.line.color, '#000000')}" stroke-width="${num(stroke)}"${spec.line.cmpd ? ` stroke-opacity="0.9"` : ''}/>${
				spec.line.cmpd
					? `<path d="${geometryPath(spec.geom, x + stroke, y + stroke, w - stroke * 2, h - stroke * 2)}" fill="none" stroke="${safeColor(spec.line.color, '#000000')}" stroke-width="0.8"/>`
					: ''
			}`
		: '';
	const bevel = spec.sp3d
		? `<path d="${outline}" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="1" transform="translate(-0.5 -0.5)"/>`
		: '';
	const body = `${photo}${frame}${bevel}`;
	let out = `<g${tiltTransform(spec, width / 2, y + h / 2)}><g${filter}>${body}</g>`;
	if (reflect) {
		const gy = y + h + 1;
		defs += `<linearGradient id="${id}-rg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${num((spec.reflection?.stA ?? 30000) / 100000 + 0.2)}"/><stop offset="0.6" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="${id}-m"><rect x="0" y="${num(gy)}" width="${width}" height="${num(h)}" fill="url(#${id}-rg)"/></mask>`;
		out += `<g mask="url(#${id}-m)"><g transform="translate(0 ${num(gy * 2)}) scale(1 -1)">${body}</g></g>`;
	}
	out += '</g>';
	return svgTile(width, height, defs, out);
}
