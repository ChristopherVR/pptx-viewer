import type { PptxSlide } from 'pptx-viewer-core';
import {
	applySorterAction,
	sorterMenuContext,
	createSlideSorterState,
	sorterSelectionIndexes,
	selectSorterSlide,
	sorterGridColumns,
	slideSorterPasteIndexes,
} from 'pptx-viewer-shared';
import { useCallback, useMemo, useRef, useState } from 'react';
import type React from 'react';

import type { SlideSectionGroup } from '../../types';
import type { SorterContextMenuState } from './types';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

interface UseSlideSorterStateParams {
	slides: PptxSlide[];
	activeSlideIndex: number;
	canEdit: boolean;
	sectionGroups: SlideSectionGroup[];
	onSelectSlide: (index: number) => void;
	onMoveSlide: (fromIndex: number, toIndex: number) => void;
	onDeleteSlides: (indexes: number[]) => void;
	onDuplicateSlides: (indexes: number[]) => void;
	onToggleHideSlides: (indexes: number[]) => void;
	onClose: () => void;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useSlideSorterState(params: UseSlideSorterStateParams) {
	const {
		slides,
		activeSlideIndex,
		canEdit,
		sectionGroups,
		onSelectSlide,
		onMoveSlide,
		onDeleteSlides,
		onDuplicateSlides,
		onToggleHideSlides,
		onClose,
	} = params;

	// -- State --------------------------------------------------------------

	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
	const [sorter, setSorter] = useState(() => createSlideSorterState(slides, activeSlideIndex));
	const { selectedIds: selectedSlideIds, zoom, clipboardIds: clipboardSlideIds } = sorter;
	const setSelectedSlideIds = useCallback<React.Dispatch<React.SetStateAction<string[]>>>(
		(value) => {
			setSorter((previous) => ({
				...previous,
				selectedIds: typeof value === 'function' ? value(previous.selectedIds) : value,
			}));
		},
		[],
	);
	const setZoom = useCallback<React.Dispatch<React.SetStateAction<number>>>((value) => {
		setSorter((previous) => ({
			...previous,
			zoom: typeof value === 'function' ? value(previous.zoom) : value,
		}));
	}, []);
	const [contextMenu, setContextMenu] = useState<SorterContextMenuState | null>(null);
	const backdropRef = useRef<HTMLDivElement>(null);

	// -- Helpers -------------------------------------------------------------

	const selectedIndexes = useMemo(() => sorterSelectionIndexes(sorter, slides), [sorter, slides]);

	const isSelected = useCallback(
		(slideId: string) => selectedSlideIds.includes(slideId),
		[selectedSlideIds],
	);

	// -- Selection -----------------------------------------------------------

	const handleSlideClick = useCallback(
		(e: React.MouseEvent, index: number) => {
			setSorter((previous) => selectSorterSlide(previous, slides, index, e));
		},
		[slides],
	);

	// -- Context menu --------------------------------------------------------

	const handleContextMenu = useCallback(
		(e: React.MouseEvent, index: number) => {
			e.preventDefault();
			e.stopPropagation();
			const slide = slides[index];
			if (!slide) {
				return;
			}

			setSorter((previous) => selectSorterSlide(previous, slides, index, {}, true));
			setContextMenu({ x: e.clientX, y: e.clientY, slideIndex: index });
		},
		[slides],
	);

	const closeContextMenu = useCallback(() => {
		setContextMenu(null);
	}, []);

	// -- Slide operations ----------------------------------------------------

	const handleDeleteSelected = useCallback(() => {
		const result = applySorterAction(sorter, slides, 'delete', activeSlideIndex);
		if (result.indexes.length === 0) {
			return;
		}
		onDeleteSlides(result.indexes.reverse());
		setSorter(result.state);
		closeContextMenu();
	}, [sorter, slides, activeSlideIndex, onDeleteSlides, closeContextMenu]);

	const handleDuplicateSelected = useCallback(() => {
		if (selectedIndexes.length === 0) {
			return;
		}
		onDuplicateSlides(selectedIndexes);
		closeContextMenu();
	}, [selectedIndexes, onDuplicateSlides, closeContextMenu]);

	const handleCopySelected = useCallback(() => {
		setSorter((previous) => ({
			...previous,
			clipboardIds: sorterSelectionIndexes(previous, slides).map((i) => slides[i].id),
		}));
		closeContextMenu();
	}, [slides, closeContextMenu]);

	const handlePaste = useCallback(() => {
		if (clipboardSlideIds.length === 0) {
			return;
		}
		const indexes = slideSorterPasteIndexes(clipboardSlideIds, slides);
		if (indexes.length > 0) {
			onDuplicateSlides(indexes);
		}
		closeContextMenu();
	}, [clipboardSlideIds, slides, onDuplicateSlides, closeContextMenu]);

	const handleToggleHideSelected = useCallback(() => {
		if (selectedIndexes.length === 0) {
			return;
		}
		onToggleHideSlides(selectedIndexes);
		closeContextMenu();
	}, [selectedIndexes, onToggleHideSlides, closeContextMenu]);

	const handleSelectAll = useCallback(() => {
		setSelectedSlideIds(slides.map((s) => s.id));
	}, [slides, setSelectedSlideIds]);

	const handleCollapseSelection = useCallback(() => {
		setSorter(
			(previous) =>
				applySorterAction(previous, slides, 'collapseSelection', activeSlideIndex).state,
		);
	}, [slides, activeSlideIndex]);

	// -- Keyboard shortcuts --------------------------------------------------

	useKeyboardShortcuts({
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
		handleCollapseSelection,
	});

	// -- Backdrop click ------------------------------------------------------

	const handleBackdropClick = useCallback(
		(e: React.MouseEvent) => {
			if (e.target === backdropRef.current) {
				onClose();
			}
		},
		[onClose],
	);

	// -- Drag handlers -------------------------------------------------------

	const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
		e.dataTransfer.setData('text/plain', String(index));
		e.dataTransfer.effectAllowed = 'move';
	}, []);

	const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
		setDragOverIndex(index);
	}, []);

	const handleDragLeave = useCallback(() => setDragOverIndex(null), []);

	const handleDrop = useCallback(
		(e: React.DragEvent, toIndex: number) => {
			e.preventDefault();
			setDragOverIndex(null);
			const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
			if (!isNaN(fromIndex) && fromIndex !== toIndex) {
				onMoveSlide(fromIndex, toIndex);
			}
		},
		[onMoveSlide],
	);

	// -- Double-click --------------------------------------------------------

	const handleDoubleClick = useCallback((index: number) => onSelectSlide(index), [onSelectSlide]);

	// -- Zoom ----------------------------------------------------------------

	const zoomScale = zoom / 100;

	const gridCols = sorterGridColumns(zoom);

	// -- Derived state -------------------------------------------------------

	const showSectionHeaders = sectionGroups.length > 1;

	const { hasHiddenInSelection, hasVisibleInSelection, hasClipboard } = sorterMenuContext(
		sorter,
		slides,
	);

	return {
		dragOverIndex,
		selectedSlideIds,
		contextMenu,
		zoom,
		setZoom,
		clipboardSlideIds,
		hasClipboard,
		backdropRef,
		selectedIndexes,
		isSelected,
		handleSlideClick,
		handleContextMenu,
		closeContextMenu,
		handleDeleteSelected,
		handleDuplicateSelected,
		handleCopySelected,
		handlePaste,
		handleToggleHideSelected,
		handleBackdropClick,
		handleDragStart,
		handleDragOver,
		handleDragLeave,
		handleDrop,
		handleDoubleClick,
		zoomScale,
		gridCols,
		showSectionHeaders,
		hasHiddenInSelection,
		hasVisibleInSelection,
	};
}
