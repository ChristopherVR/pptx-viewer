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

/** The bit of a focus target this module actually calls. */
interface FocusableNode {
	focus(options?: { preventScroll?: boolean }): void;
}

/** Narrow an unknown node to something focusable without asserting `any`. */
function asFocusable(node: unknown): FocusableNode | null {
	const candidate = node as { focus?: unknown } | null;
	return candidate && typeof candidate.focus === 'function' ? (candidate as FocusableNode) : null;
}

/**
 * Hand the keyboard back to the viewer when an inline editor is about to go
 * away (a selection-pane rename input, say, committed with Enter or dropped
 * with Escape).
 *
 * {@link armEditorKeyboard} deliberately does nothing while focus is already
 * inside the viewer, which is exactly the case here: the input still holds
 * focus at commit time and is removed a tick later, dumping focus on
 * `document.body`. Every binding that listens for `keydown` on its own root
 * then goes deaf, so the Ctrl+Z that undoes the edit the user just made is
 * silently ignored. Call this from the commit/cancel handler, while the
 * departing node is still in the document.
 *
 * The target is the nearest ancestor carrying a `tabindex`, which is the viewer
 * root in all five bindings. Returns false when there is no such ancestor (the
 * node is detached, or the host renders a read-only viewer with no tabindex).
 */
export function restoreEditorKeyboardFocus(from: Element | null | undefined): boolean {
	const host = asFocusable(from?.closest('[tabindex]'));
	if (!host) {
		return false;
	}
	host.focus({ preventScroll: true });
	return true;
}
