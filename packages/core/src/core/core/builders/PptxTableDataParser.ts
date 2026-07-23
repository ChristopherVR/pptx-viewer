import type { PptxTableCellStyle, PptxTableData, PptxTableRow, XmlObject } from '../../types';
import { applyCell3DStyle } from './table-cell-3d-helpers';
import {
	applyCellFillStyle,
	applyCellBorderStyle,
	applyCellMarginStyle,
} from './table-cell-fill-border-helpers';
import { applyCellAlignmentStyle, applyCellTextFormat } from './table-cell-text-style-helpers';

export interface PptxTableDataParserContext {
	emuPerPx: number;
	ensureArray: (value: unknown) => unknown[];
	parseColor: (colorNode: XmlObject | undefined, placeholderColor?: string) => string | undefined;
	extractGradientFillCss?: (gradFill: XmlObject) => string | undefined;
	extractGradientStops?: (
		gradFill: XmlObject,
	) => Array<{ color: string; position: number; opacity?: number }>;
	extractGradientType?: (gradFill: XmlObject) => 'linear' | 'radial';
	extractGradientAngle?: (gradFill: XmlObject) => number;
	extractGradientPathType?: (gradFill: XmlObject) => 'circle' | 'rect' | 'shape' | undefined;
	extractGradientFocalPoint?: (gradFill: XmlObject) => { x: number; y: number } | undefined;
	extractGradientFillToRect?: (
		gradFill: XmlObject,
	) => { l: number; t: number; r: number; b: number } | undefined;
}

export interface IPptxTableDataParser {
	parseTableData(graphicData: XmlObject): PptxTableData | undefined;
}

export class PptxTableDataParser implements IPptxTableDataParser {
	private readonly context: PptxTableDataParserContext;

	public constructor(context: PptxTableDataParserContext) {
		this.context = context;
	}

	public parseTableData(graphicData: XmlObject): PptxTableData | undefined {
		try {
			const tableNode = graphicData['a:tbl'] as XmlObject | undefined;
			if (!tableNode) {
				return undefined;
			}

			const gridColumns = this.context.ensureArray(
				(tableNode['a:tblGrid'] as XmlObject | undefined)?.['a:gridCol'],
			) as XmlObject[];
			const totalWidthEmu = gridColumns.reduce((sum, column) => {
				const width = parseInt(String(column?.['@_w'] || '0'), 10) || 0;
				return sum + width;
			}, 0);
			const columnWidths =
				totalWidthEmu > 0
					? gridColumns.map((column) => {
							const width = parseInt(String(column?.['@_w'] || '0'), 10) || 0;
							return width / totalWidthEmu;
						})
					: gridColumns.map(() => 1 / Math.max(gridColumns.length, 1));

			const tableProperties = (tableNode['a:tblPr'] || {}) as XmlObject;
			const tableStyleId = this.extractTableStyleId(tableProperties);

			const xmlRows = this.context.ensureArray(tableNode['a:tr']) as XmlObject[];
			const rows: PptxTableRow[] = xmlRows.map((rowNode) => {
				const rowHeightEmu = parseInt(String(rowNode?.['@_h'] || '0'), 10) || 0;
				const rowHeight = Math.round(rowHeightEmu / this.context.emuPerPx);
				const xmlCells = this.context.ensureArray(rowNode['a:tc']) as XmlObject[];

				return {
					height: rowHeight,
					cells: xmlCells.map((cellNode) => {
						const extraAttributes = this.extractCellExtraAttributes(
							cellNode['a:tcPr'] as XmlObject | undefined,
						);
						return {
							text: this.extractTableCellText(cellNode),
							style: this.extractTableCellStyleFromXml(cellNode),
							gridSpan: cellNode['@_gridSpan']
								? parseInt(String(cellNode['@_gridSpan']), 10)
								: undefined,
							rowSpan: cellNode['@_rowSpan']
								? parseInt(String(cellNode['@_rowSpan']), 10)
								: undefined,
							vMerge: cellNode['@_vMerge'] === '1',
							hMerge: cellNode['@_hMerge'] === '1',
							...(extraAttributes ? { extraAttributes } : {}),
						};
					}),
				};
			});

			// CT_TableProperties §21.1.3.15: bandRowCycle/bandColCycle live in a
			// child <a:tblPr/a:bandRowCycle val="N"/>, not as attributes. Older
			// inputs may also expose them as @_bandRowCycle / @_bandColCycle.
			const bandRowCycle = this.extractBandCycle(tableProperties, 'bandRowCycle');
			const bandColCycle = this.extractBandCycle(tableProperties, 'bandColCycle');
			const rtl = tableProperties['@_rtl'] === '1';

			return {
				rows,
				columnWidths,
				bandedRows: tableProperties['@_bandRow'] === '1',
				firstRowHeader: tableProperties['@_firstRow'] === '1',
				bandedColumns: tableProperties['@_bandCol'] === '1',
				lastRow: tableProperties['@_lastRow'] === '1',
				firstCol: tableProperties['@_firstCol'] === '1',
				lastCol: tableProperties['@_lastCol'] === '1',
				tableStyleId,
				bandRowCycle: bandRowCycle ?? 1,
				bandColCycle: bandColCycle ?? 1,
				...(rtl ? { rtl: true } : {}),
			};
		} catch {
			return undefined;
		}
	}

