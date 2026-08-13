import { isEditorTextInputTarget, mapEditorKey } from 'pptx-viewer-shared';
/**
 * useKeyboardShortcuts: the editor keymap, wired into React.
 *
 * Key-to-action resolution lives in `pptx-viewer-shared`'s `mapEditorKey`, the
 * one map all five bindings share; this hook only snapshots the guard state,
 * dispatches, and owns the listener lifetime.
 *
 * The listener is registered on `window` exactly once. It used to be registered
 * on the viewer container *as well*, "as a fallback", which meant every key
 * whose target sat inside the container was handled twice: Ctrl+D produced two
 * duplicates, Ctrl+V two pastes, an arrow nudged two steps and skipped two
 * slides. A `window` listener already sees events from inside the container
 * (they bubble), so the container listener was never a fallback, only a second
 * delivery.
 */
import { useEffect, useCallback, useRef } from 'react';

import type { TableCellEditorState, DrawingTool } from '../types';
import type { ViewerMode } from '../types-core';

/* ------------------------------------------------------------------ */
/*  Input interface                                                   */
/* ------------------------------------------------------------------ */

export interface UseKeyboardShortcutsInput {
	/** Container element ref, kept for API compatibility with the shell. */
	containerRef: React.RefObject<HTMLDivElement | null>;

	mode: ViewerMode;
	canEdit: boolean;

	/** Whether any element is currently being inline-edited (text box). */
	inlineEditingElementId: string | null;
	/** Whether a table cell is being edited. */
	tableEditorState: TableCellEditorState | null;
	/** Current drawing tool: shortcuts are suppressed when drawing. */
	activeTool: DrawingTool;

	/** Whether at least one element is selected. */
	hasSelection: boolean;
	/** The IDs of the currently selected elements (effective). */
	effectiveSelectedIds: string[];

	// -- Action callbacks --------------------------------------------
	onDelete: () => void;
	onCopy: () => void;
	onCut: () => void;
	onPaste: () => void;
	onDuplicate: () => void;
	onUndo: () => void;
	onRedo: () => void;
	onSelectAll: () => void;
	onEscape: () => void;
	/** Move selected elements by (dx, dy). */
	onNudge: (dx: number, dy: number) => void;
	/** Group the selection into one group element (Ctrl/Cmd+G). */
	onGroup?: () => void;
	/** Ungroup the selected group (Ctrl/Cmd+Shift+G). */
	onUngroup?: () => void;
	/** Show or hide the keyboard-shortcut reference ("?"). */
	onToggleShortcuts?: () => void;
	/**
	 * Open or close the find bar (Ctrl/Cmd+F). Left unwired by the default
	 * shell, where `useFindReplace` owns the find state and resolves the same
	 * chord against the same shared keymap; the case exists so the switch stays
	 * exhaustive and so a host driving this hook directly can handle it.
	 */
	onFind?: () => void;
	/** Navigate to previous visible slide (edit mode, no selection). */
	onPrevSlide?: () => void;
	/** Navigate to next visible slide (edit mode, no selection). */
	onNextSlide?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useKeyboardShortcuts(input: UseKeyboardShortcutsInput): void {
	// Store everything in a ref so the keydown closure never goes stale
	// and we don't need to re-attach the listener on every render.
	const inputRef = useRef(input);
	inputRef.current = input;

	const handleKeyDown = useCallback((e: KeyboardEvent) => {
		const current = inputRef.current;
		const { action, dx, dy } = mapEditorKey(e, {
			canEdit: current.canEdit,
			// The Slide Master view is an editing surface, not a viewing one.
			// Gating on `mode !== 'edit'` alone made `mapEditorKey` return
			// NO_ACTION there, so Delete, the arrow-key nudges and the clipboard
			// keys were all inert over a master shape even though the write path
			// behind them routes to the owning part correctly. Svelte and
			// vanilla, which render the master into their ordinary editable
			// stage, never had the gap.
			isPresenting: current.mode !== 'edit' && current.mode !== 'master',
			hasSelection: current.hasSelection,
			isEditingText: Boolean(current.inlineEditingElementId || current.tableEditorState?.isEditing),
			isDrawing: current.activeTool !== 'select',
			isTextInputTarget: isEditorTextInputTarget(e.target),
		});
		if (action === null) {
			return;
		}
		e.preventDefault();

		switch (action) {
			case 'escape':
				current.onEscape();
				break;
			case 'delete':
				current.onDelete();
				break;
			case 'undo':
				current.onUndo();
				break;
			case 'redo':
				current.onRedo();
				break;
			case 'copy':
				current.onCopy();
				break;
			case 'cut':
				current.onCut();
				break;
			case 'paste':
				current.onPaste();
				break;
			case 'duplicate':
				current.onDuplicate();
				break;
			case 'selectAll':
				current.onSelectAll();
				break;
			case 'group':
				current.onGroup?.();
				break;
			case 'ungroup':
				current.onUngroup?.();
				break;
			case 'toggleShortcuts':
				current.onToggleShortcuts?.();
				break;
			case 'find':
				current.onFind?.();
				break;
			case 'nudge':
				current.onNudge(dx ?? 0, dy ?? 0);
				break;
			case 'prevSlide':
				current.onPrevSlide?.();
				break;
			case 'nextSlide':
				current.onNextSlide?.();
				break;
			default:
				break;
		}
	}, []);

	useEffect(() => {
		// Once, on window: keydown from anywhere inside the viewer bubbles here,
		// so a second container-scoped listener would only double-fire.
		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, [handleKeyDown]);
}
