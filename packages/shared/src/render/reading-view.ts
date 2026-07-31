/**
 * PowerPoint's Reading View, as a framework-agnostic state machine.
 *
 * Reading View is the third of PowerPoint's presentation views, and it is the
 * one this viewer never shipped: every binding rendered the ribbon button
 * permanently disabled. It is NOT a second slide show. The distinction the
 * bindings have to preserve is:
 *
 *   Normal        the editor: ribbon, thumbnails, inspector, canvas chrome
 *   Reading View  the deck at full WINDOW size, chrome reduced to a nav bar,
 *                 still inside the page, no Fullscreen API, no annotation
 *                 tools, no presenter console
 *   Slide Show    the deck at full SCREEN size via the Fullscreen API, with
 *                 the pointer tools, blackout, rehearsal and presenter console
 *
 * Reading View therefore deliberately does not reuse the presentation-session
 * machinery. Reusing it would drag fullscreen, blackout, ink and the audience
 * window in with it, which is precisely the weight a reader asked to escape.
 * What it DOES reuse is {@link mapPresentationKey}: PowerPoint honours the same
 * navigation keys in both views, and duplicating that table per binding is how
 * five viewers drift apart.
 *
 * Everything here is pure. The bindings own the markup and the event
 * listeners; they own no navigation rules.
 *
 * @module render/reading-view
 */
import { mapPresentationKey } from './presentation-keymap';
import type { PresentationKeyBuffer, PresentationKeyInput } from './presentation-keymap';

// ---------------------------------------------------------------------------
// DOM contract
// ---------------------------------------------------------------------------

/**
 * Marks the reading-view root in every binding.
 *
 * A neutral data attribute rather than a class or a test id: `e2e/` addresses
 * all five viewers through one selector, and a class name is a styling decision
 * each binding is entitled to make differently.
 */
export const READING_VIEW_ATTR = 'data-pptx-reading-view';

/** Marks the "3 / 12" slide counter inside the reading-view nav bar. */
export const READING_VIEW_COUNTER_ATTR = 'data-pptx-reading-view-counter';

/** Marks the scaled slide surface inside the reading view. */
export const READING_VIEW_STAGE_ATTR = 'data-pptx-reading-view-stage';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Whether the reading view is on screen, and which slide it is showing. */
export interface ReadingViewState {
	open: boolean;
	/** Zero-based index into the deck's visible slides. */
	slideIndex: number;
}

/** The reading view closed, showing nothing. */
export const CLOSED_READING_VIEW: ReadingViewState = { open: false, slideIndex: 0 };

/**
 * Open the reading view on `slideIndex`.
 *
 * Clamped rather than validated: entering from the ribbon while the deck is
 * empty, or on a stale index after a slide was deleted, should show the first
 * slide, not throw at the user.
 */
export function openReadingView(slideIndex: number, slideCount: number): ReadingViewState {
	return { open: true, slideIndex: clampIndex(slideIndex, slideCount) };
}

