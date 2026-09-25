/**
 * Tile previews for the chart galleries (Chart Styles, Change Colors, Quick
 * Layout): a small clustered-column chart in the given colours, and a
 * schematic of a Quick Layout's element set.
 *
 * @module render/ribbon-galleries/chart-gallery-tiles
 */
import { safeColor, svgTile } from './gallery-preview-svg';

function num(value: number): string {
	return String(Math.round(value * 100) / 100);
}

const HEIGHTS = [0.55, 0.8, 0.4, 0.95, 0.7, 0.5];

/** A clustered column chart: three categories of `colors.length` (max 4) bars. */
export function columnChartTileSvg(
	colors: readonly string[],
	size: { width: number; height: number },
): string {
	const series = colors.slice(0, 4);
	const pad = 4;
	const plotW = size.width - pad * 2;
	const plotH = size.height - pad * 2;
	const groupW = plotW / 3;
	const barW = (groupW * 0.8) / Math.max(series.length, 1);
	const bars: string[] = [];
	for (let g = 0; g < 3; g++) {
		series.forEach((color, s) => {
			const h = plotH * HEIGHTS[(g + s * 2) % HEIGHTS.length];
			const x = pad + g * groupW + groupW * 0.1 + s * barW;
			bars.push(
				`<rect x="${num(x)}" y="${num(pad + plotH - h)}" width="${num(barW * 0.9)}" height="${num(h)}" fill="${safeColor(color, '#808080')}"/>`,
			);
		});
	}
	const axis = `<line x1="${pad}" y1="${num(pad + plotH)}" x2="${num(pad + plotW)}" y2="${num(pad + plotH)}" stroke="#A6A6A6" stroke-width="0.75"/>`;
	const bg = `<rect x="0" y="0" width="${size.width}" height="${size.height}" fill="#FFFFFF"/>`;
	return svgTile(size.width, size.height, '', bg + bars.join('') + axis);
}

/** A horizontal strip of colour swatches (Change Colors rows). */
export function swatchStripSvg(
	colors: readonly string[],
	size: { width: number; height: number },
): string {
	const w = size.width / Math.max(colors.length, 1);
	const body = colors
		.map(
			(color, i) =>
				`<rect x="${num(i * w)}" y="0" width="${num(w)}" height="${size.height}" fill="${safeColor(color, '#808080')}"/>`,
		)
		.join('');
	return svgTile(size.width, size.height, '', body);
}

/** The elements a Quick Layout switches on, as its schematic tile draws them. */
export interface ChartLayoutSketch {
	title: boolean;
	legend: 'r' | 't' | 'b' | 'l' | null;
	dataLabels: boolean;
	catAxisTitle: boolean;
	valAxisTitle: boolean;
	majorGridlines: boolean;
	minorGridlines: boolean;
	valueAxis: boolean;
	dataTable: boolean;
}

const INK = '#7F7F7F';
const ACCENT = '#4472C4';

/** A schematic of a Quick Layout: title bar, legend box, axis titles, gridlines, labels, table. */
export function chartLayoutTileSvg(
	sketch: ChartLayoutSketch,
	size: { width: number; height: number },
): string {
	const parts: string[] = [
		`<rect x="0" y="0" width="${size.width}" height="${size.height}" fill="#FFFFFF"/>`,
	];
	let top = 3;
	let bottom = size.height - 3;
	let left = 3;
	let right = size.width - 3;
	const bar = (x: number, y: number, w: number, h: number, color = INK) =>
		parts.push(
			`<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" fill="${color}"/>`,
		);
	if (sketch.title) {
		bar(size.width * 0.3, top, size.width * 0.4, 3);
		top += 6;
	}
	if (sketch.legend === 't') {
		bar(size.width * 0.35, top, size.width * 0.3, 2, ACCENT);
		top += 5;
	} else if (sketch.legend === 'b' && !sketch.dataTable) {
		bar(size.width * 0.35, bottom - 2, size.width * 0.3, 2, ACCENT);
		bottom -= 5;
	} else if (sketch.legend === 'r') {
		bar(right - 6, (top + bottom) / 2 - 5, 6, 10, ACCENT);
		right -= 9;
	} else if (sketch.legend === 'l') {
		bar(left, (top + bottom) / 2 - 5, 6, 10, ACCENT);
		left += 9;
	}
	if (sketch.dataTable) {
		const rows = 3;
		for (let r = 0; r < rows; r++) {
			parts.push(
				`<rect x="${num(left + 4)}" y="${num(bottom - (rows - r) * 3)}" width="${num(right - left - 4)}" height="3" fill="none" stroke="${INK}" stroke-width="0.5"/>`,
			);
		}
		bottom -= rows * 3 + 2;
	}
	if (sketch.catAxisTitle) {
		bar((left + right) / 2 - 6, bottom - 2, 12, 2);
		bottom -= 4;
	}
	if (sketch.valAxisTitle) {
		bar(left, (top + bottom) / 2 - 6, 2, 12);
		left += 4;
	}
	if (sketch.valueAxis) {
		left += 3;
	}
	const plotH = bottom - top;
	if (sketch.majorGridlines || sketch.minorGridlines) {
		const lines = sketch.minorGridlines ? 6 : 3;
		for (let i = 0; i < lines; i++) {
			const y = top + (plotH * i) / lines;
			parts.push(
				`<line x1="${num(left)}" y1="${num(y)}" x2="${num(right)}" y2="${num(y)}" stroke="#D9D9D9" stroke-width="${sketch.minorGridlines && i % 2 ? '0.4' : '0.7'}"/>`,
			);
		}
	}
	const heights = [0.5, 0.8, 0.65];
	const w = (right - left) / 7;
	heights.forEach((h, i) => {
		const x = left + w * (1 + i * 2);
		bar(x, bottom - plotH * h, w, plotH * h, ACCENT);
		if (sketch.dataLabels) {
			bar(x + w * 0.2, bottom - plotH * h - 2.5, w * 0.6, 1.5);
		}
	});
	parts.push(
		`<line x1="${num(left)}" y1="${num(bottom)}" x2="${num(right)}" y2="${num(bottom)}" stroke="${INK}" stroke-width="0.6"/>`,
	);
	return svgTile(size.width, size.height, '', parts.join(''));
}
