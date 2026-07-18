import type { PptxElement } from 'pptx-viewer-core';

import type { Store, ViewerState } from '../state';
import type { ViewerChrome } from '../ui';
import type { LayoutOption } from '../ui/ribbon/ribbon-types';
import { buildInspectorState } from './inspector-state-builder';

/**
 * Flatten every slide master's layouts into the `{ path, name }` options the
 * Home > Slides group's New Slide / Layout menus consume (React derives the
 * same list from the load pipeline's `layoutOptions`).
 */
function collectLayoutOptions(state: ViewerState): LayoutOption[] {
	const options: LayoutOption[] = [];
	const seen = new Set<string>();
	for (const master of state.slideMasters) {
		for (const layout of master.layouts ?? []) {
			if (!layout.path || seen.has(layout.path)) {
				continue;
			}
			seen.add(layout.path);
			options.push({
				path: layout.path,
				name: layout.name || layout.path.split('/').pop() || layout.path,
			});
		}
	}
	return options;
}

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
		const editingVisible = state.editable && !state.presenting;
		// The thumbnail rail's pinned Add Slide footer is an editing affordance.
		chrome.thumbnails?.setAddSlideVisible(editingVisible);
		if (!ribbon && !inspector) {
			return;
		}
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
			layouts: collectLayoutOptions(state),
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
			selectedElementId: el?.id,
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
