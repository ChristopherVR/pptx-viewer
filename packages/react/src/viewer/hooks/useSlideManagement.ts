/**
 * useSlideManagement — Slide CRUD operations: add, move, delete,
 * duplicate, toggle-hide, insert-from-layout, and context menu.
 */
import type { PptxHandler, PptxSlide } from 'pptx-viewer-core';
import type React from 'react';

import type { EditorHistoryResult } from './useEditorHistory';
import type { ElementOperations } from './useElementOperations';

export interface UseSlideManagementInput {
	slides: PptxSlide[];
	activeSlide: PptxSlide | undefined;
	activeSlideIndex: number;
	setActiveSlideIndex: React.Dispatch<React.SetStateAction<number>>;
	ops: ElementOperations;
	history: EditorHistoryResult;
	/** Ref to the loaded PPTX handler; `current` is null before initial load. */
	handlerRef?: React.RefObject<PptxHandler | null> | React.MutableRefObject<PptxHandler | null>;
}

export interface SlideManagementHandlers {
	handleAddSlide: () => void;
	handleMoveSlide: (fromIndex: number, toIndex: number) => void;
	handleSlideContextMenu: (e: React.MouseEvent, index: number) => void;
	handleDeleteSlides: (indexes: number[]) => void;
	handleDuplicateSlides: (indexes: number[]) => void;
	handleToggleHideSlides: (indexes: number[]) => void;
	handleInsertSlideFromLayout: (layoutPath: string, layoutName?: string) => void;
}

/**
 * Insert `draft` directly after `activeIndex` in `slides`. Negative
 * indices clamp to 0 and out-of-range indices clamp to the end. Does
 * not mutate the input array.
 */
export function insertSlideFromLayoutUpdater(
	slides: PptxSlide[],
	activeIndex: number,
	draft: PptxSlide,
): PptxSlide[] {
	const next = [...slides];
	const insertAt = Math.max(0, Math.min(activeIndex + 1, next.length));
	next.splice(insertAt, 0, draft);
	return next;
}

export function useSlideManagement(input: UseSlideManagementInput): SlideManagementHandlers {
	const { slides, activeSlideIndex, setActiveSlideIndex, ops, history, handlerRef } = input;

	const handleAddSlide = () => {
		const newSlide: PptxSlide = {
			id: `slide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
			rId: '',
			slideNumber: slides.length + 1,
			elements: [],
		};
		ops.updateSlides((prev) => {
			const next = [...prev];
			next.splice(activeSlideIndex + 1, 0, newSlide);
			return next;
		});
		setActiveSlideIndex(activeSlideIndex + 1);
		history.markDirty();
	};

	const handleMoveSlide = (fromIndex: number, toIndex: number) => {
		if (fromIndex === toIndex) {
			return;
		}
		ops.updateSlides((prev) => {
			const next = [...prev];
			const [moved] = next.splice(fromIndex, 1);
			next.splice(toIndex, 0, moved);
			return next;
		});
		setActiveSlideIndex(toIndex);
		history.markDirty();
	};

	const handleSlideContextMenu = (_e: React.MouseEvent, _index: number) => {
		// Slide context menu — handled inside SlideSorterOverlay's own context menu.
	};

	const handleDeleteSlides = (indexes: number[]) => {
		if (indexes.length === 0 || slides.length <= 1) {
			return;
		}
		const sorted = [...indexes].sort((a, b) => b - a);
		ops.updateSlides((prev) => {
			const next = [...prev];
			for (const i of sorted) {
				if (next.length > 1) {
					next.splice(i, 1);
				}
			}
			return next;
		});
		const minIdx = Math.min(...indexes);
		setActiveSlideIndex(
			Math.min(
				minIdx,
				slides.length - indexes.length - 1,
				Math.max(slides.length - indexes.length - 1, 0),
			),
		);
		history.markDirty();
	};

	const handleDuplicateSlides = (indexes: number[]) => {
		if (indexes.length === 0) {
			return;
		}
		const sorted = [...indexes].sort((a, b) => a - b);
		ops.updateSlides((prev) => {
			const next = [...prev];
			let offset = 0;
			for (const i of sorted) {
				const src = next[i + offset];
				if (!src) {
					continue;
				}
				const clone: PptxSlide = {
					...src,
					id: `slide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
					elements: src.elements.map((el) => ({
						...el,
						id: `${el.id}-dup-${Math.random().toString(36).slice(2, 6)}`,
					})),
				};
				next.splice(i + offset + 1, 0, clone);
				offset++;
			}
			return next;
		});
		history.markDirty();
	};

	const handleToggleHideSlides = (indexes: number[]) => {
		if (indexes.length === 0) {
			return;
		}
		ops.updateSlides((prev) => {
			const next = [...prev];
			for (const i of indexes) {
				const slide = next[i];
				if (slide) {
					next[i] = { ...slide, hidden: !slide.hidden };
				}
			}
			return next;
		});
		history.markDirty();
	};

	const handleInsertSlideFromLayout = (layoutPath: string, layoutName?: string) => {
		const insertAt = activeSlideIndex + 1;
		const draft: PptxSlide = {
			id: `slide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
			rId: '',
			slideNumber: slides.length + 1,
			elements: [],
			layoutPath,
			...(layoutName ? { layoutName } : {}),
		};

		let inserted: PptxSlide[] = [];
		ops.updateSlides((prev) => {
			inserted = insertSlideFromLayoutUpdater(prev, activeSlideIndex, draft);
			return inserted;
		});
		setActiveSlideIndex(insertAt);
		history.markDirty();

		// Ask the handler to populate layoutName/background by walking the
		// chosen layout XML. If the handler isn't loaded yet we keep the
		// draft as-is — the slide already carries the layoutPath so the
		// renderer can still pick up placeholders.
		const handler = handlerRef?.current;
		if (handler) {
			void handler.applyLayoutToSlide(insertAt, layoutPath, inserted).then(
				(updated) => {
					ops.updateSlides((prev) => {
						if (prev[insertAt]?.id !== draft.id) {
							return prev;
						}
						const next = [...prev];
						next[insertAt] = updated;
						return next;
					});
					return undefined;
				},
				() => {
					// Layout couldn't be resolved; the draft still has layoutPath.
					return undefined;
				},
			);
		}
	};

	return {
		handleAddSlide,
		handleMoveSlide,
		handleSlideContextMenu,
		handleDeleteSlides,
		handleDuplicateSlides,
		handleToggleHideSlides,
		handleInsertSlideFromLayout,
	};
}
