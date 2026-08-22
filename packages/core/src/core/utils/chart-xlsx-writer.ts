/**
 * Write chart-edited values back into an embedded xlsx workbook
 * (`ppt/embeddings/*.xlsx`).
 *
 * A PowerPoint chart caches its source data twice: once in the chart part's
 * `c:numCache`/`c:strCache`, and once in a real embedded workbook that
 * `c:externalData` points at. Editing a chart in this codebase only ever
 * patched the first copy, so "Edit Data in Excel" (and any recalculation
 * inside Excel) kept reverting the user's edit. This module targets the
 * SECOND copy.
 *
 * Design: each series' `c:tx`/`c:cat`/`c:val` (or `c:xVal`/`c:yVal`) carries
 * a `c:f` formula string naming the exact worksheet cells it was populated
 * from (e.g. `"Sheet1!$B$2:$B$4"`). Rather than guessing at a grid layout,
 * this module resolves that formula to a worksheet part and the exact cell
 * addresses it names, and rewrites only those cells. Everything else in the
 * workbook - other sheets, styles, formatting, unrelated cells - is left
 * exactly as parsed.
 *
 * Scope: only a straight vector reference (one row or one column) whose
 * length still matches the edited data is written back; see
 * {@link expandRangeAddresses}. A structural change (a series/category
 * added or removed) is left cache-only, counted in
 * {@link ChartWorkbookWriteResult.unresolved} for the caller to surface as
 * a compatibility warning. This never throws: any parse/read failure is
 * folded into `unresolved` the same way.
 *
 * @module chart-xlsx-writer
 */

import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';

import type { IPptxXmlLookupService } from '../services';
import type { XmlObject } from '../types';
import { expandRangeAddresses, parseChartFormulaRange } from './chart-xlsx-cellref';
import type { ChartCellWrite } from './chart-xlsx-sheet-cells';
import { applyCellWritesToWorksheet } from './chart-xlsx-sheet-cells';
import { xmlAttr, xmlChild, xmlChildren } from './xml-access';
import { preservesSpreadsheetXmlWhitespace } from './xml-whitespace';

/** One chart data reference (series name, category, or value list) to write back. */
export interface PptxChartWorkbookWrite {
	/** The `c:f` formula string naming the source cells (e.g. `"Sheet1!$B$2:$B$4"`). */
	formula: string;
	isNumeric: boolean;
	/** Values in on-sheet order, one per cell the formula range names. */
	values: string[];
}

/** Result of attempting to apply a batch of writes to an embedded workbook. */
export interface ChartWorkbookWriteResult {
	/** Updated xlsx bytes; present only when at least one cell actually changed. */
	bytes?: Uint8Array;
	/**
	 * Count of {@link PptxChartWorkbookWrite} entries that could not be
	 * matched to a worksheet cell range (unresolvable sheet name, a formula
	 * this module does not parse, a worksheet part that could not be read,
	 * or a point-count mismatch against the original range).
	 */
	unresolved: number;
}

/**
 * Build the `c:f` formula write for one chart cache container (a series'
 * `c:tx`, `c:cat`/`c:xVal`, or `c:val`/`c:yVal`), given the values already
 * written to its cache. Returns `undefined` when the container has no
 * `numRef`/`strRef` formula reference - e.g. a brand-new series built
 * without one, or a `numLit`/`strLit` inline literal - since there is then
 * no linked worksheet range to update.
 */
export function collectChartWorkbookWrite(
	xmlLookupService: IPptxXmlLookupService,
	container: XmlObject | undefined,
	isNumeric: boolean,
	values: string[],
): PptxChartWorkbookWrite | undefined {
	if (!container) {
		return undefined;
	}
	const refNode = xmlLookupService.getChildByLocalName(container, isNumeric ? 'numRef' : 'strRef');
	const formula = refNode ? xmlLookupService.getScalarChildByLocalName(refNode, 'f') : undefined;
	return formula ? { formula, isNumeric, values } : undefined;
}

function createSpreadsheetXmlParser(): XMLParser {
	return new XMLParser({
		ignoreAttributes: false,
		attributeNamePrefix: '@_',
		trimValues: false,
		tagValueProcessor: (tagName: string, tagValue: string) =>
			preservesSpreadsheetXmlWhitespace(tagName) ? tagValue : tagValue.trim(),
	});
}

function createSpreadsheetXmlBuilder(): XMLBuilder {
	return new XMLBuilder({
		ignoreAttributes: false,
		attributeNamePrefix: '@_',
		suppressBooleanAttributes: false,
		format: false,
	});
}

