/**
 * Outline-view state and keyboard, kept out of the SFC.
 *
 * The outline's rules (what a row is, what Tab does, which edit produces a new
 * slide) all live in `pptx-viewer-shared`; this composable is only the Vue
 * wiring around them: derive rows from the deck, hand an edit's result to the
 * host, and move focus to the row the edit says should have it. Anything here
 * that starts to look like a rule about the outline belongs in the shared
 * module instead, or the five bindings drift.
 *
 * The composable does NOT own the deck. It takes a getter and a `commit`
 * callback, so the host decides how a new deck reaches history: this binding's
 * contract is `pushHistory()` immediately BEFORE `slides.value` is replaced,
 * and burying that in here would hide it from the component that owns it.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import {
	applyOutlineEdit,
	buildOutline,
	mapOutlineKey,
	OUTLINE_ROW_ATTR,
} from 'pptx-viewer-shared';
import type { OutlineEdit, OutlineRow } from 'pptx-viewer-shared';
import { computed, nextTick, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import type { CanvasSize } from '../types';

export interface UseOutlineViewInput {
	slides: () => PptxSlide[];
	canvasSize: () => CanvasSize;
	canEdit: () => boolean;
	/** Replace the deck and make `activeSlideIndex` current, with history. */
	commit: (slides: PptxSlide[], activeSlideIndex: number) => void;
}

export interface UseOutlineViewResult {
	rows: ComputedRef<OutlineRow[]>;
	containerRef: Ref<HTMLElement | null>;
	run: (edit: OutlineEdit) => void;
	onRowKeyDown: (event: KeyboardEvent, rowKey: string) => void;
}

export function useOutlineView(input: UseOutlineViewInput): UseOutlineViewResult {
	const rows = computed(() => buildOutline(input.slides()));
	const containerRef = ref<HTMLElement | null>(null);

	function focusRow(key: string | null): void {
		if (!key) {
			return;
		}
		// After nextTick, because a new slide's title row does not exist in the
		// DOM until Vue has re-rendered with the new deck.
		void nextTick(() => {
			const selector = `[${OUTLINE_ROW_ATTR}="${CSS.escape(key)}"]`;
			const target = containerRef.value?.querySelector<HTMLInputElement>(selector);
			if (target && document.activeElement !== target) {
				target.focus();
				target.setSelectionRange(target.value.length, target.value.length);
			}
		});
	}

	function run(edit: OutlineEdit): void {
		if (!input.canEdit()) {
			return;
		}
		const result = applyOutlineEdit(input.slides(), edit, { canvas: input.canvasSize() });
		if (!result.changed) {
			return;
		}
		input.commit(result.slides, result.activeSlideIndex);
		focusRow(result.focusKey);
	}

	function onRowKeyDown(event: KeyboardEvent, rowKey: string): void {
		const { edit, preventDefault } = mapOutlineKey(event, rowKey);
		if (preventDefault) {
			// Tab would otherwise walk out of the outline entirely, and Enter would
			// submit a surrounding form on a host page that has one.
			event.preventDefault();
		}
		if (edit) {
			run(edit);
		}
	}

	return { rows, containerRef, run, onRowKeyDown };
}
