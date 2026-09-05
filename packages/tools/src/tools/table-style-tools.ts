import {
	addTableStyleToMap,
	createTableStyleEntry,
	deleteTableStyleFromMap,
	normalizeTableStyleGuid,
	TABLE_STYLE_PART_SEQUENCE,
} from 'pptx-viewer-core';
import type {
	ParsedTableStyleBorders,
	ParsedTableStyleFill,
	ParsedTableStyleText,
	PptxTableCell3D,
	TablePptxElement,
	TableStylePartName,
} from 'pptx-viewer-core';

import type { ToolContext, ToolResult } from '../types.js';
import { validateSlideIndex } from './helpers.js';

function findTableElement(
	ctx: ToolContext,
	slideIndex: number,
	elementId: string,
): TablePptxElement {
	const err = validateSlideIndex(slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}
	const slide = ctx.pptxData.slides[slideIndex];
	const el = slide.elements.find((e) => e.id === elementId);
	if (!el) {
		throw new Error(`Element '${elementId}' not found on slide ${slideIndex}.`);
	}
	if (el.type !== 'table') {
		throw new Error(`Element '${elementId}' is not a table.`);
	}
	return el;
}

/** Every table id (`a:tblPr/a:tableStyleId`) referenced anywhere in the deck. */
function tableStyleIdsInUse(ctx: ToolContext): Set<string> {
	const used = new Set<string>();
	for (const slide of ctx.pptxData.slides) {
		for (const el of slide.elements) {
			if (el.type === 'table' && el.tableData?.tableStyleId) {
				used.add(normalizeTableStyleGuid(el.tableData.tableStyleId));
			}
		}
	}
	return used;
}

// ── setTableStyleSection ─────────────────────────────────────────────────────

export interface SetTableStyleSectionParams {
	styleId: string;
	section: TableStylePartName;
	styleName?: string;
	fill?: ParsedTableStyleFill;
	text?: ParsedTableStyleText;
	borders?: ParsedTableStyleBorders;
	cell3D?: PptxTableCell3D;
}

/**
 * Patch one facet (fill/text/borders/cell3D) of one `CT_TableStyle` section
 * on an EXISTING style in `pptxData.tableStyleMap`. Facets not supplied are
 * left untouched (matches `applyTableStyleEntryToNode`'s merge semantics).
 * Throws if `styleId` names no loaded style: use `create_table_style` first.
 */
export function setTableStyleSection(
	ctx: ToolContext,
	params: SetTableStyleSectionParams,
): ToolResult<{ styleId: string; section: TableStylePartName }> {
	if (!TABLE_STYLE_PART_SEQUENCE.includes(params.section)) {
		throw new Error(
			`Unknown table style section '${params.section}'. Valid sections: ${TABLE_STYLE_PART_SEQUENCE.join(', ')}.`,
		);
	}
	const map = ctx.pptxData.tableStyleMap ?? {};
	ctx.pptxData.tableStyleMap = map;
	const normalizedId = normalizeTableStyleGuid(params.styleId);
	const entry = map[normalizedId];
	if (!entry) {
		throw new Error(
			`Table style '${params.styleId}' is not loaded in this presentation. Use create_table_style to add a new one.`,
		);
	}

	if (params.styleName !== undefined) {
		entry.styleName = params.styleName;
	}
	// `ParsedTableStyleEntry` declares each of the 13 sections x 4 facets as
	// its own named optional field (no index signature), so a dynamic
	// `${section}Fill`-style key needs an explicit widening before it can be
	// assigned through; `unknown` as the intermediate step (never `any`).
	const mutableEntry = entry as unknown as Record<
		string,
		ParsedTableStyleFill | ParsedTableStyleText | ParsedTableStyleBorders | PptxTableCell3D
	>;
	if (params.fill !== undefined) {
		mutableEntry[`${params.section}Fill`] = params.fill;
	}
	if (params.text !== undefined) {
		mutableEntry[`${params.section}Text`] = params.text;
	}
	if (params.borders !== undefined) {
		mutableEntry[`${params.section}Borders`] = params.borders;
	}
	if (params.cell3D !== undefined) {
		mutableEntry[`${params.section}Cell3D`] = params.cell3D;
	}

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { styleId: normalizedId, section: params.section },
	};
}

// ── createTableStyle ─────────────────────────────────────────────────────────

