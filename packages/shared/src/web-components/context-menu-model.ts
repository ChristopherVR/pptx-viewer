/** Layer for menus over the editor chrome. Above panels, below nothing the editor owns. */
export const CONTEXT_MENU_EDITOR_LAYER = 9000;
/** Layer for menus over a running slide show; above every binding's presentation overlay. */
export const CONTEXT_MENU_PRESENTATION_LAYER = 2147483001;

/** One row of a context menu. Hosts decide `id`, wording, gating and what activation does. */
export interface ContextMenuViewItem {
	/** Stable command id, echoed by `menu-request`. */
	id: string;
	/** Already-translated visible label. */
	label: string;
	/** Draw a rule before this row. */
	separatorBefore?: boolean;
	/** Group heading shown before this row; the row and the ones after it join that group. */
	heading?: string;
	/** Destructive command (Delete): tinted. */
	danger?: boolean;
	/** Offered but unavailable: announced and drawn dim, skipped by arrow keys. */
	disabled?: boolean;
	/** A toggle (Grid and Guides, Ruler) in this state; omitted for one-shot commands. */
	checked?: boolean;
}

/** Everything the controlled element needs to draw one menu. */
export interface ContextMenuViewState {
	/** Pointer position, in viewport pixels. The element clamps it into the window. */
	x: number;
	y: number;
	/** Accessible name of the menu. */
	label: string;
	items: readonly ContextMenuViewItem[];
	/**
	 * Test-hook attributes copied onto the host element (`data-pptx-context-menu`,
	 * `data-pptx-canvas-context-menu`, ...). Only `data-pptx-*` names are accepted.
	 */
	markers?: readonly string[];
	/** Stacking order; defaults to {@link CONTEXT_MENU_EDITOR_LAYER}. */
	zIndex?: number;
	/** Move focus onto the first command on open. Default true. */
	autoFocus?: boolean;
}

export type ContextMenuCloseReason = 'escape' | 'outside' | 'tab';

export interface ContextMenuRequestDetail {
	id: string;
}
export interface ContextMenuCloseDetail {
	reason: ContextMenuCloseReason;
}

export const EMPTY_CONTEXT_MENU_STATE: ContextMenuViewState = { x: 0, y: 0, label: '', items: [] };

/** Index of the next enabled row from `from` in `step` direction, wrapping; -1 if none. */
export function nextEnabledIndex(
	items: readonly { disabled?: boolean }[],
	from: number,
	step: 1 | -1,
): number {
	const count = items.length;
	for (let offset = 1; offset <= count; offset += 1) {
		const index = (((from + step * offset) % count) + count) % count;
		if (!items[index]?.disabled) {
			return index;
		}
	}
	return -1;
}

/**
 * Type-ahead target: the next enabled row after `from` whose label starts with `query`.
 * Repeating one character cycles through the rows that start with it.
 */
export function typeAheadIndex(
	items: readonly { label: string; disabled?: boolean }[],
	from: number,
	query: string,
): number {
	const needle = query.toLowerCase();
	const cycling = [...needle].every((char) => char === needle[0]);
	const prefix = cycling ? needle[0] : needle;
	for (let offset = cycling ? 1 : 0; offset <= items.length; offset += 1) {
		const index = (from + offset + items.length) % items.length;
		const item = items[index];
		if (
			item &&
			!item.disabled &&
			item.label
				.trim()
				.toLowerCase()
				.startsWith(prefix ?? '')
		) {
			return index;
		}
	}
	return -1;
}

const MARKER = /^data-pptx-[a-z0-9-]+$/;
export function isMarkerName(name: string): boolean {
	return MARKER.test(name);
}
