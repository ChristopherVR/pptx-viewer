/**
 * Keep a viewer's keymap live after a canvas gesture.
 *
 * A stage pointerdown handler has to call `preventDefault()` (it suppresses the
 * native drag, the text selection, and the synthetic mouse events a touch would
 * otherwise emit), but the same call suppresses the focus move the click would
 * have made. A binding that listens for `keydown` on its own root then never
 * sees another key: focus is parked on `document.body`, outside the listener,
 * and every shortcut is silently dead after the most ordinary interaction there
 * is, clicking a shape.
 *
 * Calling {@link armEditorKeyboard} from the gesture handler puts focus back on
 * the viewer root, which is where a keyboard user lands by tabbing anyway, so
 * the two paths agree. It is a no-op when focus is already somewhere inside the
 * viewer, so it cannot steal the caret from an inline text editor or a ribbon
 * field.
 *
 * @module render/editor-keyboard-focus
 */

/** A focus target: the viewer root, which every binding renders with a tabindex. */
export interface EditorKeyboardFocusTarget {
	contains(other: Node | null): boolean;
	focus(options?: { preventScroll?: boolean }): void;
	readonly ownerDocument: Document | null;
}

/**
 * Ensure the next keystroke is delivered inside `root`.
 *
 * Returns true when focus is (now) inside the viewer, false when there was no
 * root to focus. Focus is only moved when it had fallen outside, so repeated
 * calls from a pointermove-heavy gesture are free.
 */
export function armEditorKeyboard(root: EditorKeyboardFocusTarget | null | undefined): boolean {
	if (!root) {
		return false;
	}
	const active = root.ownerDocument?.activeElement ?? null;
	if (active && active !== root.ownerDocument?.body && root.contains(active)) {
		return true;
	}
	// `preventScroll` matters: the root is usually taller than the viewport, so a
	// plain focus() would scroll the page under the user mid-drag.
	root.focus({ preventScroll: true });
	return true;
}
