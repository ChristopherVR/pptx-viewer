import type { PptxSlide } from 'pptx-viewer-core';
/**
 * The slide-sorter keymap, wired into React.
 *
 * Key-to-action resolution lives in `pptx-viewer-shared`'s `mapSlideSorterKey`,
 * the one map all five bindings resolve against; this hook only snapshots the
 * guard state, dispatches, and owns the listener lifetime. It used to hold the
 * whole decision table as a hand-written `if` chain, which is why the sorter
 * keyboard existed in full here, in part in Vue, and nowhere else.
 *
 * The listener is registered ONCE, with the live parameters read through a ref,
 * exactly as the editor's own `useKeyboardShortcuts` does. Re-subscribing on
 * every parameter change (which is what a dependency array over `slides`,
 * `selectedSlideIds` and five inline callbacks amounts to: every render) looks
 * harmless and is not, because it can unsubscribe this listener DURING a key
 * dispatch:
 *
 *   1. Escape is dispatched; `window`'s keydown listeners run in registration
 *      order, so the editor's shortcut listener - registered long before the
 *      sorter mounted - runs first and calls `onEscape`, which sets state.
 *   2. The browser performs a microtask checkpoint after each listener returns,
 *      React flushes that render, and this effect's cleanup runs: the sorter's
 *      listener is removed before the dispatch reaches it, and the replacement
 *      registered by the re-run effect is invisible to an event already in
 *      flight (DOM: listeners added during dispatch do not receive that event).
 *   3. So Escape never closed the sorter, while every probe said the effect had
 *      run and the listener was attached - both true, of a listener that was
 *      swapped out mid-flight.
 *
 * Ctrl+D and friends hid the defect because they resolve to nothing in the
 * editor keymap while the sorter is up, so nothing re-rendered and the listener
 * survived to be called. A stable listener identity removes the race outright.
 */
import { clampSorterZoom, isEditorTextInputTarget, mapSlideSorterKey } from 'pptx-viewer-shared';
import { useEffect, useRef } from 'react';
import type React from 'react';

import { ZOOM_STEP } from './types';
import type { SorterContextMenuState } from './types';

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

interface UseKeyboardShortcutsParams {
	slides: PptxSlide[];
	activeSlideIndex: number;
	canEdit: boolean;
	selectedSlideIds: string[];
	selectedIndexes: number[];
	contextMenu: SorterContextMenuState | null;
	setContextMenu: React.Dispatch<React.SetStateAction<SorterContextMenuState | null>>;
	setSelectedSlideIds: React.Dispatch<React.SetStateAction<string[]>>;
	setZoom: React.Dispatch<React.SetStateAction<number>>;
	onClose: () => void;
	handleDeleteSelected: () => void;
	handleCopySelected: () => void;
	handlePaste: () => void;
	handleDuplicateSelected: () => void;
	handleSelectAll: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useKeyboardShortcuts(params: UseKeyboardShortcutsParams): void {
	// Every key press reads the CURRENT params through this ref, so the listener
	// below never has to be re-registered (see the note at the top of the file).
	const paramsRef = useRef(params);
	paramsRef.current = params;

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const current = paramsRef.current;
			if (current.contextMenu) {
				current.setContextMenu(null);
			}
			const { action } = mapSlideSorterKey(e, {
				canEdit: current.canEdit,
				hasMultiSelection: current.selectedSlideIds.length > 1,
				isTextInputTarget: isEditorTextInputTarget(e.target),
			});
			if (action === null) {
				return;
			}

			switch (action) {
				case 'collapseSelection': {
					// Escape unwinds one layer: shrink the multi-selection back to the
					// active slide, and only a second Escape leaves the sorter.
					e.stopPropagation();
					const activeSlide = current.slides[current.activeSlideIndex];
					current.setSelectedSlideIds(activeSlide?.id ? [activeSlide.id] : []);
					return;
				}
				case 'close':
					// Not preventDefault()ed: Escape closing an overlay is the browser's
					// own idea of the key too, and stopping propagation is what keeps
					// the editor behind the sorter from ALSO clearing its selection.
					e.stopPropagation();
					current.onClose();
					return;
				case 'delete':
					e.preventDefault();
					if (current.selectedIndexes.length > 0) {
						current.handleDeleteSelected();
					}
					return;
				case 'copy':
					e.preventDefault();
					current.handleCopySelected();
					return;
				case 'paste':
					e.preventDefault();
					current.handlePaste();
					return;
				case 'duplicate':
					e.preventDefault();
					current.handleDuplicateSelected();
					return;
				case 'selectAll':
					e.preventDefault();
					current.handleSelectAll();
					return;
				case 'zoomIn':
					e.preventDefault();
					current.setZoom((z) => clampSorterZoom(z + ZOOM_STEP));
					return;
				case 'zoomOut':
					e.preventDefault();
					current.setZoom((z) => clampSorterZoom(z - ZOOM_STEP));
					break;
				default:
					break;
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, []);
}
