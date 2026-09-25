/**
 * The few DOM reads every binding's Edit Points / freeform-drawing overlay
 * needs, written once so no binding re-derives them: which target a pointer
 * event hit, where it is in slide pixels, and a capture-phase keyboard hook
 * that keeps Escape / Delete away from the editor's own shortcuts while a
 * session is live (otherwise Delete would remove the whole shape).
 *
 * Framework-free: plain DOM `Element` / `Event` APIs only.
 *
 * @module render/edit-points/edit-points-dom
 */
import { EDIT_POINTS_TARGET_ATTR } from './edit-points-menu';

/** The Edit Points target id on (or above) the element an event hit. */
export function readEditPointsTarget(eventTarget: EventTarget | null): string | null {
	const node = eventTarget as { closest?: (selector: string) => Element | null } | null;
	if (!node || typeof node.closest !== 'function') {
		return null;
	}
	return (
		node.closest(`[${EDIT_POINTS_TARGET_ATTR}]`)?.getAttribute(EDIT_POINTS_TARGET_ATTR) ?? null
	);
}

/**
 * A viewport (client) position as slide pixels, given the overlay element
 * that spans exactly the slide (its on-screen rect already includes zoom).
 */
export function clientToSlidePoint(
	overlay: Element,
	clientX: number,
	clientY: number,
	slideWidth: number,
	slideHeight: number,
): { x: number; y: number } {
	const rect = overlay.getBoundingClientRect();
	const sx = rect.width > 0 ? slideWidth / rect.width : 1;
	const sy = rect.height > 0 ? slideHeight / rect.height : 1;
	return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
}

/** The pointer fields a session reads, from a DOM mouse / pointer event. */
export interface OverlayPointerEventLike {
	clientX: number;
	clientY: number;
	button: number;
	ctrlKey: boolean;
	metaKey: boolean;
	target: EventTarget | null;
}

/** Build the session input for `event` over `overlay`. */
export function overlayPointerInput(
	event: OverlayPointerEventLike,
	overlay: Element,
	slideWidth: number,
	slideHeight: number,
): {
	x: number;
	y: number;
	clientX: number;
	clientY: number;
	button: number;
	ctrlKey: boolean;
	metaKey: boolean;
	target: string | null;
} {
	const p = clientToSlidePoint(overlay, event.clientX, event.clientY, slideWidth, slideHeight);
	return {
		x: p.x,
		y: p.y,
		clientX: event.clientX,
		clientY: event.clientY,
		button: event.button,
		ctrlKey: event.ctrlKey,
		metaKey: event.metaKey,
		target: readEditPointsTarget(event.target),
	};
}

/** Anything with a `keyDown(key)` that says whether it consumed the key. */
export interface OverlayKeyHandler {
	keyDown(key: string): boolean;
}

/**
 * Route key presses to `handler` in the CAPTURE phase on `target` (the window
 * by default), stopping every key it consumes before the editor's shortcut
 * handler sees it. Keys typed into a text field are left alone. Returns the
 * detach function.
 */
export function attachOverlayKeyboard(
	handler: OverlayKeyHandler,
	target: Pick<Window, 'addEventListener' | 'removeEventListener'> = window,
): () => void {
	const listener = (event: Event): void => {
		const key = (event as KeyboardEvent).key;
		const el = event.target as { tagName?: string; isContentEditable?: boolean } | null;
		const tag = el?.tagName?.toLowerCase();
		if (tag === 'input' || tag === 'textarea' || el?.isContentEditable) {
			return;
		}
		if (typeof key === 'string' && handler.keyDown(key)) {
			event.preventDefault();
			event.stopImmediatePropagation();
		}
	};
	target.addEventListener('keydown', listener, true);
	return () => target.removeEventListener('keydown', listener, true);
}