	/**
	 * Read the table style ID from `a:tblPr`.
	 *
	 * ECMA-376 §21.1.3.13 defines `<a:tableStyleId>{GUID}</a:tableStyleId>` as
	 * a child element of `a:tblPr` carrying the GUID as element text. Older
	 * inputs (and earlier versions of this library) used the legacy
	 * `<a:tblStyle val="{GUID}"/>` child element or a `@_tblStyle` attribute.
	 * Accept all three; the spec form takes precedence.
	 */
	private extractTableStyleId(tableProperties: XmlObject): string | undefined {
		const tableStyleIdNode = tableProperties['a:tableStyleId'];
		if (tableStyleIdNode !== undefined && tableStyleIdNode !== null) {
			const direct =
				typeof tableStyleIdNode === 'string' || typeof tableStyleIdNode === 'number'
					? String(tableStyleIdNode)
					: String((tableStyleIdNode as XmlObject)['#text'] ?? '');
			const trimmed = direct.trim();
			if (trimmed.length > 0) {
				return trimmed;
			}
		}
		const tableStyleNode = tableProperties['a:tblStyle'] as XmlObject | undefined;
		const legacy = String(tableStyleNode?.['@_val'] || tableProperties['@_tblStyle'] || '').trim();
		return legacy.length > 0 ? legacy : undefined;
	}

	/**
	 * CT_TableProperties §21.1.3.15 declares `bandRowCycle` / `bandColCycle`
	 * as either an attribute (`@_bandRowCycle`) or a child element
	 * (`<a:bandRowCycle val="N"/>`). Read both forms; return `undefined` to
	 * let the caller fall back to the spec default of 1.
	 */
	private extractBandCycle(
		tableProperties: XmlObject,
		key: 'bandRowCycle' | 'bandColCycle',
	): number | undefined {
		const attrName = `@_${key}`;
		const attrVal = tableProperties[attrName];
		if (attrVal !== undefined && attrVal !== null) {
			const parsed = parseInt(String(attrVal), 10);
			if (Number.isFinite(parsed) && parsed > 0) {
				return parsed;
			}
		}
		const child = tableProperties[`a:${key}`] as XmlObject | undefined;
		if (child) {
			const childVal = parseInt(String(child['@_val'] ?? ''), 10);
			if (Number.isFinite(childVal) && childVal > 0) {
				return childVal;
			}
		}
		return undefined;
	}

	/**
	 * Capture `a:tcPr` attributes that don't yet have typed equivalents on
	 * {@link PptxTableCellStyle} so they survive a round-trip
	 * (`horzOverflow`, `anchorCtr`, `headers`, `hideSlicers`,
	 * `slicerCacheId`). Returns the attribute name (without the `@_` prefix
	 * fast-xml-parser adds) → string-value map, or undefined when none of
	 * the recognised opaque attributes are present.
	 */
	private extractCellExtraAttributes(
		cellProperties: XmlObject | undefined,
	): Record<string, string> | undefined {
		if (!cellProperties) {
			return undefined;
		}
		const opaqueAttrs = [
			'horzOverflow',
			'anchorCtr',
			'headers',
			'hideSlicers',
			'slicerCacheId',
		] as const;
		const result: Record<string, string> = {};
		for (const attr of opaqueAttrs) {
			const raw = cellProperties[`@_${attr}`];
			if (raw !== undefined && raw !== null && String(raw).length > 0) {
				result[attr] = String(raw);
			}
		}
		return Object.keys(result).length > 0 ? result : undefined;
	}

	private extractTableCellText(tableCell: XmlObject): string {
		const paragraphs = this.context.ensureArray(
			(tableCell?.['a:txBody'] as XmlObject | undefined)?.['a:p'],
		) as XmlObject[];
		const lines: string[] = [];

		for (const paragraph of paragraphs) {
			const runs = this.context.ensureArray(paragraph['a:r']) as XmlObject[];
			const fields = this.context.ensureArray(paragraph['a:fld']) as XmlObject[];
			let lineText = '';

			for (const run of runs) {
				lineText += String(run?.['a:t'] ?? '');
			}
			for (const field of fields) {
				lineText += String(field?.['a:t'] ?? '');
			}
			lines.push(lineText);
		}

		return lines.join('\n');
	}

	private extractTableCellStyleFromXml(tableCell: XmlObject): PptxTableCellStyle | undefined {
		try {
			const cellProperties = tableCell?.['a:tcPr'] as XmlObject | undefined;
			const style: PptxTableCellStyle = {};
			let hasStyle = false;

			hasStyle = applyCellFillStyle(cellProperties, style, this.context) || hasStyle;
			hasStyle = applyCellBorderStyle(cellProperties, style, this.context) || hasStyle;
			hasStyle = applyCell3DStyle(cellProperties, style, this.context) || hasStyle;
			hasStyle = applyCellMarginStyle(cellProperties, style, this.context) || hasStyle;
			hasStyle = applyCellAlignmentStyle(cellProperties, style) || hasStyle;
			hasStyle = applyCellTextFormat(tableCell, style, this.context) || hasStyle;

			return hasStyle ? style : undefined;
		} catch {
			return undefined;
		}
	}
}

export type { TableCellFillBorderContext } from './table-cell-fill-border-helpers';
export {
	applyCellFillStyle,
	applyCellBorderStyle,
	applyCellMarginStyle,
} from './table-cell-fill-border-helpers';
export { applyCell3DStyle } from './table-cell-3d-helpers';
export type { TableCellTextStyleContext } from './table-cell-text-style-helpers';
export { applyCellAlignmentStyle, applyCellTextFormat } from './table-cell-text-style-helpers';
