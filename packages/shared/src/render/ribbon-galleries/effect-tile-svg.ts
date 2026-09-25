/**
 * Tile previews the generic shape tile cannot draw: bevels (a lit/shaded
 * rim) and 3-D rotations (the square projected through the camera).
 *
 * @module render/ribbon-galleries/effect-tile-svg
 */
import { safeColor, svgId, svgTile } from './gallery-preview-svg';

function num(value: number): string {
	return String(Math.round(value * 100) / 100);
}

/** Rim width (share of the tile) and profile per bevel preset. */
const BEVEL_PROFILES: Record<string, { rim: number; inverted?: boolean; double?: boolean }> = {
	circle: { rim: 0.3 },
	relaxedInset: { rim: 0.14 },
	cross: { rim: 0.22, double: true },
	coolSlant: { rim: 0.34 },
	angle: { rim: 0.18 },
	softRound: { rim: 0.36 },
	convex: { rim: 0.26 },
	slope: { rim: 0.4 },
	divot: { rim: 0.2, inverted: true },
	riblet: { rim: 0.12, double: true },
	hardEdge: { rim: 0.1 },
	artDeco: { rim: 0.24, double: true },
};

/** A square in `color` with a lit top-left rim and a shaded bottom-right rim. */
export function bevelTileSvg(
	id: string,
	preset: string,
	color: string,
	size: { width: number; height: number },
): string {
	const sid = svgId(id);
	const profile = BEVEL_PROFILES[preset] ?? { rim: 0.2 };
	const inset = 6;
	const w = size.width - inset * 2;
	const h = size.height - inset * 2;
	const rim = Math.min(w, h) * profile.rim * 0.5;
	const [lit, dark] = profile.inverted ? ['#000000', '#ffffff'] : ['#ffffff', '#000000'];
	const fill = safeColor(color, '#4472c4');
	const defs = `<linearGradient id="${sid}-l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${lit}" stop-opacity="0.65"/><stop offset="0.5" stop-color="${lit}" stop-opacity="0"/><stop offset="0.5" stop-color="${dark}" stop-opacity="0"/><stop offset="1" stop-color="${dark}" stop-opacity="0.45"/></linearGradient>`;
	const ring = (d: number) =>
		`<rect x="${num(inset + d)}" y="${num(inset + d)}" width="${num(w - d * 2)}" height="${num(h - d * 2)}" fill="none" stroke="url(#${sid}-l)" stroke-width="${num(rim)}"/>`;
	let body = `<rect x="${inset}" y="${inset}" width="${num(w)}" height="${num(h)}" fill="${fill}"/>`;
	body += ring(rim / 2);
	if (profile.double) {
		body += ring(rim * 1.6);
	}
	return svgTile(size.width, size.height, defs, body);
}

/** Approximate projection of the unit square per camera family. */
function cameraMatrix(preset: string): [number, number, number, number] {
	const lower = preset.toLowerCase();
	const sign = lower.includes('right') ? -1 : 1;
	if (lower.startsWith('isometric')) {
		if (lower.includes('top') || lower.includes('bottom')) {
			return [0.8, lower.includes('bottom') ? -0.35 : 0.35, 0.45, 0.6];
		}
		return [0.75, 0.35 * sign, 0, 0.8];
	}
	if (lower.startsWith('oblique')) {
		return [0.8, 0, lower.includes('left') ? -0.3 : 0.3, 0.8];
	}
	if (lower.includes('above') || lower.includes('below')) {
		return [0.9, 0, 0, 0.55];
	}
	if (lower.includes('left') || lower.includes('right')) {
		return [0.65, 0.18 * sign, 0, 0.85];
	}
	return [0.8, 0, 0, 0.8];
}

/** A square in `color` as the camera preset sees it. */
export function rotationTileSvg(
	preset: string,
	color: string,
	size: { width: number; height: number },
): string {
	const [a, b, c, d] = cameraMatrix(preset);
	const cx = size.width / 2;
	const cy = size.height / 2;
	const half = Math.min(size.width, size.height) / 2 - 6;
	const corners = [
		[-1, -1],
		[1, -1],
		[1, 1],
		[-1, 1],
	].map(([x, y]) => `${num(cx + (a * x + c * y) * half)},${num(cy + (b * x + d * y) * half)}`);
	const fill = safeColor(color, '#4472c4');
	return svgTile(
		size.width,
		size.height,
		'',
		`<polygon points="${corners.join(' ')}" fill="${fill}" stroke="#000000" stroke-opacity="0.25" stroke-width="1"/>`,
	);
}
