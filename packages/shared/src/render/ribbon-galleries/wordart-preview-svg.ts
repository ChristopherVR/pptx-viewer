/**
 * "Abc" tiles for the WordArt Styles gallery, drawn from the same resolved
 * `TextStyle` fields a pick writes, so a tile looks like the text it makes.
 *
 * @module render/ribbon-galleries/wordart-preview-svg
 */
import type { TextStyle } from 'pptx-viewer-core';

import { paintDefs, safeColor, svgId, svgTile } from './gallery-preview-svg';
import type { TilePaint } from './gallery-preview-svg';

function num(value: number): string {
	return String(Math.round(value * 100) / 100);
}

function paintOf(style: Partial<TextStyle>): TilePaint | undefined {
	if (style.textFillNone) {
		return undefined;
	}
	if (style.textFillGradientStops?.length) {
		return {
			stops: style.textFillGradientStops.map((stop) => ({
				color: stop.color,
				position: stop.position,
				opacity: stop.opacity,
			})),
			angle: style.textFillGradientAngle,
		};
	}
	return { color: style.color ?? '#000000' };
}

function effectFilter(style: Partial<TextStyle>, id: string): { defs: string; attr: string } {
	const parts: string[] = [];
	const merge: string[] = [];
	if (style.textGlowColor) {
		const r = Math.min(3, (style.textGlowRadius ?? 4) / 2);
		parts.push(
			`<feMorphology in="SourceAlpha" operator="dilate" radius="${num(r / 2)}" result="gd"/>`,
			`<feGaussianBlur in="gd" stdDeviation="${num(r / 2)}" result="gb"/>`,
			`<feFlood flood-color="${safeColor(style.textGlowColor, '#000000')}" flood-opacity="${num(Math.min(0.8, (style.textGlowOpacity ?? 0.4) + 0.2))}"/>`,
			'<feComposite in2="gb" operator="in" result="glow"/>',
		);
		merge.push('<feMergeNode in="glow"/>');
	}
	if (style.textShadowColor) {
		const clamp = (v: number | undefined) => Math.max(-2, Math.min(2, (v ?? 0) / 2));
		parts.push(
			`<feDropShadow dx="${num(clamp(style.textShadowOffsetX))}" dy="${num(clamp(style.textShadowOffsetY))}" stdDeviation="${num(Math.min(1.5, (style.textShadowBlur ?? 2) / 4))}" flood-color="${safeColor(style.textShadowColor, '#000000')}" flood-opacity="${num(style.textShadowOpacity ?? 1)}" result="shadow"/>`,
		);
		merge.push('<feMergeNode in="shadow"/>');
	} else {
		merge.push('<feMergeNode in="SourceGraphic"/>');
	}
	if (parts.length === 0) {
		return { defs: '', attr: '' };
	}
	return {
		defs: `<filter id="${id}" x="-30%" y="-30%" width="160%" height="160%">${parts.join('')}<feMerge>${merge.join('')}</feMerge></filter>`,
		attr: ` filter="url(#${id})"`,
	};
}

/** A WordArt tile: "Abc" in the style's fill, outline and shadow/glow/reflection. */
export function wordArtTileSvg(
	rawId: string,
	style: Partial<TextStyle>,
	size: { width: number; height: number },
): string {
	const id = svgId(rawId);
	const paint = paintDefs(paintOf(style), `${id}-f`);
	const filter = effectFilter(style, `${id}-x`);
	const stroke =
		style.textOutlineColor && (style.textOutlineWidth ?? 1) > 0
			? ` stroke="${safeColor(style.textOutlineColor, '#000000')}" stroke-width="${num(Math.min(1.2, Math.max(0.4, (style.textOutlineWidth ?? 1) / 2)))}"`
			: '';
	const fontSize = Math.round(size.height * 0.46);
	const baseline = style.textReflection ? size.height * 0.56 : size.height * 0.66;
	const text = (attrs: string) =>
		`<text x="${num(size.width / 2)}" y="${num(baseline)}" text-anchor="middle" font-family="Calibri, Arial, sans-serif" font-size="${fontSize}"${style.bold ? ' font-weight="bold"' : ''} fill="${paint.fill}"${stroke}${attrs}>${style.textCaps === 'all' ? 'ABC' : 'Abc'}</text>`;
	let body = text(filter.attr);
	if (style.textReflection) {
		body += `<g opacity="${num(Math.min(0.5, style.textReflectionStartOpacity ?? 0.4))}" transform="translate(0 ${num(baseline * 2 + 2)}) scale(1 -1)">${text('')}</g>`;
	}
	return svgTile(size.width, size.height, paint.defs + filter.defs, body);
}
