/**
 * The Table Styles gallery tile: a 5 x 5 mini table (header row + banded
 * rows) painted through the SAME resolver the slide renderer uses
 * (`getTableCellBandStyle`), so a tile shows exactly what a pick will render.
 *
 * @module render/ribbon-galleries/table-style-tile-svg
 */
import type { PptxTableData, PptxThemeColorScheme } from 'pptx-viewer-core';

import type { TableCellCss } from '../table-style';
import { getTableCellBandStyle } from '../table-style';
import { safeColor, svgTile } from './gallery-preview-svg';

const ROWS = 5;
const COLS = 5;

function num(value: number): string {
	return String(Math.round(value * 100) / 100);
}

/** A cell's paint: its background colour, or the flat colour inside a CSS `background`. */
function cellFill(css: TableCellCss): string {
	const bg = css.backgroundColor;
	if (typeof bg === 'string' && bg !== 'transparent') {
		return safeColor(bg);
	}
	const layered = css.background;
	if (typeof layered === 'string') {
		const match = /rgba?\([^)]*\)|#[0-9a-f]{6}/iu.exec(layered);
		return match ? safeColor(match[0]) : 'none';
	}
	return 'none';
}

/** `"1px solid #FFFFFF"` -> a stroke, or null for `none` / an unknown value. */
function border(value: string | number | undefined): { width: number; color: string } | null {
	if (typeof value !== 'string' || value === 'none') {
		return null;
	}
	const match = /^([\d.]+)px\s+\w+\s+(.+)$/u.exec(value.trim());
	if (!match) {
		return null;
	}
	const color = safeColor(match[2], 'none');
	return color === 'none'
		? null
		: { width: Math.min(Math.max(Number(match[1]) / 2, 0.5), 2), color };
}

/** The mini-table tile for built-in style `styleId` under `colorScheme`. */
export function tableStyleTileSvg(
	styleId: string,
	colorScheme: PptxThemeColorScheme,
	size: { width: number; height: number },
): string {
	const tableData: PptxTableData = {
		rows: [],
		columnWidths: [],
		firstRowHeader: true,
		bandedRows: true,
		tableStyleId: styleId,
	};
	const inset = 2;
	const cw = (size.width - inset * 2) / COLS;
	const rh = (size.height - inset * 2) / ROWS;
	const fills: string[] = [];
	const lines: string[] = [];
	const edge = (
		x1: number,
		y1: number,
		x2: number,
		y2: number,
		value: string | number | undefined,
	) => {
		const stroke = border(value);
		if (stroke) {
			lines.push(
				`<line x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}" stroke="${stroke.color}" stroke-width="${num(stroke.width)}"/>`,
			);
		}
	};
	for (let r = 0; r < ROWS; r++) {
		for (let c = 0; c < COLS; c++) {
			const css = getTableCellBandStyle(tableData, r, c, ROWS, COLS, { colorScheme }) ?? {};
			const x = inset + c * cw;
			const y = inset + r * rh;
			const fill = cellFill(css);
			if (fill !== 'none') {
				fills.push(
					`<rect x="${num(x)}" y="${num(y)}" width="${num(cw)}" height="${num(rh)}" fill="${fill}"/>`,
				);
			}
			const text = safeColor(typeof css.color === 'string' ? css.color : undefined, '#000000');
			fills.push(
				`<rect x="${num(x + cw * 0.25)}" y="${num(y + rh * 0.42)}" width="${num(cw * 0.5)}" height="${num(Math.max(rh * 0.16, 0.8))}" fill="${text}" opacity="${r === 0 ? '0.9' : '0.55'}"/>`,
			);
			edge(x, y, x + cw, y, css.borderTop);
			edge(x, y + rh, x + cw, y + rh, css.borderBottom);
			edge(x, y, x, y + rh, css.borderLeft);
			edge(x + cw, y, x + cw, y + rh, css.borderRight);
		}
	}
	const background = `<rect x="0" y="0" width="${size.width}" height="${size.height}" fill="#FFFFFF"/>`;
	return svgTile(size.width, size.height, '', background + fills.join('') + lines.join(''));
}
