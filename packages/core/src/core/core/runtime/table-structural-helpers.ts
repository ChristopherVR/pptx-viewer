import { EMU_PER_PX } from '../../constants';
/**
 * Shared helpers, constants, and XML navigation utilities for table
 * structural operations.
 *
 * @module runtime/table-structural-helpers
 */
import type { PptxTableCell, XmlObject } from '../../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default row height in pixels when none is specified. */
export const DEFAULT_ROW_HEIGHT_PX = 40;

/** Default row height in EMU for XML. */
export const DEFAULT_ROW_HEIGHT_EMU = DEFAULT_ROW_HEIGHT_PX * EMU_PER_PX;

// ---------------------------------------------------------------------------
// Array helpers
// ---------------------------------------------------------------------------

/**
 * Ensure a value is always returned as an array.
 * Wraps single values in an array and converts nullish values to an empty array.
 *
 * @param value - The value to normalise into an array.
 * @returns An array containing the value(s), or an empty array.
 */
export function ensureArray<T>(value: T | T[] | undefined | null): T[] {
	if (!value) {
		return [];
	}
	return Array.isArray(value) ? value : [value];
}

// ---------------------------------------------------------------------------
// Cell and row factories
// ---------------------------------------------------------------------------

/**
 * Create a default empty cell for insertion into the logical table model.
 *
 * @returns A blank `PptxTableCell` with empty text and no styles.
 */
export function createDefaultCell(): PptxTableCell {
	return { text: '', style: {} };
}

/**
 * Create a default XML cell element (`<a:tc>`).
 *
 * @returns An XML object representing an empty table cell with minimal structure.
 */
export function createDefaultXmlCell(): XmlObject {
	return {
		'a:txBody': {
			'a:bodyPr': {},
			'a:lstStyle': {},
			'a:p': {
				// Match PowerPoint's "Insert Table" default: every paragraph-end
				// run carries `lang="en-US" dirty="0"`.
				'a:endParaRPr': { '@_lang': 'en-US', '@_dirty': '0' },
			},
		},
		'a:tcPr': {},
	};
}

/**
 * Create a default XML row element (`<a:tr>`) with the given number of cells.
 *
 * @param colCount - Number of cells to include in the row.
 * @param heightEmu - Optional row height in EMU; defaults to `DEFAULT_ROW_HEIGHT_EMU`.
 * @returns An XML object representing a table row.
 */
export function createDefaultXmlRow(colCount: number, heightEmu?: number): XmlObject {
	const cells: XmlObject[] = Array.from({ length: colCount }, () => createDefaultXmlCell());
	return {
		'@_h': String(heightEmu ?? DEFAULT_ROW_HEIGHT_EMU),
		'a:tc': cells.length === 1 ? cells[0] : cells,
	};
}

// ---------------------------------------------------------------------------
// XML navigation
// ---------------------------------------------------------------------------

/**
 * Navigate from a graphic frame rawXml to the `<a:tbl>` node.
 *
 * @param rawXml - The raw XML object for a graphic frame element.
 * @returns The `<a:tbl>` XML object, or undefined if not found.
 */
export function getTblFromRawXml(rawXml: XmlObject): XmlObject | undefined {
	const graphicData = (rawXml['a:graphic'] as XmlObject | undefined)?.['a:graphicData'] as
		| XmlObject
		| undefined;
	return graphicData?.['a:tbl'] as XmlObject | undefined;
}
