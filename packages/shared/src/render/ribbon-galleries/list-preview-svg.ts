/**
 * Bullet / Numbering Library tiles: three list lines, each a marker and a
 * grey text bar, or the word "None".
 *
 * @module render/ribbon-galleries/list-preview-svg
 */
import { escapeSvgText, svgTile } from './gallery-preview-svg';

export const LIST_TILE = { width: 64, height: 64 };

/** Three lines led by `markers`, or a "None" tile when `markers` is null. */
export function listTileSvg(markers: readonly string[] | null, noneLabel = 'None'): string {
	const { width, height } = LIST_TILE;
	const frame = `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#c8c8c8"/>`;
	if (!markers) {
		return svgTile(
			width,
			height,
			'',
			`${frame}<text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="central" font-family="Calibri, Arial, sans-serif" font-size="12" fill="#404040">${escapeSvgText(noneLabel)}</text>`,
		);
	}
	const lines = markers
		.map((marker, index) => {
			const y = 16 + index * 16;
			return `<text x="17" y="${y}" text-anchor="end" dominant-baseline="central" font-family="Segoe UI Symbol, Arial, sans-serif" font-size="10" fill="#202020">${escapeSvgText(marker)}</text><rect x="21" y="${y - 1.5}" width="${width - 29}" height="3" fill="#a6a6a6"/>`;
		})
		.join('');
	return svgTile(width, height, '', frame + lines);
}
