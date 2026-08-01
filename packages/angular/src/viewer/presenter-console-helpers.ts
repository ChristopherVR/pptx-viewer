/**
 * presenter-console-helpers.ts
 *
 * Turns the shared presenter-console INVENTORY
 * (`PRESENTER_CONSOLE_CONTROLS`) into the per-slot view model the Angular strip
 * binds to.
 *
 * WHY this is a helper and not template logic: the strip used to be an inline
 * template of sixteen hand-written buttons with hard-coded English labels and no
 * `translate` pipe in sight, so the console was unreadable in every locale but
 * one and its black-screen switch announced itself to a screen reader as the
 * letter "B". Deriving the strip from the shared inventory fixes that at the
 * source, and keeping the derivation here (rather than in the component) keeps
 * the SFC-equivalent thin and lets the mapping be unit-tested without TestBed.
 *
 * Everything except the click handlers comes from `pptx-viewer-shared`: order,
 * ids, kinds, label keys, icon names and glyphs. Only "what does pressing this
 * do" stays in the component, because that is the genuinely per-binding half.
 */
import { PRESENTER_CONSOLE_CONTROLS } from '../internal/shared';
import type {
	PresentationPointerTool,
	PresentationSnapshot,
	PresenterControl,
} from '../internal/shared';

/**
 * The four strip slots that select an annotation tool, by control id.
 *
 * A lookup rather than four `case` arms because the ids and the tool names are
 * deliberately identical: if the shared inventory ever renames one, the missing
 * entry is a compile-visible gap instead of a silently inert button.
 */
const POINTER_TOOLS: Readonly<Record<string, PresentationPointerTool>> = {
	laser: 'laser',
	pen: 'pen',
	highlighter: 'highlighter',
	eraser: 'eraser',
};

/** One resolved slot of the presenter console strip, ready to bind. */
export interface PresenterConsoleSlot {
	/** The shared inventory entry this slot renders. */
	control: PresenterControl;
	/** Stable id, mirrored into `data-pptx-presenter-control`. */
	id: string;
	/** Drives the active class, `aria-pressed`, and the active icon/label. */
	active: boolean;
	/** True when the slot cannot act yet (Swap Displays without an audience). */
	disabled: boolean;
	/** i18n key for the accessible name; undefined on dividers and spacers. */
	labelKey: string | undefined;
	/** kebab-case Lucide icon name to render, or undefined for text-only slots. */
	iconName: string | undefined;
	/**
	 * `aria-pressed` value, or null on non-toggles.
	 *
	 * Null rather than undefined because Angular removes an `[attr.*]` binding
	 * only for null, and a plain button that reports `aria-pressed="false"` is
	 * announced as an unpressed toggle it is not.
	 */
	pressed: boolean | null;
	/** The annotation tool this slot selects, when it is one of the four. */
	tool: PresentationPointerTool | undefined;
}

/**
 * Whether a slot reads as "on" right now.
 *
 * `timer-toggle` and `zoom-in` are buttons, not toggles: their activity only
 * picks the resume glyph / the emphasised zoom style, and
 * {@link PresenterConsoleSlot.pressed} keeps `aria-pressed` off them.
 */
export function presenterSlotActive(
	control: PresenterControl,
	snapshot: PresentationSnapshot,
	audienceOpen: boolean,
): boolean {
	const tool = POINTER_TOOLS[control.id];
	if (tool !== undefined) {
		return (snapshot.pointer?.tool ?? 'none') === tool;
	}
	switch (control.id) {
		case 'timer-toggle':
			return snapshot.paused;
		case 'zoom-in':
			return (snapshot.zoom?.scale ?? 1) > 1;
		case 'blackout-black':
			return snapshot.blackout === 'black';
		case 'blackout-white':
			return snapshot.blackout === 'white';
		case 'captions':
			return snapshot.subtitlesVisible === true;
		case 'audience':
			return audienceOpen;
		default:
			return false;
	}
}

/**
 * Whether a slot is unusable in the current session.
 *
 * Only Swap Displays, which needs a second window to swap with. Notably NOT
 * Next: see `presenterNextDisabled` in the shared module for why disabling it
 * strands the presenter on the final slide.
 */
export function presenterSlotDisabled(controlId: string, audienceOpen: boolean): boolean {
	return controlId === 'swap-displays' && !audienceOpen;
}

/**
 * Resolve the whole strip, in the shared inventory's order.
 *
 * Dividers and spacers come through as slots too (with no label, icon or
 * handler) so the template renders one list instead of interleaving two.
 */
export function presenterConsoleSlots(
	snapshot: PresentationSnapshot,
	audienceOpen: boolean,
): PresenterConsoleSlot[] {
	return PRESENTER_CONSOLE_CONTROLS.map((control) => {
		const active = presenterSlotActive(control, snapshot, audienceOpen);
		const isToggle = control.kind === 'toggle';
		return {
			control,
			id: control.id,
			active,
			disabled: presenterSlotDisabled(control.id, audienceOpen),
			labelKey: active && control.activeLabelKey ? control.activeLabelKey : control.labelKey,
			iconName: active && control.activeIcon ? control.activeIcon : control.icon,
			pressed: isToggle ? active : null,
			tool: POINTER_TOOLS[control.id],
		};
	});
}
