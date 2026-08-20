/* oxlint-disable eslint/one-var -- each hook call below is its own independent
   piece of state/memoization; merging them into one `const` statement would
   hurt readability (and has previously broken the React compiler's ability to
   track separate hook boundaries), not help it. */
import type { PptxElementAnimation } from 'pptx-viewer-core';
import { reorderAnimationTo } from 'pptx-viewer-shared';
import React, { useCallback, useRef, useState } from 'react';

import type { AnimationUpdater } from './animation-handler-types';

// ---------------------------------------------------------------------------
// Sub-hook arguments
// ---------------------------------------------------------------------------

interface UseAnimationDragDropArgs {
	canEdit: boolean;
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
	handleMoveUp: (animIndex: number) => void;
	handleMoveDown: (animIndex: number) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAnimationDragDrop({
	canEdit,
	updateAnimations,
}: UseAnimationDragDropArgs): AnimationDragDropHandlers {
	const [dragIndex, setDragIndex] = useState<number | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
	const dragCounterRef = useRef(0);

	const handleDragStart = useCallback(
		(index: number, event: React.DragEvent) => {
			if (!canEdit) {
				return;
			}
			setDragIndex(index);
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', String(index));
		},
		[canEdit],
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

	const reorderAnimations = useCallback(
		(sourceIndex: number, targetIndex: number) => {
			updateAnimations((anims: PptxElementAnimation[]) =>
				reorderAnimationTo(anims, sourceIndex, targetIndex),
			);
		},
		[updateAnimations],
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
			reorderAnimations(sourceIndex, targetIndex);
		},
		[dragIndex, reorderAnimations],
	);

	const handleDragEnd = useCallback(() => {
		setDragIndex(null);
		setDragOverIndex(null);
		dragCounterRef.current = 0;
	}, []);

	const handleMoveUp = useCallback(
		(animIndex: number) => {
			if (animIndex <= 0) {
				return;
			}
			reorderAnimations(animIndex, animIndex - 1);
		},
		[reorderAnimations],
	);

	const handleMoveDown = useCallback(
		(animIndex: number) => {
			reorderAnimations(animIndex, animIndex + 1);
		},
		[reorderAnimations],
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
