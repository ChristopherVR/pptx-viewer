import type { CollabLoadOrigin } from 'pptx-viewer-shared';

/**
 * Whether the slide stage should be replaced by the "Loading" message.
 *
 * A collaboration joiner mounts the viewer with no local deck and receives the
 * room's slides first; the host app's own bootstrap deck then finishes loading
 * (`origin === 'bootstrap'`, and the room's slides win again once it commits).
 * Replacing the stage for that load would unmount the slide canvas and every
 * open inline text editor, discarding the user's focus and draft. So a
 * bootstrap load keeps an already-visible slide on screen; a user-chosen file
 * (or a load with nothing to show yet) still shows the message.
 */
export function stageShowsLoading(
	loading: boolean,
	origin: CollabLoadOrigin,
	hasVisibleSlide: boolean,
): boolean {
	return loading && !(origin === 'bootstrap' && hasVisibleSlide);
}

/**
 * Whether an in-flight source load should withdraw edit permission from a
 * collaboration session (sourcePending). The same rule as the stage: a
 * bootstrap load that starts after the room's slides are already on screen is
 * subordinate to them, so it must not flip the session read-only. Doing so
 * closes every open inline text editor (getEditable() turning false calls
 * closeInline()), committing or losing the draft mid-keystroke.
 */
export function sourceBlocksEditing(
	hasSource: boolean,
	loading: boolean,
	origin: CollabLoadOrigin,
	hasVisibleSlide: boolean,
): boolean {
	return hasSource && stageShowsLoading(loading, origin, hasVisibleSlide);
}
