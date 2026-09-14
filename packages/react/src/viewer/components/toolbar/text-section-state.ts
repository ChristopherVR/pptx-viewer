/**
 * Pure state readers for the ribbon's TextSection (Home > Font / Paragraph):
 * what the toggles show as pressed and what a click decides from. The
 * decisions live in shared (`selection-format-state`, `bullet-toggle`); this
 * only adds the table-cell fallback the React ribbon supports.
 */
import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import {
	elementBulletKind,
	selectionBulletKind,
	getInlineEditorSelectionResult,
	getSelectionTextStyleFlags,
	TEXT_DECORATION_FLAGS,
} from 'pptx-viewer-shared';
import type {
	ElementBulletKind,
	SelectionTextStyleFlags,
	TextDecorationFlag,
} from 'pptx-viewer-shared';

import type { TableCellEditorState } from '../../types';

/**
 * Returns the text style currently in effect for toolbar controls:
 * - For text/shape/connector elements, the element's own `textStyle`.
 * - For tables with a focused cell, that cell's style (a superset of the
 *   relevant `TextStyle` fields like `bold`/`italic`/`underline`/`fontSize`).
 * - `undefined` otherwise.
 *
 * Without this lookup, table-cell toggles always read `undefined` (since
 * `hasTextProperties` is false for tables) and `!undefined === true`, so
 * re-clicking Bold/Italic/Underline never turns the formatting off.
 */
export function getEffectiveTextStyle(
	element: PptxElement | null,
	tableEditorState: TableCellEditorState | null | undefined,
): Partial<TextStyle> | undefined {
	if (!element) {
		return undefined;
	}
	if (hasTextProperties(element)) {
		return element.textStyle;
	}
	if (element.type === 'table' && tableEditorState && element.tableData) {
		const cell =
			element.tableData.rows[tableEditorState.rowIndex]?.cells[tableEditorState.columnIndex];
		return cell?.style as Partial<TextStyle> | undefined;
	}
	return undefined;
}

/** Whether a ribbon button id is one of the four decoration toggles. */
export function isTextDecorationFlag(id: string): id is TextDecorationFlag {
	return (TEXT_DECORATION_FLAGS as readonly string[]).includes(id);
}

/**
 * The tri-state of the four decoration toggles: from the runs of a text
 * element (the runs the inline selection covers when `readSelection` is set,
 * which touches the DOM), or from the cell style of a focused table cell.
 */
export function textSectionFlags(
	element: PptxElement | null,
	tableEditorState: TableCellEditorState | null | undefined,
	readSelection: boolean,
): SelectionTextStyleFlags {
	if (element && hasTextProperties(element)) {
		const result = readSelection ? getInlineEditorSelectionResult(element.textSegments) : null;
		const current =
			result?.kind === 'supported' && (!result.snapshot || result.snapshot.elementId === element.id)
				? result
				: null;
		return getSelectionTextStyleFlags(
			current?.snapshot?.textSegments ?? element.textSegments,
			current?.selection ?? null,
			element.textStyle,
		);
	}
	return getSelectionTextStyleFlags(
		undefined,
		null,
		getEffectiveTextStyle(element, tableEditorState),
	);
}

/**
 * The list state the Bullets / Numbering buttons show: the paragraphs' real
 * `bulletInfo` for a text element, the cell style's `listType` for a table
 * cell (the only place that flag still means anything).
 */
export function textSectionBulletKind(
	element: PptxElement | null,
	tableEditorState: TableCellEditorState | null | undefined,
): ElementBulletKind {
	if (element && hasTextProperties(element)) {
		const result = getInlineEditorSelectionResult(element.textSegments, { preserveCaret: true });
		return result.kind === 'supported' &&
			(!result.snapshot || result.snapshot.elementId === element.id)
			? selectionBulletKind(element, result.selection, result.snapshot?.textSegments)
			: elementBulletKind(element);
	}
	return getEffectiveTextStyle(element, tableEditorState)?.listType ?? 'none';
}
