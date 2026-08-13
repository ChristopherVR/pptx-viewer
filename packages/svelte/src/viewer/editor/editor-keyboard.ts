import { isEditorTextInputTarget, mapEditorKey } from 'pptx-viewer-shared';

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
}

export function createEditorKeydownHandler(
	deps: EditorKeyboardDeps,
): (event: KeyboardEvent) => void {
	return (event) => {
		if (!deps.isActive()) {
			return;
		}
		const { action, dx, dy } = mapEditorKey(event, {
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
			default:
				break;
		}
	};
}
