import type { PptxElement } from 'pptx-viewer-core';

import type { Store, ViewerState } from '../state';
import type { ViewerChrome } from '../ui';
import { buildInspectorState } from './inspector-state-builder';

/**
 * Keep the editing chrome (ribbon + property inspector) in sync with the
 * selected element. Extracted from `editor-controller` to keep that file
 * within the size budget; pure aside from the imperative chrome `update`
 * calls.
 */
export interface EditingChromeSyncDeps {
	store: Store<ViewerState>;
	getChrome(): ViewerChrome;
	selectedElement(state: ViewerState): PptxElement | undefined;
}

/** Build the `sync()` function that refreshes the ribbon + inspector. */
export function createEditingChromeSync(deps: EditingChromeSyncDeps): () => void {
	return () => {
		const state = deps.store.get();
		const chrome = deps.getChrome();
		const { ribbon, inspector } = chrome;
		if (!ribbon && !inspector) {
			return;
		}
		const editingVisible = state.editable && !state.presenting;
		ribbon?.setEditable(editingVisible);
		// The panel toggle in the quick-access row hides the inspector without
		// leaving edit mode (React's `isInspectorPaneOpen`).
		inspector?.setEditable(editingVisible && state.inspectorOpen);
		ribbon?.setInspectorOpen(state.inspectorOpen);

		const el = editingVisible ? deps.selectedElement(state) : undefined;

		ribbon?.updateSelection(el, {
			hasClipboard: state.clipboardPayload !== null,
			slideCount: state.slides.length,
			selectedCount: state.selectedElementIds.length,
			formatPainterActive: state.formatPainterSourceId !== null,
			selectedElementId: state.selectedElementId ?? undefined,
			animations: state.slides[state.currentSlide]?.animations ?? [],
		});
		ribbon?.setDrawState({ tool: state.drawTool, color: state.drawColor, width: state.drawWidth });

		inspector?.update(
			buildInspectorState(
				el,
				state.selectedTableCell,
				state.selectedTableCells,
				state.selectedTextRange,
				state.mediaDataUrls,
			),
		);
		const activeSlide = state.slides[state.currentSlide];
		inspector?.updateDeck({
			slideCount: state.slides.length,
			currentSlide: state.currentSlide,
			canvasSize: state.canvasSize,
			elements: activeSlide?.elements ?? [],
			selectedIds: state.selectedElementIds,
			comments: activeSlide?.comments ?? [],
			docTitle: state.coreProperties?.title,
			docAuthor: state.coreProperties?.creator,
			editable: editingVisible,
			presentationProperties: state.presentationProperties,
			themeOptions: state.themeOptions,
			activeSlide,
			colorScheme: state.colorScheme,
			notesCanvasSize: state.notesCanvasSize,
			notesPlaceholderCount: state.notesMaster
				? (state.notesMaster.placeholders?.length ?? 0)
				: undefined,
			handoutPlaceholderCount: state.handoutMaster
				? (state.handoutMaster.placeholders?.length ?? 0)
				: undefined,
		});
	};
}
