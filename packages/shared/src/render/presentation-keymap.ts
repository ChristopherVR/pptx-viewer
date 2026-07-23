/**
 * PowerPoint-accurate slide-show keyboard map.
 *
 * Single source of truth for what a key press does while a slide show is
 * running, shared by every binding so React / Vue / Angular / Svelte / Vanilla
 * cannot drift apart. Modelled on Microsoft's published shortcut list for
 * "Use keyboard shortcuts to deliver your presentation":
 *
 *   next      N, Enter, Page Down, Right, Down, Spacebar
 *   previous  P, Page Up, Left, Up, Backspace
 *   goto      type a slide number, then Enter
 *   first     Home                      last       End
 *   black     B or `.`                  white      W or `,`
 *   laser     Ctrl+L                    pen        Ctrl+P
 *   arrow     Ctrl+A                    eraser     Ctrl+E
 *   erase-all E                         ink markup Ctrl+M
 *   hide UI   Ctrl+H                    all slides Ctrl+S
 *   menu      Shift+F10                 end        Esc or `-`
 *
 * Note the deliberate collisions with editor shortcuts: during a show `Ctrl+S`
 * is "All Slides", not save, and `Ctrl+A` is "arrow pointer", not select-all.
 * That is PowerPoint's behaviour and callers should not re-add editor handling
 * on top.
 */

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** A logical slide-show command produced by a key press. */
export type PresentationKeyAction =
	| { action: 'next' }
	| { action: 'previous' }
	| { action: 'first' }
	| { action: 'last' }
	/** Jump to a 1-based slide number the user typed before pressing Enter. */
	| { action: 'goto'; slideNumber: number }
	| { action: 'end' }
	| { action: 'toggleBlackScreen' }
	| { action: 'toggleWhiteScreen' }
	| { action: 'pointerTool'; tool: 'laser' | 'pen' | 'arrow' | 'eraser' }
	| { action: 'eraseAnnotations' }
	| { action: 'toggleInkMarkup' }
	| { action: 'toggleChrome' }
	| { action: 'showAllSlides' }
	| { action: 'contextMenu' }
	/** The key was consumed to build a pending slide number (no visible effect yet). */
	| { action: 'buffering'; buffer: string }
	| { action: 'none' };

/** Keyboard event shape consumed by {@link mapPresentationKey}. */
export interface PresentationKeyInput {
	key: string;
	ctrlKey?: boolean;
	metaKey?: boolean;
	shiftKey?: boolean;
	altKey?: boolean;
}

/**
 * Mutable digit buffer backing PowerPoint's "type a slide number, then Enter"
 * jump. Callers keep one instance per running show and pass it on every key.
 */
export interface PresentationKeyBuffer {
	digits: string;
}

/** A fresh, empty digit buffer. */
export function createPresentationKeyBuffer(): PresentationKeyBuffer {
	return { digits: '' };
}

// ---------------------------------------------------------------------------
// Key sets
// ---------------------------------------------------------------------------

const NEXT_KEYS = new Set(['Enter', 'PageDown', 'ArrowRight', 'ArrowDown', ' ', 'Spacebar']);
const PREVIOUS_KEYS = new Set(['PageUp', 'ArrowLeft', 'ArrowUp', 'Backspace']);

/**
 * True when the modifier state means "no chord": PowerPoint's bare-letter
 * shortcuts (N, P, B, W, E) must not fire while Ctrl/Cmd/Alt is held.
 */
function isBare(input: PresentationKeyInput): boolean {
	return !input.ctrlKey && !input.metaKey && !input.altKey;
}

/** True when Ctrl (Windows) or Cmd (macOS) is held, without Alt. */
function isControlChord(input: PresentationKeyInput): boolean {
	return Boolean(input.ctrlKey || input.metaKey) && !input.altKey;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/**
 * Map one key press to a slide-show action.
 *
 * `buffer` is mutated in place to track a partially typed slide number. Pass
 * the same buffer for the lifetime of the show; {@link createPresentationKeyBuffer}
 * makes one. Digits return `buffering` so callers can show the pending number;
 * the following Enter resolves to `goto`.
 */
export function mapPresentationKey(
	input: PresentationKeyInput,
	buffer: PresentationKeyBuffer = createPresentationKeyBuffer(),
): PresentationKeyAction {
	const { key } = input;

	// -- Ctrl/Cmd chords ----------------------------------------------------
	// Checked first: Ctrl+P is the pen, while a bare P is "previous slide".
	if (isControlChord(input)) {
		switch (key.toLowerCase()) {
			case 'l':
				return { action: 'pointerTool', tool: 'laser' };
			case 'p':
				return { action: 'pointerTool', tool: 'pen' };
			case 'a':
				return { action: 'pointerTool', tool: 'arrow' };
			case 'e':
				return { action: 'pointerTool', tool: 'eraser' };
			case 'm':
				return { action: 'toggleInkMarkup' };
			case 'h':
				return { action: 'toggleChrome' };
			case 's':
				return { action: 'showAllSlides' };
			default:
				return { action: 'none' };
		}
	}

	// -- Context menu -------------------------------------------------------
	if ((key === 'F10' && input.shiftKey) || key === 'ContextMenu') {
		return { action: 'contextMenu' };
	}

	// -- Digit buffer (type a slide number, then Enter) ---------------------
	if (isBare(input) && key.length === 1 && key >= '0' && key <= '9') {
		// Cap the buffer so a leaning keyboard can't build an unbounded string.
		buffer.digits = (buffer.digits + key).slice(-4);
		return { action: 'buffering', buffer: buffer.digits };
	}

	// -- Navigation ---------------------------------------------------------
	if (NEXT_KEYS.has(key)) {
		// Enter resolves a pending slide number instead of advancing.
		if (key === 'Enter' && buffer.digits) {
			const slideNumber = Number.parseInt(buffer.digits, 10);
			buffer.digits = '';
			if (Number.isFinite(slideNumber) && slideNumber > 0) {
				return { action: 'goto', slideNumber };
			}
			return { action: 'none' };
		}
		buffer.digits = '';
		return { action: 'next' };
	}

	if (PREVIOUS_KEYS.has(key)) {
		buffer.digits = '';
		return { action: 'previous' };
	}

	if (key === 'Home') {
		buffer.digits = '';
		return { action: 'first' };
	}
	if (key === 'End') {
		buffer.digits = '';
		return { action: 'last' };
	}

	// -- Bare letters / punctuation -----------------------------------------
	if (isBare(input)) {
		switch (key) {
			case 'n':
			case 'N':
				buffer.digits = '';
				return { action: 'next' };
			case 'p':
			case 'P':
				buffer.digits = '';
				return { action: 'previous' };
			case 'b':
			case 'B':
			case '.':
				return { action: 'toggleBlackScreen' };
			case 'w':
			case 'W':
			case ',':
				return { action: 'toggleWhiteScreen' };
			case 'e':
			case 'E':
				return { action: 'eraseAnnotations' };
			case 'Escape':
			case '-':
				buffer.digits = '';
				return { action: 'end' };
			default:
				break;
		}
	}

	return { action: 'none' };
}

/**
 * True when the action changes which slide is shown, so callers can gate
 * side effects (rehearsal timing capture, audience sync) on real navigation.
 */
export function isNavigationAction(action: PresentationKeyAction): boolean {
	return (
		action.action === 'next' ||
		action.action === 'previous' ||
		action.action === 'first' ||
		action.action === 'last' ||
		action.action === 'goto'
	);
}
