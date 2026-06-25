/**
 * slide-canvas-helpers.ts: Framework-agnostic helpers for the slide canvas.
 * Kept free of Angular imports so they can be unit-tested without TestBed.
 */

/**
 * True only when a press landed directly on the scrollable viewport background
 * (the event target is the viewport element itself, not a bubbled child such as
 * the slide wrapper/stage, rulers, handles, or any nested content). Used to treat
 * empty-workspace clicks around a centered slide as a deselect, mirroring empty
 * slide-stage clicks.
 */
export function isViewportBackgroundPressTarget(
	target: EventTarget | null,
	currentTarget: EventTarget | null,
): boolean {
	return target === currentTarget;
}
