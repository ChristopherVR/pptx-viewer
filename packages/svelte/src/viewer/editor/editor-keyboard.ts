import { nudgeDelta } from './editor-geometry';

/**
 * Editing keyboard shortcuts, attached to the viewer root alongside (before)
 * the slideshow navigation handler. The navigation is gated off while an
 * element is selected (see `PowerPointViewer`), so arrows nudge instead of
 * changing slides.
 *
 * Keys: Escape deselect; Delete/Backspace delete; Ctrl+D duplicate;
 * Ctrl+C/X/V copy/cut/paste; Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y undo/redo; arrows
 * nudge (Shift = 10px). Mirrors the vanilla binding's `editor-keyboard`.
 *
 * Ctrl+V is intentionally checked before the "a selection is required" guard
 * below (paste targets the current slide regardless of selection, matching
 * the vanilla binding); Ctrl+C/X are gated on a selection like duplicate/delete.
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
	cancelFormatPainter?(): boolean;
}

const FORM_FIELD_TAGS = /^(?:INPUT|TEXTAREA|SELECT)$/u;

export function createEditorKeydownHandler(
	deps: EditorKeyboardDeps,
): (event: KeyboardEvent) => void {
	return (event) => {
		if (!deps.isActive()) {
			return;
		}
		const target = event.target instanceof HTMLElement ? event.target : null;
		if (target && (FORM_FIELD_TAGS.test(target.tagName) || target.isContentEditable)) {
			return;
		}
		const ctrl = event.ctrlKey || event.metaKey;
		const key = event.key;
		if (key === 'Escape' && deps.cancelFormatPainter?.()) {
			event.preventDefault();
			return;
		}

		if (ctrl && (key === 'z' || key === 'Z')) {
			event.preventDefault();
			if (event.shiftKey) {
				deps.redo();
			} else {
				deps.undo();
			}
			return;
		}
		if (ctrl && (key === 'y' || key === 'Y')) {
			event.preventDefault();
			deps.redo();
			return;
		}
		if (ctrl && (key === 'v' || key === 'V')) {
			event.preventDefault();
			deps.paste();
			return;
		}

		if (deps.getSelectedId() === null) {
			return;
		}
		if (key === 'Escape') {
			event.preventDefault();
			deps.deselect();
			return;
		}
		if (key === 'Delete' || key === 'Backspace') {
			event.preventDefault();
			deps.deleteSelected();
			return;
		}
		if (ctrl && (key === 'd' || key === 'D')) {
			event.preventDefault();
			deps.duplicateSelected();
			return;
		}
		if (ctrl && (key === 'c' || key === 'C')) {
			event.preventDefault();
			deps.copySelected();
			return;
		}
		if (ctrl && (key === 'x' || key === 'X')) {
			event.preventDefault();
			deps.cutSelected();
			return;
		}
		const delta = nudgeDelta(key, event.shiftKey);
		if (delta) {
			event.preventDefault();
			deps.nudgeSelected(delta.dx, delta.dy);
		}
	};
}
