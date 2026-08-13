import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { filterInteractableIds, isTemplateElementId } from 'pptx-viewer-shared';
import { ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import { useConnectorReroute } from './connector-reroute-store';
import { setTemplateElements } from './template-editing';
import type { TemplateElementMap } from './template-editing';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import type { UseKeyboardShortcutsResult } from './useKeyboardShortcuts';

export interface UseEditorKeyboardInput {
	canEdit: () => boolean;
	hasSelection: ComputedRef<boolean>;
	presenting: Ref<boolean>;
	findOpen: Ref<boolean>;
	selectedElementIds: Ref<string[]>;
	activeSlide: ComputedRef<PptxSlide | undefined>;
	activeSlideIndex: Ref<number>;
	slides: Ref<PptxSlide[]>;
	templateElementsBySlideId: Ref<TemplateElementMap>;
	pushHistory: () => void;
	undo: () => void;
	redo: () => void;
	copyElement: (id: string) => void;
	cutElement: (id: string) => void;
	pasteElement: () => void;
	duplicateSelected: () => void;
	deleteSelected: () => void;
	goPrev: () => void;
	goNext: () => void;
	onEscape: () => void;
	/** Group the multi-selection into one group element (Ctrl/Cmd+G). */
	onGroup?: () => void;
	/** Ungroup the selected group (Ctrl/Cmd+Shift+G). */
	onUngroup?: () => void;
}

export interface UseEditorKeyboardResult {
	showShortcuts: Ref<boolean>;
	shortcuts: UseKeyboardShortcutsResult;
	onEditorKeydown: (event: KeyboardEvent) => void;
	/** Copy the first selected element to the in-memory clipboard (also used by the ribbon). */
	copySelected: () => void;
	/** Cut the first selected element to the in-memory clipboard (also used by the ribbon). */
	cutSelected: () => void;
	/** Select every element on the active slide (Ctrl+A, and Home > Editing > Select All). */
	selectAllElements: () => void;
}

/**
 * useEditorKeyboard: the root keydown handler plus the config-driven shortcut
 * registry it delegates to (undo/redo/copy/cut/paste/duplicate/delete/select-
 * all/nudge/slide-nav/escape). Find (Ctrl+F) and the shortcut-help overlay
 * ("?" or Ctrl+/) resolve inside the shared keymap, so nothing is intercepted
 * ahead of the registry any more. Extracted from `PowerPointViewer.vue`.
 */
export function useEditorKeyboard(input: UseEditorKeyboardInput): UseEditorKeyboardResult {
	const {
		canEdit,
		hasSelection,
		presenting,
		findOpen,
		selectedElementIds,
		activeSlide,
		activeSlideIndex,
		slides,
		templateElementsBySlideId,
		pushHistory,
		undo,
		redo,
		copyElement,
		cutElement,
		pasteElement,
		duplicateSelected,
		deleteSelected,
		goPrev,
		goNext,
		onEscape,
		onGroup,
		onUngroup,
	} = input;

	const showShortcuts = ref(false);

	/** Select every element on the active slide. */
	function selectAllElements(): void {
		selectedElementIds.value = (activeSlide.value?.elements ?? []).map((e) => e.id);
	}
	/** Copy the first selected element to the in-memory clipboard. */
	function copySelected(): void {
		const id = selectedElementIds.value[0];
		if (id) {
			copyElement(id);
		}
	}
	/** Cut the first selected element to the in-memory clipboard. */
	function cutSelected(): void {
		const id = selectedElementIds.value[0];
		if (id) {
			cutElement(id);
		}
	}
	/** Recompute the connectors glued to shapes an arrow-key nudge just moved. */
	const rerouteConnectorsFor = useConnectorReroute({
		slides,
		activeSlideIndex,
		templateElementsBySlideId,
	});

	/** Nudge every selected element by (dx, dy) px as one history entry. */
	function nudgeSelected(dx: number, dy: number): void {
		if (selectedElementIds.value.length === 0) {
			return;
		}
		const index = activeSlideIndex.value;
		const slide = slides.value[index];
		if (!slide) {
			return;
		}
		// `a:spLocks/@noMove` pins a shape, so the arrow keys must skip it exactly as
		// a drag does, and a multi-selection nudges only its movable members.
		const lookup = new Map<string, PptxElement>();
		for (const el of [...(templateElementsBySlideId.value[slide.id] ?? []), ...slide.elements]) {
			lookup.set(el.id, el);
		}
		const movableIds = filterInteractableIds(
			selectedElementIds.value,
			(id) => lookup.get(id),
			'move',
		);
		if (movableIds.length === 0) {
			return;
		}
		const ids = new Set(movableIds);
		// Partition into template ids (master-/layout- prefix) and normal slide ids so
		// the nudge routes through the correct store for each group. Without this split
		// a selected template element is silently skipped (it lives in the template
		// store, not in slide.elements) and the arrow-key move is lost.
		const templateIds = new Set([...ids].filter((id) => isTemplateElementId(id)));
		const slideIds = new Set([...ids].filter((id) => !isTemplateElementId(id)));
		pushHistory();
		if (templateIds.size > 0) {
			const current = templateElementsBySlideId.value[slide.id];
			if (current) {
				templateElementsBySlideId.value = setTemplateElements(
					templateElementsBySlideId.value,
					slide.id,
					current.map((el) =>
						templateIds.has(el.id) ? { ...el, x: el.x + dx, y: el.y + dy } : el,
					),
				);
			}
		}
		if (slideIds.size > 0) {
			const nextSlides = slides.value.slice();
			nextSlides[index] = {
				...slide,
				elements: slide.elements.map((el) =>
					slideIds.has(el.id) ? { ...el, x: el.x + dx, y: el.y + dy } : el,
				),
			};
			slides.value = nextSlides;
		}
		// The nudged shapes have landed: connectors glued to them follow, the same
		// as at the end of a pointer drag.
		rerouteConnectorsFor(ids);
	}

	const shortcuts = useKeyboardShortcuts({
		actions: {
			undo,
			redo,
			copy: copySelected,
			cut: cutSelected,
			paste: pasteElement,
			duplicate: duplicateSelected,
			delete: deleteSelected,
			selectAll: selectAllElements,
			group: onGroup,
			ungroup: onUngroup,
			nudge: nudgeSelected,
			prevSlide: goPrev,
			nextSlide: goNext,
			toggleShortcuts: () => {
				showShortcuts.value = !showShortcuts.value;
			},
			escape: () => {
				// The help panel goes first: "?" opened it without touching the
				// selection, so Escape must be able to close it again without also
				// clearing what the user had selected.
				if (showShortcuts.value) {
					showShortcuts.value = false;
					return;
				}
				onEscape();
			},
			find: () => {
				findOpen.value = !findOpen.value;
			},
		},
		canEdit,
		hasSelection,
		isPresenting: presenting,
	});

	/**
	 * Root keydown: everything now goes through the shortcut registry.
	 *
	 * Ctrl/Cmd+F and Ctrl/Cmd+/ used to be hand-matched here, above the registry.
	 * Both are shared-keymap actions now (`find` and `toggleShortcuts`), so
	 * Angular, Svelte and Vanilla get the same chords instead of Ctrl+F falling
	 * through to the browser's find bar and Ctrl+/ doing nothing at all.
	 */
	function onEditorKeydown(event: KeyboardEvent): void {
		shortcuts.handleKeyDown(event);
	}

	return {
		showShortcuts,
		shortcuts,
		onEditorKeydown,
		copySelected,
		cutSelected,
		// Also reachable from Home > Editing > Select > Select All, which had no
		// producer at all until now.
		selectAllElements,
	};
}
