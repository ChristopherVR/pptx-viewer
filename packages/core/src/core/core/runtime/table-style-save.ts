/**
 * table-style-save.ts - orchestrates the write-side mirror of
 * `table-style-fill-parse.ts`, `table-style-border-parse.ts`, and
 * `table-style-entry-parse.ts`: serialises a {@link ParsedTableStyleEntry}
 * edit back onto an existing (or brand-new) `<a:tblStyle>` XML node.
 *
 * Covers ALL 13 `CT_TableStyle` parts (`a:wholeTbl`, banding, first/last
 * row/col, the four corner cells) across every facet the parse side captures
 * - fill, text, borders (including the `tl2br`/`tr2bl` diagonals), `cell3D`
 * bevel/lighting - plus the table-level background (`a:tblBg`'s
 * `a:fill`/`a:fillRef` choice). The per-facet writers live in their own
 * modules (`table-style-fill-write.ts`, `table-style-text-write.ts`,
 * `table-style-border-write.ts`) to stay within the file-size budget; this
 * module is just the section loop, ordering, and typed lookups.
 *
 * Before this module, `PptxHandlerRuntimeSaveViewProperties.ts` only wrote
 * `wholeTbl`/banding/first-last-row-col FILL and TEXT (9 of 13 sections, 2 of
 * 4 facets): editing a corner cell, a border, a bevel, or the table
 * background was silently dropped on save even though all of them parse into
 * the typed model. This closes that gap so "edit an existing deck-authored
 * table style" is native end-to-end, matching the read side exactly.
 *
 * @module table-style-save
 */
import type {
	ParsedTableStyleBorders,
	ParsedTableStyleEntry,
	ParsedTableStyleFill,
	ParsedTableStyleText,
	PptxTableCell3D,
	XmlObject,
} from '../../types';
import { reorderObjectKeys } from '../../utils/xml-reorder';
import {
	writeTableStyleSectionBorders,
	writeTableStyleSectionCell3D,
} from './table-style-border-write';
import { TABLE_STYLE_PART_SEQUENCE } from './table-style-entry-parse';
import type { TableStylePartName } from './table-style-entry-parse';
import { writeTableBackground, writeTableStyleSectionFill } from './table-style-fill-write';
import { writeTableStyleSectionText } from './table-style-text-write';
import { ensureChild } from './table-style-xml-helpers';

/** `CT_TableStyleCellStyle` child order (§21.1.3.14): border, fill choice, cell3D. */
const TC_STYLE_ORDER: readonly string[] = ['a:tcBdr', 'a:fill', 'a:cell3D'];

/** A table-style part's own child order: text style, then cell style. */
const PART_ORDER: readonly string[] = ['a:tcTxStyle', 'a:tcStyle'];

/** `a:tblStyle`'s own child order: background first, then the 13 parts in schema order. */
const STYLE_NODE_CHILD_ORDER: readonly string[] = [
	'a:tblBg',
	...TABLE_STYLE_PART_SEQUENCE.map((name) => `a:${name}`),
];

/**
 * Apply parsed fill/text/border/cell3D/background edits onto a single
 * `a:tblStyle` XML node, covering all 13 `CT_TableStyle` parts. Sections and
 * facets not present on `entry` are left completely untouched, so a caller
 * may patch just one facet of one section without disturbing the rest.
 */
export function applyTableStyleEntryToNode(
	styleNode: XmlObject,
	entry: ParsedTableStyleEntry,
): void {
	for (const name of TABLE_STYLE_PART_SEQUENCE) {
		const fill = sectionFill(entry, name);
		const text = sectionText(entry, name);
		const borders = sectionBorders(entry, name);
		const cell3D = sectionCell3D(entry, name);
		if (!fill && !text && !borders && !cell3D) {
			continue;
		}
		const xmlKey = `a:${name}`;
		const section = ensureChild(styleNode, xmlKey);
		if (fill) {
			writeTableStyleSectionFill(section, fill);
		}
		if (borders) {
			writeTableStyleSectionBorders(section, borders);
		}
		if (cell3D) {
			writeTableStyleSectionCell3D(section, cell3D);
		}
		if (text) {
			writeTableStyleSectionText(section, text);
		}
		const tcStyle = section['a:tcStyle'];
		if (tcStyle && typeof tcStyle === 'object' && !Array.isArray(tcStyle)) {
			section['a:tcStyle'] = reorderObjectKeys(tcStyle as XmlObject, TC_STYLE_ORDER);
		}
		styleNode[xmlKey] = reorderObjectKeys(section, PART_ORDER);
	}

	if (entry.tableBackground) {
		writeTableBackground(styleNode, entry.tableBackground);
	}

	const reordered = reorderObjectKeys(styleNode, STYLE_NODE_CHILD_ORDER);
	for (const key of Object.keys(styleNode)) {
		delete styleNode[key];
	}
	for (const key of Object.keys(reordered)) {
		styleNode[key] = reordered[key];
	}
}

// ── Typed section-facet lookups on ParsedTableStyleEntry ────────────────────
// `ParsedTableStyleEntry` declares each of the 13 parts x 4 facets as its own
// named optional field (no index signature), so a template-literal lookup
// keyed by the shared `TableStylePartName` union type-checks directly against
// those field names without a cast.

function sectionFill(
	entry: ParsedTableStyleEntry,
	name: TableStylePartName,
): ParsedTableStyleFill | undefined {
	return entry[`${name}Fill`];
}

function sectionText(
	entry: ParsedTableStyleEntry,
	name: TableStylePartName,
): ParsedTableStyleText | undefined {
	return entry[`${name}Text`];
}

function sectionBorders(
	entry: ParsedTableStyleEntry,
	name: TableStylePartName,
): ParsedTableStyleBorders | undefined {
	return entry[`${name}Borders`];
}

function sectionCell3D(
	entry: ParsedTableStyleEntry,
	name: TableStylePartName,
): PptxTableCell3D | undefined {
	return entry[`${name}Cell3D`];
}
