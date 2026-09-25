/**
 * SmartArt Design gallery tiles: a three-box process diagram, filled in a
 * colour scheme's theme accents, or in Accent 1 with a style's effect.
 *
 * @module render/ribbon-galleries/smartart-gallery-tiles
 */
import type { SmartArtStyle } from 'pptx-viewer-core';

import { safeColor, svgId, svgTile } from './gallery-preview-svg';

function num(value: number): string {
	return String(Math.round(value * 100) / 100);
}

/** Three boxes with arrow gaps, filled with `fills` (cycled) and an optional effect. */
export function smartArtTileSvg(
	id: string,
	fills: readonly string[],
	style: SmartArtStyle,
	size: { width: number; height: number },
): string {
	const safeId = svgId(`sat-${id}`);
	const pad = 4;
	const gap = 4;
	const w = (size.width - pad * 2 - gap * 2) / 3;
	const h = size.height * 0.46;
	const y = (size.height - h) / 2;
	let defs = '';
	let filter = '';
	if (style !== 'flat') {
		const intense = style === 'intense';
		defs += `<filter id="${safeId}-s" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="${intense ? 1.6 : 0.9}" stdDeviation="${intense ? 1.2 : 0.7}" flood-color="#000000" flood-opacity="${intense ? 0.45 : 0.3}"/></filter>`;
		filter = ` filter="url(#${safeId}-s)"`;
	}
	const boxes: string[] = [];
	for (let i = 0; i < 3; i++) {
		const color = safeColor(fills[i % fills.length], '#4472C4');
		let paint = color;
		if (style === 'intense') {
			defs += `<linearGradient id="${safeId}-g${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity="0.8"/><stop offset="1" stop-color="${color}"/></linearGradient>`;
			paint = `url(#${safeId}-g${i})`;
		}
		const x = pad + i * (w + gap);
		boxes.push(
			`<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" rx="${num(Math.min(w, h) * 0.12)}" fill="${paint}" stroke="#FFFFFF" stroke-width="0.75"${filter}/>`,
		);
	}
	const bg = `<rect x="0" y="0" width="${size.width}" height="${size.height}" fill="#FFFFFF"/>`;
	return svgTile(size.width, size.height, defs, bg + boxes.join(''));
}
