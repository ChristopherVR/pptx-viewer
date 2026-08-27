/* oxlint-disable eslint/one-var -- each hook call below is its own independent
   piece of state/memoization; merging them into one `const` statement would
   hurt readability (and has previously broken the React compiler's ability to
   track separate hook boundaries), not help it. */
import type { AnimationTimelineRow } from 'pptx-viewer-shared';
import { applyAnimationTimelineOrder, reorderAnimationTimelineRows } from 'pptx-viewer-shared';
import React, { useCallback, useRef, useState } from 'react';

import type { AnimationUpdater } from './animation-handler-types';

// ---------------------------------------------------------------------------
// Sub-hook arguments
// ---------------------------------------------------------------------------

interface UseAnimationDragDropArgs {
	canEdit: boolean;
	/**
	 * The FULL merged timeline (editor rows + the deck's own read-only
	 * anchors), in `order` order. Row indices below are indices into this
	 * array, so a drop target may be a native row: that is how an
	 * editor-authored effect ends up ahead of or behind one of the deck's own.
	 */
	rows: AnimationTimelineRow[];
	updateAnimations: AnimationUpdater;
}

// ---------------------------------------------------------------------------
// Sub-hook return type
// ---------------------------------------------------------------------------

export interface AnimationDragDropHandlers {
	dragIndex: number | null;
	dragOverIndex: number | null;
	handleDragStart: (index: number, event: React.DragEvent) => void;
	handleDragOver: (index: number, event: React.DragEvent) => void;
	handleDragEnter: (index: number) => void;
	handleDragLeave: () => void;
	handleDrop: (targetIndex: number, event: React.DragEvent) => void;
	handleDragEnd: () => void;
	handleMoveUp: (rowIndex: number) => void;
	handleMoveDown: (rowIndex: number) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAnimationDragDrop({
	canEdit,
	rows,
	updateAnimations,
}: UseAnimationDragDropArgs): AnimationDragDropHandlers {
	const [dragIndex, setDragIndex] = useState<number | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
	const dragCounterRef = useRef(0);

	const handleDragStart = useCallback(
		(index: number, event: React.DragEvent) => {
			// Only an editor-authored row may be a drag SOURCE: the deck's own
			// effect groups are read-only and never move on their own, though
			// they remain valid drop targets (see handleDrop).
			if (!canEdit || rows[index]?.kind !== 'editor') {
				return;
			}
			setDragIndex(index);
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', String(index));
		},
		[canEdit, rows],
	);

	const handleDragOver = useCallback((_index: number, event: React.DragEvent) => {
		event.preventDefault();
		event.dataTransfer.dropEffect = 'move';
		setDragOverIndex(_index);
	}, []);

	const handleDragEnter = useCallback((index: number) => {
		dragCounterRef.current++;
		setDragOverIndex(index);
	}, []);

	const handleDragLeave = useCallback(() => {
		dragCounterRef.current--;
		if (dragCounterRef.current <= 0) {
			setDragOverIndex(null);
			dragCounterRef.current = 0;
		}
	}, []);

	/**
	 * Move the row at `sourceIndex` (always an editor row) to `targetIndex`
	 * within the FULL merged sequence (`rows`), which may be a native row's
	 * slot, then write the resulting `order` values back onto the editor
	 * animation list. Native rows are never mutated: only where OTHER rows
	 * sort relative to them changes.
	 */
	const reorderRows = useCallback(
		(sourceIndex: number, targetIndex: number) => {
			const sourceRow = rows[sourceIndex];
			if (!sourceRow || sourceRow.kind !== 'editor') {
				return;
			}
			const nextRows = reorderAnimationTimelineRows(rows, sourceRow.key, targetIndex);
			updateAnimations((anims) => applyAnimationTimelineOrder(anims, nextRows));
		},
		[rows, updateAnimations],
	);

	const handleDrop = useCallback(
		(targetIndex: number, event: React.DragEvent) => {
			event.preventDefault();
			dragCounterRef.current = 0;
			const sourceIndex = dragIndex;
			setDragIndex(null);
			setDragOverIndex(null);
			if (sourceIndex === null || sourceIndex === targetIndex) {
				return;
			}
			reorderRows(sourceIndex, targetIndex);
		},
		[dragIndex, reorderRows],
	);

	const handleDragEnd = useCallback(() => {
		setDragIndex(null);
		setDragOverIndex(null);
		dragCounterRef.current = 0;
	}, []);

	const handleMoveUp = useCallback(
		(rowIndex: number) => {
			if (rowIndex <= 0) {
				return;
			}
			reorderRows(rowIndex, rowIndex - 1);
		},
		[reorderRows],
	);

	const handleMoveDown = useCallback(
		(rowIndex: number) => {
			reorderRows(rowIndex, rowIndex + 1);
		},
		[reorderRows],
	);

	return {
		dragIndex,
		dragOverIndex,
		handleDragStart,
		handleDragOver,
		handleDragEnter,
		handleDragLeave,
		handleDrop,
		handleDragEnd,
		handleMoveUp,
		handleMoveDown,
	};
}
