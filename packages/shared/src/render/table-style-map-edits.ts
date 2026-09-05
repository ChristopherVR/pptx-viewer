/**
 * Pure state-transition helpers for the table style DEFINITION editor's
 * persistence plumbing: turning an editor "map changed" / "delete style"
 * event into the next `{ tableStyleMap, tableStylesToDelete }` pair a
 * binding's mutable viewer state should hold, and picking the three
 * `ppt/tableStyles.xml` save option fields (`tableStyles`,
 * `tableStylesDefaultId`, `tableStylesToDelete` on `PptxHandlerSaveOptions`)
 * off that state for every `handler.save(...)` / `saveDeckWithPassword(...)`
 * call.
 *
 * Deleting a style adds its id to `tableStylesToDelete` because core needs a
 * separate opt-in list: a style id merely absent from `tableStyles` is
 * "untouched", not "delete" (see `PptxHandlerSaveOptions.tableStyles`'s own
 * doc comment in `packages/core/src/core/core/types.ts`). Adding a style
 * back under the same id (e.g. re-creating one with the same GUID) drops it
 * back out of `tableStylesToDelete`, since at that point it is no longer
 * meant to be removed on save.
 *
 * @module render/table-style-map-edits
 */
import type { ParsedTableStyleMap } from 'pptx-viewer-core';

import type { DeckSaveOptions } from './deck-save-encryption';

export interface TableStyleMapEditState {
	readonly tableStyleMap: ParsedTableStyleMap | undefined;
	readonly tableStylesToDelete: readonly string[];
}

export interface TableStyleMapEditResult {
	readonly tableStyleMap: ParsedTableStyleMap;
	readonly tableStylesToDelete: string[];
}

/**
 * Apply a whole-map replacement (an edit to one style's fill/text/borders/
 * cell3D facet via `applyTableStyleFieldEdit`, or a brand-new style added via
 * `createTableStyleEntry` + `addTableStyleToMap`) coming from the editor's
 * `onStyleMapChange` callback.
 */
export function applyTableStyleMapChange(
	state: TableStyleMapEditState,
	nextMap: ParsedTableStyleMap,
): TableStyleMapEditResult {
	return {
		tableStyleMap: nextMap,
		tableStylesToDelete: state.tableStylesToDelete.filter((id) => !(id in nextMap)),
	};
}

/**
 * Apply a style deletion coming from the editor's `onDeleteStyle` callback:
 * removes the entry from the map and records the id for save-time removal
 * from `ppt/tableStyles.xml`. Safe to call more than once for the same id.
 */
export function applyTableStyleDelete(
	state: TableStyleMapEditState,
	styleId: string,
): TableStyleMapEditResult {
	const nextMap: ParsedTableStyleMap = { ...(state.tableStyleMap ?? {}) };
	delete nextMap[styleId];
	return {
		tableStyleMap: nextMap,
		tableStylesToDelete: state.tableStylesToDelete.includes(styleId)
			? [...state.tableStylesToDelete]
			: [...state.tableStylesToDelete, styleId],
	};
}

export interface TableStyleSaveOptionsState {
	readonly tableStyleMap: ParsedTableStyleMap | undefined;
	readonly tableStylesDefaultId: string | undefined;
	readonly tableStylesToDelete: readonly string[];
}

export type TableStyleSaveOptions = Pick<
	DeckSaveOptions,
	'tableStyles' | 'tableStylesDefaultId' | 'tableStylesToDelete'
>;

/**
 * Pick the three `ppt/tableStyles.xml` save option fields off a viewer
 * state's table-style pieces, for spreading into every
 * `handler.save(...)` / `saveDeckWithPassword(...)` options object. Omits a
 * field entirely (rather than passing it as `undefined`) when there is
 * nothing to say, matching every other optional save-option picker in this
 * module.
 */
export function tableStyleSaveOptions(state: TableStyleSaveOptionsState): TableStyleSaveOptions {
	return {
		...(state.tableStyleMap ? { tableStyles: state.tableStyleMap } : {}),
		...(state.tableStylesDefaultId ? { tableStylesDefaultId: state.tableStylesDefaultId } : {}),
		...(state.tableStylesToDelete.length > 0
			? { tableStylesToDelete: [...state.tableStylesToDelete] }
			: {}),
	};
}

/**
 * The table-data patch to apply when the table-style DEFINITION editor's
 * "create new style" action (or the style gallery's "pick a style") assigns
 * `styleId` to the table being edited. A single-key object so every binding
 * spreads it through the exact same `updateTableData(...)` /
 * `onUpdateElement(...)` path the style gallery already uses, rather than
 * hand-rolling `{ tableStyleId: styleId }` five times.
 */
export function tableStyleAssignmentUpdate(styleId: string): { tableStyleId: string } {
	return { tableStyleId: styleId };
}
