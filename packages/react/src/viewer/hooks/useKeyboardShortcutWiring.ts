/**
 * useKeyboardShortcutWiring: Wires the composed editor results into the
 * generic `useKeyboardShortcuts` hook.  Keeps the orchestrator lean.
 */
import type { PptxSlide } from 'pptx-viewer-core';

import type { ViewerMode } from '../types-core';
import type { EditorHistoryResult } from './useEditorHistory';
import type { ElementManipulationHandlers } from './useElementManipulation';
import type { ElementOperations } from './useElementOperations';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import type { ViewerState } from './useViewerState';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface UseKeyboardShortcutWiringInput {
	state: ViewerState;
	mode: ViewerMode;
	canEdit: boolean;
	slides: PptxSlide[];
	activeSlide: PptxSlide | undefined;
	ops: ElementOperations;
	manipulation: ElementManipulationHandlers;
	history: EditorHistoryResult;
	/**
	 * F5 "From Beginning": the exact callback the Slide Show ribbon's "From
	 * Beginning" button invokes (`presentation.enterPresentModeFromBeginning`),
	 * so custom shows and the first-slide-of-the-show seeding behave identically
	 * whether started from the button or the key.
	 */
	onEnterPresentModeFromBeginning: () => void;
	/**
	 * Shift+F5 "From Current Slide": the exact callback the ribbon's "From
	 * Current Slide" button invokes, `onSetMode('present')` (which is
	 * `handleSetMode`, so the audience-mirror guard and annotation prompt still
	 * apply the same way they do for the button).
	 */
	onSetMode: (mode: ViewerMode) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useKeyboardShortcutWiring(input: UseKeyboardShortcutWiringInput): void {
	const {
		state,
		mode,
		canEdit,
		slides,
		activeSlide,
		ops,
		manipulation,
		history,
		onEnterPresentModeFromBeginning,
		onSetMode,
	} = input;

	useKeyboardShortcuts({
		containerRef: state.containerRef,
		mode,
		canEdit,
		inlineEditingElementId: state.inlineEditingElementId,
		tableEditorState: state.tableEditorState,
		activeTool: state.activeTool,
		hasSelection: state.effectiveSelectedIds.length > 0,
		effectiveSelectedIds: state.effectiveSelectedIds,
		onDelete: manipulation.handleDelete,
		onCopy: manipulation.handleCopy,
		onCut: manipulation.handleCut,
		onPaste: manipulation.handlePaste,
		onDuplicate: manipulation.handleDuplicate,
		onUndo: history.handleUndo,
		onRedo: history.handleRedo,
		onSelectAll: () => {
			if (!activeSlide) {
				return;
			}
			const allIds = activeSlide.elements.map((el) => el.id);
			if (allIds.length > 0) {
				ops.applySelection(allIds[0], allIds);
			}
		},
		onGroup: manipulation.handleGroupElements,
		onUngroup: manipulation.handleUngroupElement,
		onToggleShortcuts: () => state.setIsShortcutHelpOpen((prev) => !prev),
		onEscape: () => {
			// The help panel is checked first: "?" opened it without disturbing the
			// selection, so Escape has to be able to close it again without first
			// clearing whatever the user had selected.
			if (state.isShortcutHelpOpen) {
				state.setIsShortcutHelpOpen(false);
			} else if (state.inlineEditingElementId) {
				state.setInlineEditingElementId(null);
				state.setInlineEditingText('');
			} else if (state.contextMenuState) {
				state.setContextMenuState(null);
			} else if (state.tableEditorState) {
				state.setTableEditorState(null);
			} else {
				ops.clearSelection();
			}
		},
		onNudge: (dx: number, dy: number) => {
			const ids = state.effectiveSelectedIds;
			if (!ids.length) {
				return;
			}
			for (const id of ids) {
				const el = state.elementLookup.get(id);
				if (el) {
					ops.updateElementById(id, {
						x: el.x + dx,
						y: el.y + dy,
					});
				}
			}
			history.markDirty();
		},
		onPrevSlide: () => {
			if (slides.length === 0) {
				return;
			}
			state.setActiveSlideIndex((prev) => Math.max(0, prev - 1));
		},
		onNextSlide: () => {
			if (slides.length === 0) {
				return;
			}
			state.setActiveSlideIndex((prev) => Math.min(slides.length - 1, prev + 1));
		},
		onStartShowFromBeginning: onEnterPresentModeFromBeginning,
		onStartShowFromCurrent: () => onSetMode('present'),
	});
}
