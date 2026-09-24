import { isEditorTextInputTarget, mapEditorKey } from 'pptx-viewer-shared';

import type {
	EditorTextAlign,
	FontSizeStepDirection,
	SelectionCycleDirection,
} from './editor-shortcut-types';

/**
 * Editing keyboard shortcuts, called from the viewer root's keydown before the
 * slideshow navigation handler. Key-to-action resolution is the shared
 * `mapEditorKey`, the one keymap all five bindings resolve against, so this file
 * is only the dispatch table.
 *
 * Slide paging is deliberately NOT dispatched here: the root handler falls
 * through to `viewer.handleNavigationKey` when this one does not consume the
 * event, so acting on `prevSlide` / `nextSlide` too would advance two slides per
 * press.
 */
export interface EditorKeyboardDeps {
	/** False disables everything (not editable, presenting, inline editing). */
	isActive(): boolean;
	getSelectedId(): string | null;
	deselect(): void;
	deleteSelected(): void;
	duplicateSelected(): void;
	nudgeSelected(dx: number, dy: number): void;
	undo(): void;
	redo(): void;
	copySelected(): void;
	cutSelected(): void;
	paste(): void;
	/** Omitted preserves custom callers that own their paste command. */
	canPaste?(): boolean;
	/** Select every interactive element on the active slide (Ctrl+A). */
	selectAll(): void;
	/** Group the multi-selection into one group element (Ctrl+G). */
	groupSelected(): void;
	/** Ungroup the selected group (Ctrl+Shift+G). */
	ungroupSelected(): void;
	cancelFormatPainter?(): boolean;
	/** Show or hide the keyboard-shortcut cheat sheet ("?"). */
	toggleShortcuts?(): void;
	/** Close the cheat sheet on Escape; true when it was open (Escape consumed). */
	closeShortcuts?(): boolean;
	/**
	 * Open or close the find bar (Ctrl/Cmd+F). Optional so a host driving this
	 * handler without find chrome still compiles; when it is missing the chord
	 * falls through to the browser, which is what this binding did before the
	 * shortcut reached the shared keymap.
	 */
	toggleFind?(): void;
	/** Open the find bar in replace mode (Ctrl/Cmd+H). See `EditorControllerDeps`. */
	toggleFindReplace?(): void;
	/** Set the selected (not editing) text shape's paragraph alignment. */
	setTextAlign?(align: EditorTextAlign): void;
	/** Step the selection's font size along PowerPoint's size ladder. */
	stepFontSize?(direction: FontSizeStepDirection): void;
	/** Copy the selection's format for the format painter (Ctrl+Shift+C). */
	copyFormat?(): void;
	/** Apply the copied format to the current selection (Ctrl+Shift+V). */
	pasteFormat?(): void;
	/** Insert a new slide after the active one (Ctrl+M). */
	newSlide?(): void;
	/** Open the hyperlink dialog for the current selection (Ctrl+K). */
	openHyperlink?(): void;
	/** Clear character formatting on the selection (Ctrl+Space). */
	clearFormatting?(): void;
	/** Move the selection to the next/previous element on the slide (Tab). */
	cycleSelection?(direction: SelectionCycleDirection): void;
}

export function createEditorKeydownHandler(
	deps: EditorKeyboardDeps,
): (event: KeyboardEvent) => void {
	return (event) => {
		if (!deps.isActive()) {
			return;
		}
		const { action, dx, dy } = mapEditorKey(event, {
			canPaste: deps.canPaste?.(),
			hasSelection: deps.getSelectedId() !== null,
			isTextInputTarget: isEditorTextInputTarget(event.target),
		});
		// Paging is owned by the root navigation fall-through; see the module note.
		if (action === null || action === 'prevSlide' || action === 'nextSlide') {
			return;
		}
		event.preventDefault();

		switch (action) {
			case 'escape':
				// Unwind the transient chrome one layer at a time: format painter,
				// then the cheat sheet, then the selection itself.
				if (deps.cancelFormatPainter?.() || deps.closeShortcuts?.()) {
					return;
				}
				deps.deselect();
				break;
			case 'toggleShortcuts':
				deps.toggleShortcuts?.();
				break;
			case 'find':
				deps.toggleFind?.();
				break;
			case 'undo':
				deps.undo();
				break;
			case 'redo':
				deps.redo();
				break;
			case 'paste':
				deps.paste();
				break;
			case 'selectAll':
				deps.selectAll();
				break;
			case 'delete':
				deps.deleteSelected();
				break;
			case 'duplicate':
				deps.duplicateSelected();
				break;
			case 'copy':
				deps.copySelected();
				break;
			case 'cut':
				deps.cutSelected();
				break;
			case 'group':
				deps.groupSelected();
				break;
			case 'ungroup':
				deps.ungroupSelected();
				break;
			case 'nudge':
				deps.nudgeSelected(dx ?? 0, dy ?? 0);
				break;
			case 'findReplace':
				deps.toggleFindReplace?.();
				break;
			case 'alignLeft':
				deps.setTextAlign?.('left');
				break;
			case 'alignCenter':
				deps.setTextAlign?.('center');
				break;
			case 'alignRight':
				deps.setTextAlign?.('right');
				break;
			case 'alignJustify':
				deps.setTextAlign?.('justify');
				break;
			case 'increaseFontSize':
				deps.stepFontSize?.('increase');
				break;
			case 'decreaseFontSize':
				deps.stepFontSize?.('decrease');
				break;
			case 'copyFormat':
				deps.copyFormat?.();
				break;
			case 'pasteFormat':
				deps.pasteFormat?.();
				break;
			case 'newSlide':
				deps.newSlide?.();
				break;
			case 'hyperlink':
				deps.openHyperlink?.();
				break;
			case 'clearFormatting':
				deps.clearFormatting?.();
				break;
			case 'cycleSelectionNext':
				deps.cycleSelection?.('next');
				break;
			case 'cycleSelectionPrev':
				deps.cycleSelection?.('prev');
				break;
			default:
				break;
		}
	};
}
