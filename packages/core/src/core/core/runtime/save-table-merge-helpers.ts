import type { XmlObject } from '../../types';

/**
 * Merge-attribute shape expected by {@link serializeCellMergeAttributes}.
 * Mirrors the relevant fields of `PptxTableCell`.
 */
interface CellMergeInfo {
	gridSpan?: number;
	rowSpan?: number;
	hMerge?: boolean;
	vMerge?: boolean;
	extraAttributes?: Record<string, string>;
}

/**
 * Round-trip the recognised opaque CT_TableCellProperties attributes
 * (`horzOverflow`, `anchorCtr`, `headers`, `hideSlicers`, `slicerCacheId`)
 * onto `<a:tcPr>`. Attributes already carried by the typed model are
 * left for the dedicated writers; missing keys clear any prior values
 * the writer might have inherited from preserved raw XML.
 */
const OPAQUE_TC_PR_ATTRS = [
	'horzOverflow',
	'anchorCtr',
	'headers',
	'hideSlicers',
	'slicerCacheId',
] as const;

export function serializeCellExtraAttributes(
	xmlCell: XmlObject,
	extra: Record<string, string> | undefined,
): void {
	if (!xmlCell['a:tcPr']) {
		xmlCell['a:tcPr'] = {};
	}
	const tcPr = xmlCell['a:tcPr'] as XmlObject;
	for (const attr of OPAQUE_TC_PR_ATTRS) {
		const key = `@_${attr}`;
		const value = extra?.[attr];
		if (value !== undefined && value.length > 0) {
			tcPr[key] = value;
		} else {
			delete tcPr[key];
		}
	}
}

/**
 * Write / clear merge attributes (`gridSpan`, `rowSpan`, `hMerge`, `vMerge`)
 * on a `<a:tc>` XML element to reflect the current cell merge state.
 */
export function serializeCellMergeAttributes(xmlCell: XmlObject, cell: CellMergeInfo): void {
	if (cell.gridSpan !== undefined && cell.gridSpan > 1) {
		xmlCell['@_gridSpan'] = String(cell.gridSpan);
	} else {
		delete xmlCell['@_gridSpan'];
	}
	if (cell.rowSpan !== undefined && cell.rowSpan > 1) {
		xmlCell['@_rowSpan'] = String(cell.rowSpan);
	} else {
		delete xmlCell['@_rowSpan'];
	}
	if (cell.hMerge) {
		xmlCell['@_hMerge'] = '1';
	} else {
		delete xmlCell['@_hMerge'];
	}
	if (cell.vMerge) {
		xmlCell['@_vMerge'] = '1';
	} else {
		delete xmlCell['@_vMerge'];
	}
}

/**
 * Write table-level property flags (`bandRow`, `bandCol`, etc.) onto
 * the `<a:tblPr>` XML object from the given table data.
 */
/**
 * Default table style GUID that PowerPoint's "Insert > Table" UI applies
 * when the user hasn't picked a specific style. This is "Medium Style 2 -
 * Accent 1" — a blue header row with banded white rows — and is defined
 * in PowerPoint's built-in `ppt/tableStyles.xml`. Emitting a table with
 * no `<a:tableStyleId>` produces an unstyled table (no borders, no fill)
 * in PowerPoint, which doesn't match what users see when inserting a
 * table through the UI.
 */
export const DEFAULT_POWERPOINT_TABLE_STYLE_ID = '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}';

export function serializeTablePropertyFlags(
	tbl: XmlObject,
	tableData: {
		bandedRows?: boolean;
		bandedColumns?: boolean;
		firstRowHeader?: boolean;
		lastRow?: boolean;
		firstCol?: boolean;
		lastCol?: boolean;
		tableStyleId?: string;
		bandRowCycle?: number;
		bandColCycle?: number;
		rtl?: boolean;
	},
): void {
	const tblPr = ((tbl as XmlObject)['a:tblPr'] ?? {}) as XmlObject;
	// Match PowerPoint's convention: only emit the attribute when the flag
	// is true. All of these default to `false` per CT_TableProperties, so
	// emitting `="0"` is behaviorally identical but adds noise and doesn't
	// match what "Insert > Table" produces.
	const setOrDelete = (key: string, truthy: boolean | undefined): void => {
		if (truthy) {
			tblPr[key] = '1';
		} else {
			delete tblPr[key];
		}
	};
	setOrDelete('@_bandRow', tableData.bandedRows);
	setOrDelete('@_bandCol', tableData.bandedColumns);
	setOrDelete('@_firstRow', tableData.firstRowHeader);
	setOrDelete('@_lastRow', tableData.lastRow);
	setOrDelete('@_firstCol', tableData.firstCol);
	setOrDelete('@_lastCol', tableData.lastCol);
	// `@_rtl` uses preserve-on-undefined semantics: a save call that doesn't
	// know the full table state (e.g. structural-flag-only updates) should
	// not strip a previously-parsed rtl attribute.
	if (tableData.rtl === true) {
		tblPr['@_rtl'] = '1';
	} else if (tableData.rtl === false) {
		delete tblPr['@_rtl'];
	}

	// bandRowCycle / bandColCycle default to 1 per CT_TableProperties; only
	// emit when explicitly non-default to match Office output.
	const setOrDeleteAttr = (key: string, value: number | undefined): void => {
		if (value !== undefined && Number.isFinite(value) && value > 1) {
			tblPr[key] = String(value);
		} else {
			delete tblPr[key];
		}
	};
	setOrDeleteAttr('@_bandRowCycle', tableData.bandRowCycle);
	setOrDeleteAttr('@_bandColCycle', tableData.bandColCycle);

	// Default to PowerPoint's Medium Style 2 - Accent 1 when the caller
	// didn't pick a style. Without an `<a:tableStyleId>`, PowerPoint renders
	// the table with no borders and no fill.
	if (tableData.tableStyleId) {
		tblPr['a:tableStyleId'] = tableData.tableStyleId;
	} else if (!tblPr['a:tableStyleId']) {
		tblPr['a:tableStyleId'] = DEFAULT_POWERPOINT_TABLE_STYLE_ID;
	}
	(tbl as XmlObject)['a:tblPr'] = tblPr;
}

/**
 * Recursively replace the first text value whose local name matches
 * `localName` somewhere in the node tree.
 *
 * @param getXmlLocalName - Callback that strips the namespace prefix from an XML key.
 */
export function replaceFirstTextValueInTree(
	node: unknown,
	localName: string,
	newValue: string,
	getXmlLocalName: (key: string) => string,
): boolean {
	if (node === null || node === undefined) {
		return false;
	}
	if (Array.isArray(node)) {
		for (const entry of node) {
			if (replaceFirstTextValueInTree(entry, localName, newValue, getXmlLocalName)) {
				return true;
			}
		}
		return false;
	}
	if (typeof node !== 'object') {
		return false;
	}

	const objectNode = node as XmlObject;
	for (const [key, value] of Object.entries(objectNode)) {
		if (getXmlLocalName(key) === localName) {
			if (typeof value === 'string' || typeof value === 'number') {
				objectNode[key] = newValue;
				return true;
			}
		}
		if (replaceFirstTextValueInTree(value, localName, newValue, getXmlLocalName)) {
			return true;
		}
	}
	return false;
}

/** Build the `<c:pt>` array for a chart cache from string values. */
export function buildChartPoints(values: string[]): Array<{ '@_idx': string; 'c:v': string }> {
	return values.map((val, idx) => ({ '@_idx': String(idx), 'c:v': val }));
}
