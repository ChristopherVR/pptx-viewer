/**
 * Outline-view state and keyboard, kept out of the markup.
 *
 * The outline's rules (what a row is, what Tab does, which edit produces a new
 * slide) all live in `pptx-viewer-shared`; this hook is only the React wiring
 * around them: derive rows from the deck, hand an edit's result back to the
 * viewer's own `setSlides`, and move focus to the row the edit says should have
 * it. Anything here that starts to look like a rule belongs in shared instead.
 *
 * Undo works because of the `setSlides` + `bumpHistory` pair. React's history
 * hook watches slide state and skips its deep comparison when a cheap
 * structural hash is unchanged, and a text edit changes no slide or element
 * COUNT, so without the nonce bump an outline edit would be invisible to undo.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import {
	applyOutlineEdit,
	buildOutline,
	mapOutlineKey,
	OUTLINE_ROW_ATTR,
} from 'pptx-viewer-shared';
import type { OutlineEdit, OutlineRow } from 'pptx-viewer-shared';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { CanvasSize } from '../../types';

export interface UseOutlineViewInput {
	slides: PptxSlide[];
	canvasSize: CanvasSize;
	canEdit: boolean;
	setSlides: (slides: PptxSlide[]) => void;
	setActiveSlideIndex: (index: number) => void;
	/** Forces the history hook past its cheap-hash gate. See the module note. */
	bumpHistory: () => void;
}

export interface UseOutlineViewResult {
	rows: OutlineRow[];
	containerRef: React.RefObject<HTMLDivElement | null>;
	run: (edit: OutlineEdit) => void;
	onRowKeyDown: (event: React.KeyboardEvent, rowKey: string) => void;
}

export function useOutlineView(input: UseOutlineViewInput): UseOutlineViewResult {
	const { slides, canvasSize, canEdit, setSlides, setActiveSlideIndex, bumpHistory } = input;

	const rows = useMemo(() => buildOutline(slides), [slides]);
	const containerRef = useRef<HTMLDivElement>(null);
	// Focus is restored in an effect rather than inline, because the row that
	// should receive it may not exist yet: a new slide's title row only appears
	// once React has re-rendered with the new deck.
	const pendingFocusRef = useRef<string | null>(null);

	const run = useCallback(
		(edit: OutlineEdit) => {
			if (!canEdit) {
				return;
			}
			const result = applyOutlineEdit(slides, edit, { canvas: canvasSize });
			if (!result.changed) {
				return;
			}
			setSlides(result.slides);
			setActiveSlideIndex(result.activeSlideIndex);
			bumpHistory();
			pendingFocusRef.current = result.focusKey;
		},
		[bumpHistory, canEdit, canvasSize, setActiveSlideIndex, setSlides, slides],
	);

	const onRowKeyDown = useCallback(
		(event: React.KeyboardEvent, rowKey: string) => {
			const { edit, preventDefault } = mapOutlineKey(event, rowKey);
			if (preventDefault) {
				// Tab would otherwise walk out of the outline entirely, and Enter
				// would submit the surrounding form on a host page that has one.
				event.preventDefault();
			}
			if (edit) {
				run(edit);
			}
		},
		[run],
	);

	useEffect(() => {
		const key = pendingFocusRef.current;
		if (!key) {
			return;
		}
		pendingFocusRef.current = null;
		const selector = `[${OUTLINE_ROW_ATTR}="${CSS.escape(key)}"]`;
		const target = containerRef.current?.querySelector<HTMLInputElement>(selector);
		if (target && document.activeElement !== target) {
			target.focus();
			target.setSelectionRange(target.value.length, target.value.length);
		}
	}, [rows]);

	return { rows, containerRef, run, onRowKeyDown };
}