/** Resolve `sheetName -> worksheet part path` from `xl/workbook.xml` + its rels. */
async function resolveWorksheetPathsByName(
	xlsxZip: JSZip,
	parser: XMLParser,
): Promise<Map<string, string>> {
	const result = new Map<string, string>();
	const workbookFile = xlsxZip.file('xl/workbook.xml');
	const relsFile = xlsxZip.file('xl/_rels/workbook.xml.rels');
	if (!workbookFile || !relsFile) {
		return result;
	}
	try {
		const workbookTree = parser.parse(await workbookFile.async('string')) as XmlObject;
		const relsTree = parser.parse(await relsFile.async('string')) as XmlObject;

		const targetByRelId = new Map<string, string>();
		const relationships = xmlChild(relsTree, 'Relationships');
		for (const rel of xmlChildren(relationships, 'Relationship')) {
			const id = xmlAttr(rel, 'Id');
			const target = xmlAttr(rel, 'Target');
			if (id && target) {
				targetByRelId.set(id, target);
			}
		}

		const workbookRoot = xmlChild(workbookTree, 'workbook');
		const sheets = xmlChild(workbookRoot, 'sheets');
		for (const sheet of xmlChildren(sheets, 'sheet')) {
			const name = xmlAttr(sheet, 'name');
			const relId = xmlAttr(sheet, 'r:id') ?? xmlAttr(sheet, 'id');
			const target = relId ? targetByRelId.get(relId) : undefined;
			if (name && target) {
				result.set(name.toLowerCase(), resolveWorkbookPartPath(target));
			}
		}
	} catch {
		// Malformed workbook.xml / rels: return whatever was found, if anything.
	}
	return result;
}

/** Worksheet relationship targets are always relative to the `xl/` directory. */
function resolveWorkbookPartPath(target: string): string {
	return target.startsWith('/') ? target.slice(1) : `xl/${target}`;
}

interface ResolvedWrite {
	refs: string[];
	values: string[];
	isNumeric: boolean;
}

/**
 * Rewrite an embedded xlsx workbook's cells to match a chart's edited data.
 *
 * Never throws: any failure (a corrupt xlsx, a missing worksheet, a formula
 * this module cannot resolve) is absorbed into
 * {@link ChartWorkbookWriteResult.unresolved} so the caller can degrade
 * safely - keep the chart's cache-only edit and surface a compatibility
 * warning - rather than fail the whole save.
 */
export async function writeChartWorkbookUpdates(
	xlsxBytes: Uint8Array,
	writes: readonly PptxChartWorkbookWrite[],
): Promise<ChartWorkbookWriteResult> {
	if (writes.length === 0) {
		return { unresolved: 0 };
	}

	let xlsxZip: JSZip;
	try {
		xlsxZip = await JSZip.loadAsync(xlsxBytes);
	} catch {
		return { unresolved: writes.length };
	}

	const parser = createSpreadsheetXmlParser();
	const sheetPathByName = await resolveWorksheetPathsByName(xlsxZip, parser);

	const writesBySheetPath = new Map<string, ResolvedWrite[]>();
	let unresolved = 0;
	for (const write of writes) {
		const range = parseChartFormulaRange(write.formula);
		const sheetPath = range ? sheetPathByName.get(range.sheetName.toLowerCase()) : undefined;
		const refs = range ? expandRangeAddresses(range, write.values.length) : undefined;
		if (!range || !sheetPath || !refs) {
			unresolved += 1;
			continue;
		}
		const bucket = writesBySheetPath.get(sheetPath) ?? [];
		bucket.push({ refs, values: write.values, isNumeric: write.isNumeric });
		writesBySheetPath.set(sheetPath, bucket);
	}

	const builder = createSpreadsheetXmlBuilder();
	let changedAny = false;
	for (const [sheetPath, resolvedWrites] of writesBySheetPath) {
		const sheetFile = xlsxZip.file(sheetPath);
		if (!sheetFile) {
			unresolved += resolvedWrites.length;
			continue;
		}
		try {
			const sheetTree = parser.parse(await sheetFile.async('string')) as XmlObject;
			const cellWrites: ChartCellWrite[] = resolvedWrites.flatMap(({ refs, values, isNumeric }) =>
				refs.map((ref, i) => ({ ref, isNumeric, value: values[i] })),
			);
			if (applyCellWritesToWorksheet(sheetTree, cellWrites)) {
				xlsxZip.file(sheetPath, builder.build(sheetTree) as string);
				changedAny = true;
			}
		} catch {
			unresolved += resolvedWrites.length;
		}
	}

	if (!changedAny) {
		return { unresolved };
	}

	const bytes = await xlsxZip.generateAsync({
		type: 'uint8array',
		compression: 'DEFLATE',
		compressionOptions: { level: 6 },
	});
	return { bytes, unresolved };
}
