/**
 * Rebuild table XML from `PptxTableData`.
 *
 * Used by the save pipeline when the number of rows or columns has changed,
 * to ensure the XML structure matches the current logical table model.
 *
 * @module runtime/table-xml-rebuild
 */
import type { PptxTableData, XmlObject } from '../../types';
import { DEFAULT_ROW_HEIGHT_EMU, createDefaultXmlCell } from './table-structural-helpers';

/**
 * Office 2014+ extension URI used to attach a stable per-column identifier
 * (`a16:colId`) to each `<a:gridCol>`. PowerPoint's "Insert > Table" UI
 * always emits this so later edits (column reordering, track-changes)
 * can identify columns across save cycles. Dropping it doesn't affect
 * rendering but leaves the table visibly different from Office output.
 */
const GRID_COL_ID_EXT_URI = '{9D8B030D-6E8A-4147-A177-3AD203B41FA5}';
/**
 * Microsoft Office 2014+ extension namespace, declared on the slide root
 * (with `mc:Ignorable="a16"`) so that legacy renderers ignore the
 * `<a16:colId>` element while modern PowerPoint reads the column id.
 *
 * Per ECMA-376 §17.17.2 the spec discourages declaring auxiliary
 * namespaces on leaf elements; declarations belong on the part root.
 */
export const A16_NAMESPACE = 'http://schemas.microsoft.com/office/drawing/2014/main';

/**
 * Declare `xmlns:a16` on a slide root and append `a16` to `mc:Ignorable`.
 *
 * Call this on the `<p:sld>` (or `<p:sldLayout>` / `<p:sldMaster>`) node
 * after any save step that may emit `<a16:colId>` (or other a16-namespaced
 * elements). Idempotent — safe to call repeatedly.
 *
 * The legacy save path declared `xmlns:a16` on the leaf `<a16:colId>`
 * which is technically valid XML but is rejected by some OOXML linters
 * and disagrees with what PowerPoint emits.
 */
export function ensureA16NamespaceOnSlideRoot(slideRoot: XmlObject): void {
	if (!slideRoot['@_xmlns:a16']) {
		slideRoot['@_xmlns:a16'] = A16_NAMESPACE;
	}
	// `mc:Ignorable` lives in the Markup Compatibility namespace; if the
	// slide root doesn't yet declare `xmlns:mc`, add it. Without this the
	// XML serialiser emits an unprefixed-namespace attribute and Office
	// flags the package as malformed.
	if (!slideRoot['@_xmlns:mc']) {
		slideRoot['@_xmlns:mc'] = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
	}
	const existingIgnorable = String(slideRoot['@_mc:Ignorable'] || '').trim();
	if (existingIgnorable.length === 0) {
		slideRoot['@_mc:Ignorable'] = 'a16';
		return;
	}
	const tokens = existingIgnorable.split(/\s+/u).filter((token) => token.length > 0);
	if (!tokens.includes('a16')) {
		tokens.push('a16');
		slideRoot['@_mc:Ignorable'] = tokens.join(' ');
	}
}

/**
 * OOXML math namespace, required on the slide root whenever `m:oMath` /
 * `m:oMathPara` (OMML) elements appear in the document.
 */
export const MATH_NAMESPACE = 'http://schemas.openxmlformats.org/officeDocument/2006/math';

/**
 * Declare `xmlns:m` on a slide root.
 *
 * Call after any save step that may emit `m:oMath` or `m:oMathPara` children
 * (SDK-created equations on slides that never previously carried math). Without
 * this, fast-xml-parser emits `<m:oMath>` with the `m:` prefix undeclared,
 * which is invalid XML and causes PowerPoint to reject the file.
 *
 * Idempotent — safe to call repeatedly.
 */
export function ensureMathNamespaceOnSlideRoot(slideRoot: XmlObject): void {
	if (!slideRoot['@_xmlns:m']) {
		slideRoot['@_xmlns:m'] = MATH_NAMESPACE;
	}
}

/**
 * Detect whether any element under `node` uses an `m:` qualified name
 * (OMML math content).
 *
 * Walks the parsed XML object tree (fast-xml-parser format). Bails out as
 * soon as a match is found.
 */
export function slideContainsMathElement(node: unknown): boolean {
	if (node === null || node === undefined) {
		return false;
	}
	if (Array.isArray(node)) {
		for (const entry of node) {
			if (slideContainsMathElement(entry)) {
				return true;
			}
		}
		return false;
	}
	if (typeof node !== 'object') {
		return false;
	}
	for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
		if (key.startsWith('m:')) {
			return true;
		}
		if (slideContainsMathElement(value)) {
			return true;
		}
	}
	return false;
}

/**
 * Detect whether any element under `node` uses an `a16:` qualified name.
 *
 * Walks the parsed XML object tree (fast-xml-parser format). Bails out as
 * soon as a match is found.
 */
