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

/**
 * Which elements the on-canvas action affordances (amber "has action" badge +
 * hover link tooltip) may decorate.
 *
 * An inherited master/layout shape is inert until edit-template mode is on, so
 * it must not advertise an action the user cannot reach yet; that mirrors
 * React's `canInteract` gate, which is off for the template layer until the
 * mode is enabled. Split out of the component's post-render effect so it is
 * testable without a TestBed, like the rest of this package.
 */
export function affordanceElements<T>(
	elements: readonly T[],
	editTemplateMode: boolean,
	isTemplate: (element: T) => boolean,
): readonly T[] {
	return editTemplateMode ? elements : elements.filter((element) => !isTemplate(element));
}
