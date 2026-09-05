/**
 * The one definition of what the canvas context menu contains.
 *
 * The five menus were written five times from scratch rather than ported from a
 * single item list, and their command sets drifted exactly as you would expect:
 * Vue had no Bring to Front, Angular had no Edit Hyperlink or Group, Svelte had
 * no table commands at all, and Vanilla had no menu whatsoever. Nothing crashes
 * when a binding omits a command, so each omission was only ever discoverable by
 * the user who right-clicked expecting it.
 *
 * This module owns the command ids, their labels, their order, the separators
 * between the groups, and the rules deciding which are offered. A binding
 * supplies the context (what was clicked, what is selected) and renders the
 * result; it does not decide what is in the menu. Adding a command here adds it
 * to all five at once, which is the point.
 *
 * The operations themselves stay in the bindings: each already owns clipboard,
 * z-order, grouping, comments, hyperlink and table mutation, and routing them is
 * a switch over {@link ContextMenuCommandId}.
 *
 * @module render/context-menu-commands
 */

/** Every command a canvas context menu can offer, in no particular order. */
export type ContextMenuCommandId =
	| 'copy'
	| 'cut'
	| 'paste'
	| 'duplicate'
	| 'bring-forward'
	| 'send-backward'
	| 'bring-front'
	| 'send-back'
	| 'ai-ask'
	| 'ai-fix'
	| 'comment'
	| 'hyperlink'
	| 'table-insert-row-above'
	| 'table-insert-row-below'
	| 'table-delete-row'
	| 'table-insert-col-left'
	| 'table-insert-col-right'
	| 'table-delete-col'
	| 'table-merge-selected'
	| 'table-merge-right'
	| 'table-merge-down'
	| 'table-split'
	| 'group'
	| 'ungroup'
	| 'delete';

/** One rendered entry: a command, plus how it is presented. */
export interface ContextMenuEntry {
	id: ContextMenuCommandId;
	/** i18n key; the binding translates it with its own translator. */
	labelKey: string;
	/** Draw a rule above this entry (it opens a new group of commands). */
	separatorBefore?: boolean;
	/** Destructive: tinted red, as PowerPoint tints Delete. */
	danger?: boolean;
	/** Offered but not usable right now (greyed out, still announced). */
	disabled?: boolean;
}

/** The table cell the menu was opened on, when it was opened on one. */
export interface ContextMenuTableContext {
	/** Two or more cells are selected, so the merge is a block merge. */
	hasMultiCellSelection: boolean;
	/** The cell already spans, so it can be split but not merged again. */
	isMergedCell: boolean;
}

/** What the menu is being opened on. */
export interface ContextMenuContext {
	/** `PptxElement['type']` of the right-clicked element, when known. */
	elementType?: string | null;
	/** The table cell context, or null when this is not a table cell. */
	table?: ContextMenuTableContext | null;
	/** Two or more elements are selected, so they can be grouped. */
	hasMultiSelection?: boolean;
	/**
	 * `a:spLocks/@noGrp` on any selected element (Group) or `a:grpSpLocks/@noGrp`
	 * on the right-clicked group itself (Ungroup) rejects the whole attempt.
	 * Omit when the binding has not computed it yet; the entry is then offered
	 * enabled, same as before this field existed.
	 */
	selectionGroupable?: boolean;
	/** The AI assistant is configured by the host. */
	aiEnabled?: boolean;
	/**
	 * Whether there is anything to paste. Omit when the binding does not track
	 * it: Paste is then offered enabled, which is what React has always done.
	 */
	hasClipboard?: boolean;
}