export function slideContainsA16Element(node: unknown): boolean {
	if (node === null || node === undefined) {
		return false;
	}
	if (Array.isArray(node)) {
		for (const entry of node) {
			if (slideContainsA16Element(entry)) {
				return true;
			}
		}
		return false;
	}
	if (typeof node !== 'object') {
		return false;
	}
	for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
		if (key.startsWith('a16:')) {
			return true;
		}
		if (slideContainsA16Element(value)) {
			return true;
		}
	}
	return false;
}

function randomColumnId(): string {
	// PowerPoint emits unsigned-32-bit integers. Values only need to be
	// unique within a single <a:tblGrid>; uniqueness across tables / files
	// isn't required.
	return String(Math.floor(Math.random() * 0xffffffff));
}

// ---------------------------------------------------------------------------
// Rebuild table XML
// ---------------------------------------------------------------------------

/**
 * Rebuild the `<a:tblGrid>` and `<a:tr>` elements of a table XML object
 * to match the current `PptxTableData`. This is used by the save pipeline
 * when the number of rows or columns has changed.
 *
 * The method preserves `<a:tblPr>` and existing cell XML where possible.
 *
 * @param tbl - The `<a:tbl>` XML object to rebuild.
 * @param tableData - The current logical table model to match.
 * @param emuPerPx - EMU-to-pixel conversion factor.
 * @param ensureArrayFn - A function that normalises a value into an array.
 */
export function rebuildTableXmlFromData(
	tbl: XmlObject,
	tableData: PptxTableData,
	emuPerPx: number,
	ensureArrayFn: (value: unknown) => unknown[],
): void {
	const existingXmlRows = ensureArrayFn(tbl['a:tr']) as XmlObject[];
	const existingGridCols = ensureArrayFn(
		(tbl['a:tblGrid'] as XmlObject | undefined)?.['a:gridCol'],
	) as XmlObject[];

	// Compute total width from existing grid columns (fallback: 9144000 EMU = 960px)
	const totalWidthEmu =
		existingGridCols.reduce((sum, col) => {
			return sum + (parseInt(String(col?.['@_w'] || '0'), 10) || 0);
		}, 0) || 9144000;

	// -- Rebuild a:tblGrid --
	// Preserve any existing <a:extLst>/<a16:colId> entries from the prior
	// XML so round-tripped tables keep their stable column identities; mint
	// a fresh random id for newly added columns, matching what PowerPoint's
	// "Insert > Table" UI emits.
	const existingColIds: string[] = existingGridCols.map((col) => {
		const extList = col?.['a:extLst'] as XmlObject | undefined;
		const exts = Array.isArray(extList?.['a:ext'])
			? (extList['a:ext'] as XmlObject[])
			: extList?.['a:ext']
				? [extList['a:ext'] as XmlObject]
				: [];
		for (const ext of exts) {
			if (ext?.['@_uri'] === GRID_COL_ID_EXT_URI) {
				const colId = ext['a16:colId'] as XmlObject | undefined;
				const val = colId?.['@_val'];
				if (typeof val === 'string' && val.length > 0) {
					return val;
				}
			}
		}
		return '';
	});
	const newGridCols: XmlObject[] = tableData.columnWidths.map((w, i) => ({
		'@_w': String(Math.round(w * totalWidthEmu)),
		'a:extLst': {
			'a:ext': {
				'@_uri': GRID_COL_ID_EXT_URI,
				// `xmlns:a16` is declared on the slide root by
				// `ensureA16NamespaceOnSlideRoot`; emitting it here too is
				// schema-redundant and PowerPoint flags it.
				'a16:colId': {
					'@_val': existingColIds[i] || randomColumnId(),
				},
			},
		},
	}));
	if (!tbl['a:tblGrid']) {
		tbl['a:tblGrid'] = {};
	}
	(tbl['a:tblGrid'] as XmlObject)['a:gridCol'] =
		newGridCols.length === 1 ? newGridCols[0] : newGridCols;

	// -- Rebuild a:tr --
	const newXmlRows: XmlObject[] = tableData.rows.map((dataRow, ri) => {
		const existingRow = ri < existingXmlRows.length ? existingXmlRows[ri] : undefined;
		const existingCells = existingRow ? (ensureArrayFn(existingRow['a:tc']) as XmlObject[]) : [];

		const heightEmu = dataRow.height
			? Math.round(dataRow.height * emuPerPx)
			: existingRow?.['@_h']
				? parseInt(String(existingRow['@_h']), 10)
				: DEFAULT_ROW_HEIGHT_EMU;

		const newXmlCells: XmlObject[] = dataRow.cells.map((cell, ci) => {
			// Try to reuse existing cell XML
			let xmlCell: XmlObject;
			if (ci < existingCells.length) {
				xmlCell = structuredClone(existingCells[ci]) as XmlObject;
			} else {
				xmlCell = createDefaultXmlCell();
			}

			// Update merge attributes
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

			return xmlCell;
		});

		const xmlRow: XmlObject = {
			'@_h': String(heightEmu),
			'a:tc': newXmlCells.length === 1 ? newXmlCells[0] : newXmlCells,
		};

		return xmlRow;
	});

	tbl['a:tr'] = newXmlRows.length === 1 ? newXmlRows[0] : newXmlRows;
}