/** The reading view closed, discarding its position. */
export function closeReadingView(): ReadingViewState {
	return CLOSED_READING_VIEW;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/** A navigation intent a binding can raise from a key, a click or a tap. */
export type ReadingViewCommand =
	| { command: 'next' }
	| { command: 'previous' }
	| { command: 'first' }
	| { command: 'last' }
	/** Jump to a zero-based slide index. */
	| { command: 'goto'; slideIndex: number }
	| { command: 'exit' }
	| { command: 'none' };

/**
 * Translate a key press into a reading-view command.
 *
 * Delegates to the slide-show key table so the two views cannot disagree about
 * what Page Down does, then drops everything Reading View has no surface for.
 * The slide-show-only keys (pen, laser, blackout, rehearsal, "All Slides") are
 * mapped to `none` rather than silently falling through to navigation: a reader
 * pressing Ctrl+P wants their browser's print dialog, and swallowing the chord
 * to activate a pen that this view does not draw would be worse than ignoring
 * it.
 *
 * `buffer` carries PowerPoint's "type a slide number, then Enter" jump. Pass
 * one buffer for as long as the view stays open.
 */
export function mapReadingViewKey(
	input: PresentationKeyInput,
	buffer?: PresentationKeyBuffer,
): ReadingViewCommand {
	const mapped = mapPresentationKey(input, buffer);
	switch (mapped.action) {
		case 'next':
			return { command: 'next' };
		case 'previous':
			return { command: 'previous' };
		case 'first':
			return { command: 'first' };
		case 'last':
			return { command: 'last' };
		case 'goto':
			// The key table speaks in 1-based slide numbers, the state in indexes.
			return { command: 'goto', slideIndex: mapped.slideNumber - 1 };
		case 'end':
			return { command: 'exit' };
		default:
			return { command: 'none' };
	}
}

/** What a binding should do with a key press while the reading view is open. */
export interface ReadingViewKeyHandling {
	command: ReadingViewCommand;
	/**
	 * Stop the key reaching the editor's own shortcut handler underneath.
	 *
	 * Reading View covers the editor but does not unmount it, and every binding
	 * listens for editor shortcuts on `window`. Without this, an arrow key both
	 * turned the page AND nudged the selected shape behind the overlay, so
	 * merely reading a deck silently edited it. Bindings must listen in the
	 * CAPTURE phase and call `stopPropagation()` when this is true.
	 */
	swallow: boolean;
	/** Also cancel the browser default, which for Space/arrows is scrolling. */
	preventDefault: boolean;
}

/**
 * Decide how to treat one key press while the reading view is open.
 *
 * Modifier chords are deliberately let through untouched: Ctrl+P must still
 * reach the browser's print dialog and F12 its dev tools. Everything else is
 * swallowed, because Reading View is modal over the editor and a bare Delete
 * arriving at the canvas underneath would destroy a shape the reader cannot
 * even see.
 */
export function handleReadingViewKey(
	input: PresentationKeyInput,
	buffer?: PresentationKeyBuffer,
): ReadingViewKeyHandling {
	const command = mapReadingViewKey(input, buffer);
	if (command.command !== 'none') {
		return { command, swallow: true, preventDefault: true };
	}
	const isChord = Boolean(input.ctrlKey || input.metaKey || input.altKey);
	// Swallowed but not cancelled: the editor must not see it, yet nothing
	// browser-native (IME, accessibility) needs to be broken to achieve that.
	return { command, swallow: !isChord, preventDefault: false };
}

/**
 * Apply a command, returning the next state.
 *
 * Advancing past the last slide closes the view, which is what PowerPoint does:
 * Reading View has no "end of slide show" screen, it simply hands the reader
 * back to Normal. Going back from the first slide holds instead of closing, so
 * an over-eager Page Up cannot lose someone's place.
 */
export function applyReadingViewCommand(
	state: ReadingViewState,
	command: ReadingViewCommand,
	slideCount: number,
): ReadingViewState {
	if (!state.open || slideCount <= 0) {
		return state.open ? CLOSED_READING_VIEW : state;
	}
	const last = slideCount - 1;
	switch (command.command) {
		case 'next':
			return state.slideIndex >= last
				? CLOSED_READING_VIEW
				: { open: true, slideIndex: state.slideIndex + 1 };
		case 'previous':
			return { open: true, slideIndex: Math.max(0, state.slideIndex - 1) };
		case 'first':
			return { open: true, slideIndex: 0 };
		case 'last':
			return { open: true, slideIndex: last };
		case 'goto':
			return { open: true, slideIndex: clampIndex(command.slideIndex, slideCount) };
		case 'exit':
			return CLOSED_READING_VIEW;
		default:
			return state;
	}
}

/** Whether the "previous" control should be available. */
export function canGoPrevious(state: ReadingViewState): boolean {
	return state.open && state.slideIndex > 0;
}

/**
 * Whether the "next" control should be available.
 *
 * True on the last slide too: there, next means "leave", and PowerPoint keeps
 * the arrow live for exactly that.
 */
export function canGoNext(state: ReadingViewState, slideCount: number): boolean {
	return state.open && slideCount > 0;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** A width/height pair, in CSS pixels. */
export interface ReadingViewBox {
	width: number;
	height: number;
}

/**
 * Scale that fits `canvas` inside `viewport` without cropping it.
 *
 * Reading View letterboxes rather than fills: a 16:9 deck read in a 4:3 window
 * must not have its edges cut off, because unlike a slide show there is no
 * second monitor to blame and the reader cannot scroll. Returns 0 for a
 * degenerate box so a binding rendering before its first layout pass draws
 * nothing instead of an element scaled by Infinity.
 */
export function readingViewFitScale(
	canvas: ReadingViewBox,
	viewport: ReadingViewBox,
	padding = 0,
): number {
	const available = {
		width: viewport.width - padding * 2,
		height: viewport.height - padding * 2,
	};
	if (canvas.width <= 0 || canvas.height <= 0 || available.width <= 0 || available.height <= 0) {
		return 0;
	}
	return Math.min(available.width / canvas.width, available.height / canvas.height);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function clampIndex(index: number, slideCount: number): number {
	if (!Number.isFinite(index) || slideCount <= 0) {
		return 0;
	}
	return Math.min(Math.max(Math.trunc(index), 0), slideCount - 1);
}
