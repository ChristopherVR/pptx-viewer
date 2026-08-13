/**
 * In-place / deep-clone mutations of a table graphic-frame's raw XML.
 *
 * These pure functions clone an element's `rawXml`, locate the `<a:tbl>` node,
 * and apply targeted edits (cell text, cell run-style, merge attributes, full
 * structural rebuild) so the XML-based rendering path reflects logical model
 * changes immediately, without a save→reload cycle.
 *
 * Framework-agnostic; consumed by the viewer bindings' table editor.
 *
 * @module runtime/table-cell-rawxml-ops
 */
import { EMU_PER_PX } from '../../constants';
import type { PptxElement, PptxTableData, XmlObject } from '../../types';
import { ensureXmlChild, ensureXmlChildOrCreate, ensureXmlChildren } from '../../utils/xml-access';
import { DEFAULT_ROW_HEIGHT_EMU, ensureArray, getTblFromRawXml } from './table-structural-helpers';

// ── Cell text update ─────────────────────────────────────────────────────

/**
 * Deep-clone an element's rawXml and update the text of a specific table cell.
 * Returns the new rawXml object, or `undefined` if the element doesn't contain
 * an XML-based table or the indices are out of range.
 */
export function updateCellTextInRawXml(
	element: PptxElement,
	rowIndex: number,
	colIndex: number,
	text: string,
): XmlObject | undefined {
	if (!element.rawXml) {
		return undefined;
	}

	// Deep-clone rawXml so the original is not mutated
	const newRawXml = structuredClone(element.rawXml) as XmlObject;

	const table = getTblFromRawXml(newRawXml);
	if (!table) {
		return undefined;
	}

	const rows = ensureArray(table['a:tr'] as XmlObject | XmlObject[] | undefined);
	if (rowIndex < 0 || rowIndex >= rows.length) {
		return undefined;
	}

	const cells = ensureArray(rows[rowIndex]['a:tc'] as XmlObject | XmlObject[] | undefined);
	if (colIndex < 0 || colIndex >= cells.length) {
		return undefined;
	}

	cells[colIndex]['a:txBody'] = rebuildCellTextBody(
		cells[colIndex]['a:txBody'] as XmlObject | undefined,
		text,
	);

	return newRawXml;
}

/**
 * Rebuild a cell's `<a:txBody>` around a single run of `text`, carrying over
 * the body properties, list style, first paragraph's properties and first
 * run's properties.
 *
 * Every key is inserted in SCHEMA order, because fast-xml-parser's builder
 * emits object keys in insertion order and the three types involved are all
 * `xsd:sequence`s: `CT_TextBody` is (`a:bodyPr`, `a:lstStyle?`, `a:p+`),
 * `CT_TextParagraph` is (`a:pPr?`, runs...), `CT_RegularTextRun` is
 * (`a:rPr?`, `a:t`). Building the content first and appending the properties
 * afterwards - which both copies of this code did - emits an out-of-order
 * package, the spelling PowerPoint reads by silently discarding the group.
 *
 * Carry-over tests are `!== undefined` rather than truthiness, because a bare
 * `<a:pPr/>` or `<a:rPr/>` parses to the empty STRING and a truthiness test
 * drops it.
 */
function rebuildCellTextBody(existingTxBody: XmlObject | undefined, text: string): XmlObject {
	const existingParagraphs = ensureArray(
		existingTxBody?.['a:p'] as XmlObject | XmlObject[] | undefined,
	);
	const firstParagraph = existingParagraphs.length > 0 ? existingParagraphs[0] : undefined;
	const existingRuns = firstParagraph
		? ensureArray(firstParagraph['a:r'] as XmlObject | XmlObject[] | undefined)
		: [];
	const firstRunProps = existingRuns.length > 0 ? existingRuns[0]['a:rPr'] : undefined;

	const newRun: XmlObject = {};
	if (firstRunProps !== undefined) {
		newRun['a:rPr'] = firstRunProps;
	}
	newRun['a:t'] = text;

	const newParagraph: XmlObject = {};
	if (firstParagraph?.['a:pPr'] !== undefined) {
		newParagraph['a:pPr'] = firstParagraph['a:pPr'];
	}
	newParagraph['a:r'] = newRun;

	const newTxBody: XmlObject = {};
	if (existingTxBody?.['a:bodyPr'] !== undefined) {
		newTxBody['a:bodyPr'] = existingTxBody['a:bodyPr'];
	}
	if (existingTxBody?.['a:lstStyle'] !== undefined) {
		newTxBody['a:lstStyle'] = existingTxBody['a:lstStyle'];
	}
	newTxBody['a:p'] = newParagraph;
	return newTxBody;
}

