import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, PptxSlide, TextStyle } from 'pptx-viewer-core';
import {
	cycleSelectableElement,
	isFeatureEnabled,
	stepFontSizePt,
	textFontSizePtToPx,
	textFontSizePxToPt,
} from 'pptx-viewer-shared';
import type { ResolvedCustomization } from 'pptx-viewer-shared';
import { ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import { dispatchSlideShowStartKey } from './slide-show-start-key';
import type { TemplateElementMap } from './template-editing';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import type { UseKeyboardShortcutsResult } from './useKeyboardShortcuts';
import { useNudgeSelection } from './useNudgeSelection';

export interface UseEditorKeyboardInput {
	canEdit: () => boolean;
	canPaste?: () => boolean;
	hasSelection: ComputedRef<boolean>;
	/** A slide show (or rehearsal) is actually running, not merely previewing. */
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
	/** Open the Paste Special dialog (Ctrl/Cmd+Alt+V). */
	onPasteSpecial: () => void;
	duplicateSelected: () => void;
	deleteSelected: () => void;
	goPrev: () => void;
	goNext: () => void;
	onEscape: () => void;
	/** Group the multi-selection into one group element (Ctrl/Cmd+G). */
	onGroup?: () => void;
	/** Ungroup the selected group (Ctrl/Cmd+Shift+G). */
	onUngroup?: () => void;
	/** F5: start the show from its first slide (same as the ribbon's "From Beginning"). */
	presentFromBeginning: () => void;
	/** Shift+F5: start the show from the active slide (same as "From Current Slide"). */
	startPresenting: () => void;
	/** Id of the element under active inline edit, or `null`. Lets live-format chords survive the typing gate. */
	inlineEditingElementId: Ref<string | null>;
	/** Whether a table cell is actively being edited. Same purpose as `inlineEditingElementId`. */
	tableEditorIsEditing: () => boolean;
	/** The armed drawing tool; shortcuts stand down unless it is `'select'`. */
	activeTool: () => string;
	/** The current selection's elements, for reading the effective font size. */
	selectedElements: ComputedRef<PptxElement[]>;
	/** Select one element non-additively (Tab / Shift+Tab cycling). */
	selectElement: (id: string, additive: boolean) => void;
	/** Apply a text-style delta to the selection (Home ▸ Text section's own path). */
	ribbonUpdateTextStyle: (updates: Partial<TextStyle>) => void;
	/** Insert a new slide after the active one (Ctrl/Cmd+M). */
	addSlide: () => void;
	/** Open the hyperlink dialog for the current selection (Ctrl/Cmd+K). */
	openHyperlinkForSelection: () => void;
	/** Arm the format painter from the current selection (Ctrl/Cmd+Shift+C). */
	toggleFormatPainter: () => void;
	/** Apply the copied format to one element (used by `pasteFormat`). */
	applyFormatToTarget: (id: string) => void;
	/** Disarm the format painter without applying (used after `pasteFormat`). */
	cancelFormatPainter: () => void;
	/** The host's resolved UI customisation (keyboard remaps, `presentMode`). */
	customization?: () => ResolvedCustomization;
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
		onPasteSpecial,
		duplicateSelected,
		deleteSelected,
		goPrev,
		goNext,
		onEscape,
		onGroup,
		onUngroup,
		presentFromBeginning,
		startPresenting,
		inlineEditingElementId,
		tableEditorIsEditing,
		activeTool,
		selectedElements,
		selectElement,
		ribbonUpdateTextStyle,
		addSlide,
		openHyperlinkForSelection,
		toggleFormatPainter,
		applyFormatToTarget,
		cancelFormatPainter,
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
	/** Nudge every selected element by (dx, dy) px as one history entry. */
	const nudgeSelected = useNudgeSelection({
		selectedElementIds,
		activeSlideIndex,
		slides,
		templateElementsBySlideId,
		pushHistory,
	});

	/** Step the current selection's font size one rung along PowerPoint's ladder. */
	function stepSelectedFontSize(direction: 'increase' | 'decrease'): void {
		const el = selectedElements.value[0];
		const currentPx =
			(el && hasTextProperties(el) ? el.textStyle?.fontSize : undefined) ?? textFontSizePtToPx(18);
		const steppedPt = stepFontSizePt(textFontSizePxToPt(currentPx), direction);
		ribbonUpdateTextStyle({ fontSize: textFontSizePtToPx(steppedPt) });
	}

	/** Apply the copied format to every selected element, then disarm the painter. */
	function pasteFormatToSelection(): void {
		if (selectedElementIds.value.length === 0) {
			return;
		}
		for (const id of selectedElementIds.value) {
			applyFormatToTarget(id);
		}
		cancelFormatPainter();
	}

	/** Move the selection to the next/previous element on the slide (Tab / Shift+Tab). */
	function cycleSelection(direction: 'next' | 'prev'): void {
		const ids = (activeSlide.value?.elements ?? []).map((el) => el.id);
		const nextId = cycleSelectableElement(ids, selectedElementIds.value[0] ?? null, direction);
		if (nextId) {
			selectElement(nextId, false);
		}
	}

	const shortcuts = useKeyboardShortcuts({
		canPaste: input.canPaste,
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
			// Vue has one find/replace panel showing both rows at once, so Ctrl+H
			// opens the same panel Ctrl+F does; there is no distinct replace mode.
			findReplace: () => {
				findOpen.value = !findOpen.value;
			},
			alignLeft: () => ribbonUpdateTextStyle({ align: 'left' }),
			alignCenter: () => ribbonUpdateTextStyle({ align: 'center' }),
			alignRight: () => ribbonUpdateTextStyle({ align: 'right' }),
			alignJustify: () => ribbonUpdateTextStyle({ align: 'justify' }),
			increaseFontSize: () => stepSelectedFontSize('increase'),
			decreaseFontSize: () => stepSelectedFontSize('decrease'),
			copyFormat: toggleFormatPainter,
			pasteFormat: pasteFormatToSelection,
			newSlide: addSlide,
			hyperlink: openHyperlinkForSelection,
			clearFormatting: () =>
				ribbonUpdateTextStyle({
					bold: false,
					italic: false,
					underline: false,
					strikethrough: false,
					highlightColor: undefined,
				}),
			cycleSelectionNext: () => cycleSelection('next'),
			cycleSelectionPrev: () => cycleSelection('prev'),
			pasteSpecial: onPasteSpecial,
		},
		canEdit,
		hasSelection,
		isPresenting: presenting,
		inlineEditingElementId,
		tableEditorIsEditing,
		activeTool,
		keyboard: () => input.customization?.().keyboard,
	});

	/**
	 * Root keydown: everything now goes through the shortcut registry.
	 *
	 * Ctrl/Cmd+F and Ctrl/Cmd+/ used to be hand-matched here, above the registry.
	 * Both are shared-keymap actions now (`find` and `toggleShortcuts`), so
	 * Angular, Svelte and Vanilla get the same chords instead of Ctrl+F falling
	 * through to the browser's find bar and Ctrl+/ doing nothing at all.
	 *
	 * F5 / Shift+F5 are checked FIRST, ahead of the registry: unlike every other
	 * shortcut here, they must fire even with editing disabled and even while
	 * the caret sits in a text input, so they cannot sit behind the registry's
	 * `canEdit` / text-input gates. See `dispatchSlideShowStartKey`.
	 */
	function onEditorKeydown(event: KeyboardEvent): void {
		const presentModeEnabled = input.customization
			? isFeatureEnabled(input.customization(), 'presentMode')
			: true;
		if (
			presentModeEnabled &&
			dispatchSlideShowStartKey(event, presenting.value, { presentFromBeginning, startPresenting })
		) {
			return;
		}
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