export interface CreateTableStyleParams {
	styleName: string;
	/** Deep-clone every section from this existing style GUID as the starting point. */
	basedOnStyleId?: string;
	/** Repoint `ppt/tableStyles.xml`'s `@def` at the new style on save. */
	setAsDefault?: boolean;
}

export function createTableStyle(
	ctx: ToolContext,
	params: CreateTableStyleParams,
): ToolResult<{ styleId: string }> {
	const map = ctx.pptxData.tableStyleMap ?? {};
	ctx.pptxData.tableStyleMap = map;

	const basedOn = params.basedOnStyleId
		? map[normalizeTableStyleGuid(params.basedOnStyleId)]
		: undefined;
	if (params.basedOnStyleId && !basedOn) {
		throw new Error(`basedOnStyleId '${params.basedOnStyleId}' is not a loaded table style.`);
	}

	const entry = createTableStyleEntry(map, { styleName: params.styleName, basedOn });
	addTableStyleToMap(map, entry);

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { styleId: entry.styleId },
		...(params.setAsDefault ? { saveOptions: { tableStylesDefaultId: entry.styleId } } : {}),
	};
}

// ── deleteTableStyle ─────────────────────────────────────────────────────────

export interface DeleteTableStyleParams {
	styleId: string;
	/** Delete even though a table on some slide still references this style. */
	force?: boolean;
}

export function deleteTableStyle(
	ctx: ToolContext,
	params: DeleteTableStyleParams,
): ToolResult<{ deleted: boolean }> {
	const normalizedId = normalizeTableStyleGuid(params.styleId);

	if (!params.force) {
		const used = tableStyleIdsInUse(ctx);
		if (used.has(normalizedId)) {
			throw new Error(
				`Table style '${params.styleId}' is assigned to at least one table on this deck. ` +
					'Reassign those tables first, or pass force: true.',
			);
		}
	}

	const map = ctx.pptxData.tableStyleMap ?? {};
	ctx.pptxData.tableStyleMap = map;
	deleteTableStyleFromMap(map, normalizedId);

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { deleted: true },
		saveOptions: { tableStylesToDelete: [normalizedId] },
	};
}

// ── assignTableStyle ─────────────────────────────────────────────────────────

export interface AssignTableStyleParams {
	slideIndex: number;
	elementId: string;
	/**
	 * Defaults to `pptxData.tableStylesDefaultId` (the deck's current
	 * `ppt/tableStyles.xml/a:tblStyleLst/@def`) when omitted, matching what
	 * PowerPoint's "Insert > Table" applies without an explicit style choice.
	 */
	styleId?: string;
	bandedRows?: boolean;
	bandedColumns?: boolean;
	firstRowHeader?: boolean;
	lastRow?: boolean;
	firstCol?: boolean;
	lastCol?: boolean;
}

/**
 * Assign a table style (and, optionally, the row/column emphasis flags that
 * decide which of its sections actually show) to an EXISTING table element.
 * `tableData.tableStyleId` already round-trips through the save pipeline for
 * both new and previously-loaded tables (`save-table-merge-helpers.ts`); this
 * tool just exposes that assignment over MCP.
 */
export function assignTableStyle(
	ctx: ToolContext,
	params: AssignTableStyleParams,
): ToolResult<{ elementId: string; styleId: string }> {
	const el = findTableElement(ctx, params.slideIndex, params.elementId);
	if (!el.tableData) {
		throw new Error(`Table '${params.elementId}' has no tableData.`);
	}

	const styleId = params.styleId ?? ctx.pptxData.tableStylesDefaultId;
	if (!styleId) {
		throw new Error(
			'styleId was not provided and this presentation has no tableStylesDefaultId to fall back to.',
		);
	}
	const normalizedId = normalizeTableStyleGuid(styleId);
	el.tableData.tableStyleId = normalizedId;
	if (params.bandedRows !== undefined) {
		el.tableData.bandedRows = params.bandedRows;
	}
	if (params.bandedColumns !== undefined) {
		el.tableData.bandedColumns = params.bandedColumns;
	}
	if (params.firstRowHeader !== undefined) {
		el.tableData.firstRowHeader = params.firstRowHeader;
	}
	if (params.lastRow !== undefined) {
		el.tableData.lastRow = params.lastRow;
	}
	if (params.firstCol !== undefined) {
		el.tableData.firstCol = params.firstCol;
	}
	if (params.lastCol !== undefined) {
		el.tableData.lastCol = params.lastCol;
	}

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { elementId: params.elementId, styleId: normalizedId },
	};
}
