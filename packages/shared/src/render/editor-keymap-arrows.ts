/**
 * Arrow and paging keys of the editor keymap (`editor-keymap.ts`): the nudge
 * step an arrow moves a selection by, and when an arrow or paging key moves
 * between slides instead.
 *
 * @module editor-keymap-arrows
 */

/**
 * Slide pixels an unmodified arrow key moves the selection.
 *
 * PowerPoint nudges by the smallest unit it can draw, and the ribbon's position
 * boxes are authored in the same slide-pixel space the renderer lays out in, so
 * one arrow press must equal one slide pixel or the numbers in the inspector
 * disagree with what the keyboard does.
 */
export const NUDGE_SMALL = 1;

/** Slide pixels a Shift+arrow moves the selection (ten small steps). */
export const NUDGE_LARGE = 10;

/** Map an arrow key to a nudge delta in slide pixels, or `null` for other keys. */
export function editorNudgeDelta(key: string, large: boolean): { dx: number; dy: number } | null {
	const step = large ? NUDGE_LARGE : NUDGE_SMALL;
	switch (key) {
		case 'ArrowLeft':
			return { dx: -step, dy: 0 };
		case 'ArrowRight':
			return { dx: step, dy: 0 };
		case 'ArrowUp':
			return { dx: 0, dy: -step };
		case 'ArrowDown':
			return { dx: 0, dy: step };
		default:
			return null;
	}
}

/**
 * The slide step a key takes in the editor, or `null` when it takes none.
 *
 * PageUp / PageDown move between slides in PowerPoint's Normal view even with
 * a shape selected; they never nudge. With nothing selected every arrow pages
 * too, as in PowerPoint's thumbnail pane: Left / Up go back, Right / Down go on.
 * With a selection the arrows nudge it instead (see {@link editorNudgeDelta}).
 */
export function editorSlideStep(
	key: string,
	hasSelection: boolean,
	withModifier: boolean,
): 'prevSlide' | 'nextSlide' | null {
	if (withModifier) {
		return null;
	}
	if (key === 'PageUp') {
		return 'prevSlide';
	}
	if (key === 'PageDown') {
		return 'nextSlide';
	}
	if (hasSelection) {
		return null;
	}
	if (key === 'ArrowLeft' || key === 'ArrowUp') {
		return 'prevSlide';
	}
	if (key === 'ArrowRight' || key === 'ArrowDown') {
		return 'nextSlide';
	}
	return null;
}
