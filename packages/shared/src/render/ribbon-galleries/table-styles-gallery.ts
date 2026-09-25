/**
 * Table Design > Table Styles: PowerPoint's 74 built-in table styles.
 *
 * A pick writes what PowerPoint writes: `a:tblPr/a:tableStyleId` = the style
 * GUID (the style definition itself stays out of `ppt/tableStyles.xml`, as
 * PowerPoint leaves it; the renderer resolves the GUID through the built-in
 * catalogue, so the change shows at once). PowerPoint also CLEARS every
 * cell's direct `a:tcPr` fill and borders while keeping the run formatting:
 * `scripts/capture-data-galleries-com.ps1` applies Table.ApplyStyle(guid) to
 * cells carrying a direct fill, font colour, bold and a border, and the saved
 * cells come back as a bare `<a:tcPr/>` with the `a:rPr` colour/bold intact
 * (with SaveFormatting true, false and omitted alike). The pick does the same.
 *
 * @module render/ribbon-galleries/table-styles-gallery
 */
import type { PptxElement, PptxTableCellStyle, PptxTableData } from 'pptx-viewer-core';

import type { RibbonGalleryModule } from './gallery-module';
import { galleryColorScheme } from './gallery-theme';
import type { RibbonGalleryContext, RibbonGalleryDescriptor } from './gallery-types';
import { normaliseTableStyleId, tableStyleGallerySections } from './table-style-gallery-catalog';
import { tableStyleTileSvg } from './table-style-tile-svg';

const TILE = { width: 60, height: 44 };

/** The `a:tcPr` fill / border keys a style pick clears (text formatting stays). */
const CLEARED_CELL_KEYS: ReadonlyArray<keyof PptxTableCellStyle> = [
	'backgroundColor',
	'backgroundColorXml',
	'backgroundColorRef',
	'fillMode',
	'gradientFillStops',
	'gradientFillAngle',
	'gradientFillType',
	'gradientFillPathType',
	'gradientFillFocalPoint',
	'gradientFillFillToRect',
	'gradientFillCss',
	'patternFillPreset',
	'patternFillForeground',
	'patternFillBackground',
	'backgroundImageFillPath',
	'backgroundImageFillData',
	'borderColor',
	'borderTopWidth',
	'borderBottomWidth',
	'borderLeftWidth',
	'borderRightWidth',
	'borderTopColor',
	'borderBottomColor',
	'borderLeftColor',
	'borderRightColor',
	'borderDiagDownColor',
	'borderDiagDownWidth',
	'borderDiagUpColor',
	'borderDiagUpWidth',
	'borderDash',
	'borderTopDash',
	'borderBottomDash',
	'borderLeftDash',
	'borderRightDash',
	'cell3D',
];

function tableDataOf(element: PptxElement | null): PptxTableData | undefined {
	return element?.type === 'table' ? element.tableData : undefined;
}

/** `style` without its direct fill / border keys, or undefined when nothing is left. */
function withoutCellFormatting(
	style: PptxTableCellStyle | undefined,
): PptxTableCellStyle | undefined {
	if (!style) {
		return undefined;
	}
	const next: PptxTableCellStyle = { ...style };
	for (const key of CLEARED_CELL_KEYS) {
		delete next[key];
	}
	return Object.keys(next).length > 0 ? next : undefined;
}

/** The table data a pick of `styleId` produces: the GUID plus cleared cell fills/borders. */
export function applyTableStyleToData(tableData: PptxTableData, styleId: string): PptxTableData {
	return {
		...tableData,
		tableStyleId: styleId,
		rows: tableData.rows.map((row) => ({
			...row,
			cells: row.cells.map((cell) => {
				const { style, ...rest } = cell;
				const nextStyle = withoutCellFormatting(style);
				return nextStyle ? { ...rest, style: nextStyle } : rest;
			}),
		})),
	};
}

function build(ctx: RibbonGalleryContext): RibbonGalleryDescriptor {
	const tableData = tableDataOf(ctx.element);
	const current = normaliseTableStyleId(tableData?.tableStyleId);
	const colorScheme = galleryColorScheme(ctx);
	return {
		id: 'tableStyles',
		labelKey: 'pptx.gallery.tableStyles.title',
		label: 'Table Styles',
		disabled: !tableData,
		sections: tableStyleGallerySections().map((section) => ({
			id: section.id,
			titleKey: `pptx.gallery.tableStyles.section.${section.id}`,
			title: section.title,
			columns: 7,
			tileWidth: TILE.width,
			tileHeight: TILE.height,
			items: section.entries.map((entry) => ({
				id: entry.id,
				labelKey: entry.labelKey,
				...(entry.labelParams && { labelParams: entry.labelParams }),
				label: entry.name,
				previewSvg: tableStyleTileSvg(entry.id, colorScheme, TILE),
				applied: current === entry.id,
			})),
		})),
	};
}

function isGalleryStyle(id: string): boolean {
	return tableStyleGallerySections().some((section) =>
		section.entries.some((entry) => entry.id === id),
	);
}

export const TABLE_STYLES_GALLERY: RibbonGalleryModule = {
	build,
	apply(itemId, ctx) {
		const element = ctx.element;
		const tableData = tableDataOf(element);
		const styleId = normaliseTableStyleId(itemId);
		if (!element || !tableData || !styleId || !isGalleryStyle(styleId)) {
			return null;
		}
		return {
			kind: 'element',
			elementId: element.id,
			patch: { tableData: applyTableStyleToData(tableData, styleId) } as Partial<PptxElement>,
		};
	},
};