// ── Cell text style update ───────────────────────────────────────────────

/**
 * Deep-clone an element's rawXml and apply text style updates to a specific
 * table cell's run properties (`a:rPr`). This enables applying bold, italic,
 * underline, strikethrough, color, etc. from the toolbar to individual table
 * cells.
 *
 * Returns the new rawXml object, or `undefined` if the element doesn't contain
 * an XML-based table or the indices are out of range.
 */
export function updateCellTextStyleInRawXml(
	element: PptxElement,
	rowIndex: number,
	colIndex: number,
	styleUpdates: Record<string, unknown>,
): XmlObject | undefined {
	if (!element.rawXml) {
		return undefined;
	}

	const newRawXml = structuredClone(element.rawXml) as XmlObject;

	const table = getTblFromRawXml(newRawXml);
	if (!table) {
		return undefined;
	}

	const rows = ensureArray(table['a:tr'] as XmlObject | XmlObject[] | undefined);
	if (rowIndex < 0 || rowIndex >= rows.length) {
		return undefined;
	}

	const cells = ensureArray(rows[rowIndex]['a:tc'] as XmlObject | XmlObject[] | undefined);
	if (colIndex < 0 || colIndex >= cells.length) {
		return undefined;
	}

	const cell = cells[colIndex];
	const txBody = cell['a:txBody'] as XmlObject | undefined;
	if (!txBody) {
		return undefined;
	}

	// Apply style updates to ALL runs in ALL paragraphs of the cell.
	// `ensureXmlChildren`, not `ensureArray`: the paragraphs are WRITTEN into,
	// and a bare `<a:p/>` arrives as the string `''`.
	const paragraphs = ensureXmlChildren(txBody, 'a:p');
	for (const paragraph of paragraphs) {
		// Alignment is a PARAGRAPH property, so it is applied once per paragraph
		// rather than once per run: nesting it in the run loop meant an empty
		// paragraph - a blank cell, or a cell holding a single `<a:p/>` - could
		// not be aligned at all, because the loop it lived in never ran.
		if ('align' in styleUpdates) {
			const pPr = ensureXmlChildOrCreate(paragraph, 'a:pPr', 'first');
			pPr['@_algn'] =
				styleUpdates.align === 'left'
					? 'l'
					: styleUpdates.align === 'center'
						? 'ctr'
						: styleUpdates.align === 'right'
							? 'r'
							: styleUpdates.align === 'justify'
								? 'just'
								: String(styleUpdates.align);
		}

		const runs = ensureArray(paragraph['a:r'] as XmlObject | XmlObject[] | undefined);
		for (const run of runs) {
			// `<a:rPr/>` and `<a:pPr/>` are bare in real decks, and
			// fast-xml-parser materialises a bare element as the STRING `''`.
			// `?? {}` does not catch that (`''` is not nullish), so the cast
			// handed back a string and the first attribute assignment threw
			// `TypeError: Cannot create property '@_b' on string ''` - styling a
			// table cell CRASHED rather than silently doing nothing.
			const rPr = ensureXmlChildOrCreate(run, 'a:rPr', 'first');

			if ('bold' in styleUpdates) {
				if (styleUpdates.bold) {
					rPr['@_b'] = '1';
				} else {
					delete rPr['@_b'];
				}
			}
			if ('italic' in styleUpdates) {
				if (styleUpdates.italic) {
					rPr['@_i'] = '1';
				} else {
					delete rPr['@_i'];
				}
			}
			if ('underline' in styleUpdates) {
				if (styleUpdates.underline) {
					rPr['@_u'] = 'sng';
				} else {
					delete rPr['@_u'];
				}
			}
			if ('strikethrough' in styleUpdates) {
				if (styleUpdates.strikethrough) {
					rPr['@_strike'] = 'sngStrike';
				} else {
					delete rPr['@_strike'];
				}
			}
			if ('color' in styleUpdates && typeof styleUpdates.color === 'string') {
				const hex = styleUpdates.color.replace('#', '');
				rPr['a:solidFill'] = { 'a:srgbClr': { '@_val': hex } };
			}
		}

		// If there are no runs but there's an endParaRPr, update that too. The
		// presence test goes through `ensureXmlChild` because `<a:endParaRPr/>`
		// with no attributes yet is exactly the paragraph a user is most likely
		// to be styling, and a truthiness test reads that `''` as absent.
		const endRPr = runs.length === 0 ? ensureXmlChild(paragraph, 'a:endParaRPr') : undefined;
		if (endRPr) {
			if ('bold' in styleUpdates) {
				if (styleUpdates.bold) {
					endRPr['@_b'] = '1';
				} else {
					delete endRPr['@_b'];
				}
			}
			if ('italic' in styleUpdates) {
				if (styleUpdates.italic) {
					endRPr['@_i'] = '1';
				} else {
					delete endRPr['@_i'];
				}
			}
			if ('underline' in styleUpdates) {
				if (styleUpdates.underline) {
					endRPr['@_u'] = 'sng';
				} else {
					delete endRPr['@_u'];
				}
			}
			if ('strikethrough' in styleUpdates) {
				if (styleUpdates.strikethrough) {
					endRPr['@_strike'] = 'sngStrike';
				} else {
					delete endRPr['@_strike'];
				}
			}
			if ('color' in styleUpdates && typeof styleUpdates.color === 'string') {
				const hex = styleUpdates.color.replace('#', '');
				endRPr['a:solidFill'] = { 'a:srgbClr': { '@_val': hex } };
			}
		}
	}

	return newRawXml;
}