const LABEL_KEYS: Record<ContextMenuCommandId, string> = {
	copy: 'pptx.contextMenu.copy',
	cut: 'pptx.contextMenu.cut',
	paste: 'pptx.contextMenu.paste',
	duplicate: 'pptx.contextMenu.duplicate',
	'bring-forward': 'pptx.contextMenu.bringForward',
	'send-backward': 'pptx.contextMenu.sendBackward',
	'bring-front': 'pptx.contextMenu.bringToFront',
	'send-back': 'pptx.contextMenu.sendToBack',
	'ai-ask': 'pptx.ai.askAboutElement',
	'ai-fix': 'pptx.ai.fixElement',
	comment: 'pptx.contextMenu.addComment',
	hyperlink: 'pptx.contextMenu.editHyperlink',
	'table-insert-row-above': 'pptx.contextMenu.insertRowAbove',
	'table-insert-row-below': 'pptx.contextMenu.insertRowBelow',
	'table-delete-row': 'pptx.contextMenu.deleteRow',
	'table-insert-col-left': 'pptx.contextMenu.insertColumnLeft',
	'table-insert-col-right': 'pptx.contextMenu.insertColumnRight',
	'table-delete-col': 'pptx.contextMenu.deleteColumn',
	'table-merge-selected': 'pptx.contextMenu.mergeSelectedCells',
	'table-merge-right': 'pptx.contextMenu.mergeCells',
	'table-merge-down': 'pptx.table.mergeDown',
	'table-split': 'pptx.contextMenu.splitCell',
	group: 'pptx.contextMenu.group',
	ungroup: 'pptx.contextMenu.ungroup',
	delete: 'pptx.contextMenu.delete',
};

/** The i18n key for a command, so a binding never spells one out itself. */
export function contextMenuLabelKey(id: ContextMenuCommandId): string {
	return LABEL_KEYS[id];
}

function entry(id: ContextMenuCommandId, extra: Partial<ContextMenuEntry> = {}): ContextMenuEntry {
	return { id, labelKey: LABEL_KEYS[id], ...extra };
}

/** The table row / column / merge block, empty when no cell is selected. */
function tableEntries(table: ContextMenuTableContext | null | undefined): ContextMenuEntry[] {
	if (!table) {
		return [];
	}
	const rowsAndColumns: ContextMenuEntry[] = [
		entry('table-insert-row-above', { separatorBefore: true }),
		entry('table-insert-row-below'),
		entry('table-delete-row'),
		entry('table-insert-col-left'),
		entry('table-insert-col-right'),
		entry('table-delete-col'),
	];
	// A block selection merges as a block; a cell that already spans can only be
	// split; anything else offers the two pairwise merges.
	if (table.hasMultiCellSelection) {
		return [...rowsAndColumns, entry('table-merge-selected', { separatorBefore: true })];
	}
	if (table.isMergedCell) {
		return [...rowsAndColumns, entry('table-split', { separatorBefore: true })];
	}
	return [
		...rowsAndColumns,
		entry('table-merge-right', { separatorBefore: true }),
		entry('table-merge-down'),
	];
}

/**
 * The menu for `context`, in order, separators included.
 *
 * Group is offered only on a multi-selection and Ungroup only on a group, which
 * is how PowerPoint behaves and how React has always behaved: a permanently
 * present, permanently greyed Group is noise on a single shape.
 */
export function buildContextMenuEntries(context: ContextMenuContext = {}): ContextMenuEntry[] {
	const { elementType, table, hasMultiSelection, aiEnabled, hasClipboard, selectionGroupable } =
		context;
	const lockedOut = selectionGroupable === false;
	const entries: ContextMenuEntry[] = [
		entry('copy'),
		entry('cut'),
		entry('paste', hasClipboard === false ? { disabled: true } : {}),
		entry('duplicate'),
		entry('bring-forward', { separatorBefore: true }),
		entry('send-backward'),
		entry('bring-front'),
		entry('send-back'),
	];
	if (aiEnabled) {
		entries.push(entry('ai-ask', { separatorBefore: true }), entry('ai-fix'));
	}
	entries.push(entry('comment', { separatorBefore: true }), entry('hyperlink'));
	entries.push(...tableEntries(table));
	if (hasMultiSelection) {
		entries.push(
			entry('group', { separatorBefore: true, ...(lockedOut ? { disabled: true } : {}) }),
		);
	}
	if (elementType === 'group') {
		entries.push(
			entry('ungroup', {
				separatorBefore: !hasMultiSelection,
				...(lockedOut ? { disabled: true } : {}),
			}),
		);
	}
	entries.push(
		entry('delete', {
			separatorBefore: !hasMultiSelection && elementType !== 'group',
			danger: true,
		}),
	);
	return entries;
}
