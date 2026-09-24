/**
 * useKeyboardShortcutWiring: Wires the composed editor results into the
 * generic `useKeyboardShortcuts` hook.  Keeps the orchestrator lean.
 */
import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxSlide } from 'pptx-viewer-core';
import {
	cycleSelectableElement,
	stepFontSizePt,
	textFontSizePtToPx,
	textFontSizePxToPt,
} from 'pptx-viewer-shared';

import type { ViewerMode } from '../types-core';
import type { EditorHistoryResult } from './useEditorHistory';
import type { ElementManipulationHandlers } from './useElementManipulation';
import type { ElementOperations } from './useElementOperations';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import type { ViewerState } from './useViewerState';

/** PowerPoint's Ctrl+Space clear-character-formatting patch (Home > Font). */
const CLEAR_FORMATTING_PATCH = {
	bold: false,
	italic: false,
	underline: false,
	strikethrough: false,
	highlightColor: undefined,
} as const;

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
	/** Ctrl/Cmd+M: the same entry point the ribbon's "New Slide" button uses. */
	handleAddSlide: () => void;
	/** Ctrl/Cmd+K: open the hyperlink dialog for the current selection. */
	onOpenHyperlinkDialog: () => void;
	/** Ctrl/Cmd+Shift+C: capture the current selection's format for the format painter. */
	copyFormatFromSelection: () => void;
	/** Ctrl/Cmd+Shift+V: apply the copied format to the given element ids. */
	pasteFormatToSelection: (targetIds: string[]) => void;
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
		handleAddSlide,
		onOpenHyperlinkDialog,
		copyFormatFromSelection,
		pasteFormatToSelection,
	} = input;

	useKeyboardShortcuts({
		containerRef: state.containerRef,
		mode,
		canEdit,
		inlineEditingElementId: state.inlineEditingElementId,
		canPaste: Boolean(state.clipboardPayload && activeSlide),
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
		onAlignLeft: () => ops.updateSelectedTextStyle({ align: 'left' }),
		onAlignCenter: () => ops.updateSelectedTextStyle({ align: 'center' }),
		onAlignRight: () => ops.updateSelectedTextStyle({ align: 'right' }),
		onAlignJustify: () => ops.updateSelectedTextStyle({ align: 'justify' }),
		onIncreaseFontSize: () => stepSelectedFontSize(state, ops, 'increase'),
		onDecreaseFontSize: () => stepSelectedFontSize(state, ops, 'decrease'),
		onCopyFormat: copyFormatFromSelection,
		onPasteFormat: () => pasteFormatToSelection(state.effectiveSelectedIds),
		onNewSlide: handleAddSlide,
		onHyperlink: onOpenHyperlinkDialog,
		onClearFormatting: () => ops.updateSelectedTextStyle({ ...CLEAR_FORMATTING_PATCH }),
		onCycleSelectionNext: () => cycleSelection(state, activeSlide, ops, 'next'),
		onCycleSelectionPrev: () => cycleSelection(state, activeSlide, ops, 'prev'),
	});
}

/** PowerPoint's font-size ladder, applied in points then converted back to the model's pixels. */
function stepSelectedFontSize(
	state: ViewerState,
	ops: ElementOperations,
	direction: 'increase' | 'decrease',
): void {
	const selected = state.selectedElement;
	const currentPx =
		(selected && hasTextProperties(selected) ? selected.textStyle?.fontSize : undefined) ??
		textFontSizePtToPx(18);
	const nextPt = stepFontSizePt(textFontSizePxToPt(currentPx), direction);
	ops.updateSelectedTextStyle({ fontSize: textFontSizePtToPx(nextPt) });
}

/** Tab/Shift+Tab: move the selection to the next/previous element in slide order. */
function cycleSelection(
	state: ViewerState,
	activeSlide: PptxSlide | undefined,
	ops: ElementOperations,
	direction: 'next' | 'prev',
): void {
	if (!activeSlide) {
		return;
	}
	const ids = activeSlide.elements.map((el) => el.id);
	const nextId = cycleSelectableElement(ids, state.selectedElementId, direction);
	if (nextId) {
		ops.applySelection(nextId, [nextId]);
	}
}