// ── Merge attribute synchronisation ──────────────────────────────────────

/**
 * Deep-clone an element's rawXml and apply merge attributes from PptxTableData.
 * This synchronises the in-memory rawXml so that the XML-based rendering path
 * reflects merge/split changes immediately (without a save→reload cycle).
 *
 * Returns the new rawXml object, or `undefined` if the element doesn't contain
 * an XML-based table.
 */
export function updateMergeAttrsInRawXml(
	element: PptxElement,
	tableData: PptxTableData,
): XmlObject | undefined {
	if (!element.rawXml) {
		return undefined;
	}

	const newRawXml = structuredClone(element.rawXml) as XmlObject;

	const table = getTblFromRawXml(newRawXml);
	if (!table) {
		return undefined;
	}

	const xmlRows = ensureArray(table['a:tr'] as XmlObject | XmlObject[] | undefined);

	for (let rIdx = 0; rIdx < Math.min(tableData.rows.length, xmlRows.length); rIdx++) {
		const dataRow = tableData.rows[rIdx];
		const xmlCells = ensureArray(xmlRows[rIdx]['a:tc'] as XmlObject | XmlObject[] | undefined);

		for (let cIdx = 0; cIdx < Math.min(dataRow.cells.length, xmlCells.length); cIdx++) {
			const cell = dataRow.cells[cIdx];
			const xmlCell = xmlCells[cIdx];

			// gridSpan
			if (cell.gridSpan !== undefined && cell.gridSpan > 1) {
				xmlCell['@_gridSpan'] = String(cell.gridSpan);
			} else {
				delete xmlCell['@_gridSpan'];
			}

			// rowSpan
			if (cell.rowSpan !== undefined && cell.rowSpan > 1) {
				xmlCell['@_rowSpan'] = String(cell.rowSpan);
			} else {
				delete xmlCell['@_rowSpan'];
			}

			// hMerge
			if (cell.hMerge) {
				xmlCell['@_hMerge'] = '1';
			} else {
				delete xmlCell['@_hMerge'];
			}

			// vMerge
			if (cell.vMerge) {
				xmlCell['@_vMerge'] = '1';
			} else {
				delete xmlCell['@_vMerge'];
			}

			// Sync cell text for merged cells that were cleared
			if (cell.text !== undefined) {
				xmlCell['a:txBody'] = rebuildCellTextBody(
					xmlCell['a:txBody'] as XmlObject | undefined,
					cell.text,
				);
			}
		}
	}

	return newRawXml;
}

