import {
	isEditorControlTarget,
	isEditorTextInputTarget,
	mapCustomizedEditorKey,
} from 'pptx-viewer-shared';
import type { ResolvedKeyboardCustomization } from 'pptx-viewer-shared';

/**
 * Editing keyboard shortcuts, attached alongside the slideshow navigation
 * handler. Key-to-action resolution is the shared `mapEditorKey`, the one keymap
 * all five bindings resolve against, so this file is only the dispatch table.
 *
 * Slide paging is deliberately NOT dispatched here: the viewer root already
 * carries `attachKeyboardNavigation`, which pages the deck when no element is
 * selected. Acting on `prevSlide` / `nextSlide` as well would advance two slides
 * per press.
 */
export interface EditorKeyboardDeps {
	/** False disables everything (not editable, presenting, inline editing). */
	isActive(): boolean;
	/** The host's keyboard customisation (disabled / remapped commands), read per key. */
	getKeyboardCustomization?(): ResolvedKeyboardCustomization | undefined;
	getSelectedId(): string | null;
	deselect(): void;
	deleteSelected(): void;
	duplicateSelected(): void;
	copySelected(): void;
	cutSelected(): void;
	/** Paste isn't selection-gated: it targets the current slide regardless of selection. */
	paste(): void;
	/** Omitted preserves custom callers that own their paste command. */
	canPaste?(): boolean;
	/** Select every interactive element on the active slide (Ctrl+A). */
	selectAll(): void;
	/** Group the multi-selection into one group element (Ctrl+G). */
	groupSelected(): void;
	/** Ungroup the selected group (Ctrl+Shift+G). */
	ungroupSelected(): void;
	nudgeSelected(dx: number, dy: number): void;
	undo(): void;
	redo(): void;
	cancelFormatPainter(): boolean;
	/** Show or hide the keyboard-shortcut cheat sheet ("?"). */
	toggleShortcuts(): void;
	/** Close the cheat sheet on Escape; true when it was open (Escape consumed). */
	closeShortcuts(): boolean;
	/**
	 * Open or close the find bar (Ctrl/Cmd+F). Optional so a host driving this
	 * handler without find chrome still compiles; when it is missing the chord
	 * falls through to the browser, which is what this binding did before the
	 * shortcut reached the shared keymap.
	 */
	toggleFind?(): void;
	/** Ctrl+L/E/R/J: paragraph alignment on the selected text shape. */
	setTextAlign?(align: 'left' | 'center' | 'right' | 'justify'): void;
	/** Ctrl+Shift+>/< and Ctrl+]/[: PowerPoint's font-size ladder. */
	stepFontSize?(direction: 'increase' | 'decrease'): void;
	/** Ctrl+Shift+C: arm the format painter from the current selection. */
	copyFormat?(): void;
	/** Ctrl+Shift+V: apply the copied format to the current selection. */
	pasteFormat?(): void;
	/** Ctrl+M: insert a new slide after the active one. */
	addSlide?(): void;
	/** Ctrl+K: open the hyperlink dialog for the current selection. */
	openHyperlink?(): void;
	/** Ctrl+H: open the docked Find & Replace panel. */
	toggleFindReplace?(): void;
	/** Ctrl+Space: clear character formatting on the current selection. */
	clearFormatting?(): void;
	/** Tab/Shift+Tab: cycle the selection through the slide's elements. */
	cycleSelection?(direction: 'next' | 'prev'): void;
	/** Ctrl/Cmd+Alt+V: open the Paste Special dialog. */
	onPasteSpecial?(): void;
}

export function createEditorKeydownHandler(
	deps: EditorKeyboardDeps,
): (event: KeyboardEvent) => void {
	return (event) => {
		if (!deps.isActive()) {
			return;
		}
		const { action, dx, dy } = mapCustomizedEditorKey(
			event,
			{
				canPaste: deps.canPaste?.(),
				hasSelection: deps.getSelectedId() !== null,
				isTextInputTarget: isEditorTextInputTarget(event.target),
				isControlTarget: isEditorControlTarget(event.target),
			},
			deps.getKeyboardCustomization?.(),
		);
		// Paging is owned by the root navigation handler; see the module note.
		if (action === null || action === 'prevSlide' || action === 'nextSlide') {
			return;
		}
		event.preventDefault();

		switch (action) {
			case 'escape':
				// Unwind the transient chrome one layer at a time: format painter,
				// then the cheat sheet, then the selection itself.
				if (deps.cancelFormatPainter() || deps.closeShortcuts()) {
					return;
				}
				deps.deselect();
				break;
			case 'toggleShortcuts':
				deps.toggleShortcuts();
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
				deps.addSlide?.();
				break;
			case 'hyperlink':
				deps.openHyperlink?.();
				break;
			case 'findReplace':
				deps.toggleFindReplace?.();
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
			case 'pasteSpecial':
				deps.onPasteSpecial?.();
				break;
			default:
				break;
		}
	};
}
