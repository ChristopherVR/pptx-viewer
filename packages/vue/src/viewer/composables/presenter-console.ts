/**
 * Presenter-console view model: turns the shared, framework-neutral console
 * inventory into rows a Vue template can render with a single `v-for`.
 *
 * WHY this is a composable and not logic inside `PresenterControlStrip.vue`:
 * the strip used to hard-code its own order and its own English strings, which
 * is how the Vue console ended up ordering zoom `-` before `+` and calling
 * reset-zoom "Fit" while React called it "Reset Zoom". Deriving every slot from
 * {@link PRESENTER_CONSOLE_CONTROLS} here means the order, the ids and the
 * accessible-name keys can only drift by changing shared, and the SFC stays a
 * thin presentation layer (the repo's file-size / no-computation-in-SFC rule).
 *
 * The kebab-case icon names in the inventory are deliberately framework-neutral
 * (Vanilla has no component to hand), so each binding needs exactly one lookup
 * from that name to its own icon set; that lookup lives here rather than being
 * repeated per call site.
 */
import {
	ArrowLeftRight,
	Captions,
	CirclePause,
	CirclePlay,
	Eraser,
	Grid2x2,
	Highlighter,
	Monitor,
	MonitorOff,
	MousePointer2,
	PenTool,
	RotateCcw,
	Scan,
	X,
	ZoomIn,
	ZoomOut,
} from 'lucide-vue-next';
import { PRESENTER_CONSOLE_CONTROLS, PRESENTER_RAIL_CONTROLS } from 'pptx-viewer-shared';
import type {
	PresentationPointerTool,
	PresentationSnapshot,
	PresenterControl,
	PresenterControlKind,
} from 'pptx-viewer-shared';
import type { Component } from 'vue';

/** Inventory icon name (kebab-case) -> the lucide-vue-next component for it. */
const CONTROL_ICONS: Partial<Record<string, Component>> = {
	'arrow-left-right': ArrowLeftRight,
	captions: Captions,
	'circle-pause': CirclePause,
	'circle-play': CirclePlay,
	eraser: Eraser,
	'grid-2x2': Grid2x2,
	highlighter: Highlighter,
	monitor: Monitor,
	'monitor-off': MonitorOff,
	'mouse-pointer-2': MousePointer2,
	'pen-tool': PenTool,
	'rotate-ccw': RotateCcw,
	scan: Scan,
	x: X,
	'zoom-in': ZoomIn,
	'zoom-out': ZoomOut,
};

/**
 * Control id -> the annotation tool it selects. A lookup rather than a cast, so
 * an id that stops being a pointer tool upstream fails by returning `undefined`
 * instead of silently producing an impossible `PresentationPointerTool`.
 */
const POINTER_TOOL_BY_ID: Partial<Record<string, PresentationPointerTool>> = {
	laser: 'laser',
	pen: 'pen',
	highlighter: 'highlighter',
	eraser: 'eraser',
};

/** Control id -> the blackout state it switches on (same rationale as above). */
const BLACKOUT_BY_ID: Partial<Record<string, PresentationSnapshot['blackout']>> = {
	'blackout-black': 'black',
	'blackout-white': 'white',
};

/** The annotation tool a strip control selects, or `undefined` if it is not one. */
export function presenterPointerTool(id: string): PresentationPointerTool | undefined {
	return POINTER_TOOL_BY_ID[id];
}

/** The blackout state a strip control switches on, or `undefined`. */
export function presenterBlackoutValue(id: string): PresentationSnapshot['blackout'] | undefined {
	return BLACKOUT_BY_ID[id];
}

/** One rendered slot of the console strip, fully resolved for the template. */
export interface PresenterConsoleSlot {
	id: string;
	kind: PresenterControlKind;
	/** i18n key for the accessible name; empty for dividers and spacers. */
	labelKey: string;
	/** Icon component, or `null` for a glyph-only / text-only slot. */
	icon: Component | null;
	/** Literal glyph (the `B` / `W` blackout switches); never the accessible name. */
	glyph: string | null;
	/** Whether the control currently reflects an engaged state. */
	active: boolean;
}

/**
 * Whether a control reads as engaged right now.
 *
 * Zoom-in lights up while the stage is zoomed and the timer toggle while the
 * timer is paused, mirroring React: those two are plain buttons whose state is
 * otherwise invisible, so the highlight is the only feedback the presenter gets.
 */
function isControlActive(
	control: PresenterControl,
	snapshot: PresentationSnapshot,
	audienceOpen: boolean,
): boolean {
	switch (control.id) {
		case 'timer-toggle':
			return snapshot.paused === true;
		case 'zoom-in':
			return (snapshot.zoom?.scale ?? 1) > 1;
		case 'captions':
			return snapshot.subtitlesVisible === true;
		case 'audience':
			return audienceOpen;
		default:
			break;
	}
	const blackout = presenterBlackoutValue(control.id);
	if (blackout !== undefined) {
		return snapshot.blackout === blackout;
	}
	const tool = presenterPointerTool(control.id);
	return tool !== undefined && (snapshot.pointer?.tool ?? 'none') === tool;
}

/**
 * Resolve the whole strip for a given snapshot: order, active state, icon and
 * accessible-name key per slot.
 */
export function presenterConsoleSlots(
	snapshot: PresentationSnapshot,
	audienceOpen: boolean,
): PresenterConsoleSlot[] {
	return PRESENTER_CONSOLE_CONTROLS.map((control) => {
		const active = isControlActive(control, snapshot, audienceOpen);
		const iconName = active && control.activeIcon !== undefined ? control.activeIcon : control.icon;
		const labelKey =
			active && control.activeLabelKey !== undefined ? control.activeLabelKey : control.labelKey;
		return {
			id: control.id,
			kind: control.kind,
			labelKey: labelKey ?? '',
			icon: (iconName === undefined ? undefined : CONTROL_ICONS[iconName]) ?? null,
			glyph: control.glyph ?? null,
			active,
		};
	});
}

/**
 * Rail control id -> accessible-name key, derived from the shared inventory so
 * the rail's prev/next/font-size buttons cannot drift from it either.
 */
export const PRESENTER_RAIL_CONTROL_LABEL_KEYS: Record<string, string> = Object.fromEntries(
	PRESENTER_RAIL_CONTROLS.map((control) => [control.id, control.labelKey]),
);