// ── Structural XML synchronisation ────────────────────────────────────────

/** Create a default XML cell element (<a:tc>) for structural rebuilds. */
function createDefaultRebuildXmlCell(): XmlObject {
	return {
		'a:txBody': {
			'a:bodyPr': {},
			'a:lstStyle': {},
			'a:p': {
				'a:endParaRPr': { '@_lang': 'en-US' },
			},
		},
		'a:tcPr': {},
	};
}

/**
 * Deep-clone an element's rawXml and rebuild the table XML structure to match
 * the given `PptxTableData`. This handles adding/removing rows and columns
 * by rebuilding `<a:tblGrid>` and `<a:tr>` elements.
 *
 * Used when structural table operations (insert/delete row/column) change
 * the dimensions of the table.
 *
 * Returns the new rawXml object, or `undefined` if the element doesn't contain
 * an XML-based table.
 */
export function rebuildTableStructureInRawXml(
	element: PptxElement,
	tableData: PptxTableData,
): XmlObject | undefined {
	if (!element.rawXml) {
		return undefined;
	}

	const newRawXml = structuredClone(element.rawXml) as XmlObject;

	const table = getTblFromRawXml(newRawXml);
	if (!table) {
		return undefined;
	}

	// ── Compute total table width from existing grid ──
	const existingGridCols = ensureArray(
		(table['a:tblGrid'] as XmlObject | undefined)?.['a:gridCol'] as
			| XmlObject
			| XmlObject[]
			| undefined,
	);
	const totalWidthEmu =
		existingGridCols.reduce((sum, col) => {
			return sum + (parseInt(String(col?.['@_w'] || '0'), 10) || 0);
		}, 0) || 9144000; // fallback: ~960px

	// ── Rebuild a:tblGrid ──
	const newGridCols: XmlObject[] = tableData.columnWidths.map((w) => ({
		'@_w': String(Math.round(w * totalWidthEmu)),
	}));
	if (!table['a:tblGrid']) {
		table['a:tblGrid'] = {};
	}
	(table['a:tblGrid'] as XmlObject)['a:gridCol'] =
		newGridCols.length === 1 ? newGridCols[0] : newGridCols;

	// ── Rebuild a:tr ──
	const existingXmlRows = ensureArray(table['a:tr'] as XmlObject | XmlObject[] | undefined);

	const newXmlRows: XmlObject[] = tableData.rows.map((dataRow, ri) => {
		const existingRow = ri < existingXmlRows.length ? existingXmlRows[ri] : undefined;
		const existingCells = existingRow
			? ensureArray(existingRow['a:tc'] as XmlObject | XmlObject[] | undefined)
			: [];

		const heightEmu = dataRow.height
			? Math.round(dataRow.height * EMU_PER_PX)
			: existingRow?.['@_h']
				? parseInt(String(existingRow['@_h']), 10)
				: DEFAULT_ROW_HEIGHT_EMU;

		const newXmlCells: XmlObject[] = dataRow.cells.map((cell, ci) => {
			// Try to reuse existing cell XML for preserved cells
			let xmlCell: XmlObject;
			if (ci < existingCells.length) {
				xmlCell = structuredClone(existingCells[ci]) as XmlObject;
			} else {
				xmlCell = createDefaultRebuildXmlCell();
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

		return {
			'@_h': String(heightEmu),
			'a:tc': newXmlCells.length === 1 ? newXmlCells[0] : newXmlCells,
		} as XmlObject;
	});

	table['a:tr'] = newXmlRows.length === 1 ? newXmlRows[0] : newXmlRows;

	return newRawXml;
}
