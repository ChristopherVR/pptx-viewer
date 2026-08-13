import type { PptxSlide } from 'pptx-viewer-core';
/**
 * The slide-sorter keymap, wired into React.
 *
 * Key-to-action resolution lives in `pptx-viewer-shared`'s `mapSlideSorterKey`,
 * the one map all five bindings resolve against; this hook only snapshots the
 * guard state, dispatches, and owns the listener lifetime. It used to hold the
 * whole decision table as a hand-written `if` chain, which is why the sorter
 * keyboard existed in full here, in part in Vue, and nowhere else.
 */
import { clampSorterZoom, isEditorTextInputTarget, mapSlideSorterKey } from 'pptx-viewer-shared';
import { useEffect } from 'react';
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
	const {
		slides,
		activeSlideIndex,
		canEdit,
		selectedSlideIds,
		selectedIndexes,
		contextMenu,
		setContextMenu,
		setSelectedSlideIds,
		setZoom,
		onClose,
		handleDeleteSelected,
		handleCopySelected,
		handlePaste,
		handleDuplicateSelected,
		handleSelectAll,
	} = params;

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (contextMenu) {
				setContextMenu(null);
			}
			const { action } = mapSlideSorterKey(e, {
				canEdit,
				hasMultiSelection: selectedSlideIds.length > 1,
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
					const activeSlide = slides[activeSlideIndex];
					setSelectedSlideIds(activeSlide?.id ? [activeSlide.id] : []);
					return;
				}
				case 'close':
					// Not preventDefault()ed: Escape closing an overlay is the browser's
					// own idea of the key too, and stopping propagation is what keeps
					// the editor behind the sorter from ALSO clearing its selection.
					e.stopPropagation();
					onClose();
					return;
				case 'delete':
					e.preventDefault();
					if (selectedIndexes.length > 0) {
						handleDeleteSelected();
					}
					return;
				case 'copy':
					e.preventDefault();
					handleCopySelected();
					return;
				case 'paste':
					e.preventDefault();
					handlePaste();
					return;
				case 'duplicate':
					e.preventDefault();
					handleDuplicateSelected();
					return;
				case 'selectAll':
					e.preventDefault();
					handleSelectAll();
					return;
				case 'zoomIn':
					e.preventDefault();
					setZoom((z) => clampSorterZoom(z + ZOOM_STEP));
					return;
				case 'zoomOut':
					e.preventDefault();
					setZoom((z) => clampSorterZoom(z - ZOOM_STEP));
					break;
				default:
					break;
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [
		onClose,
		canEdit,
		selectedSlideIds,
		selectedIndexes,
		activeSlideIndex,
		slides,
		contextMenu,
		setContextMenu,
		setSelectedSlideIds,
		setZoom,
		handleDeleteSelected,
		handleCopySelected,
		handlePaste,
		handleDuplicateSelected,
		handleSelectAll,
	]);
}
