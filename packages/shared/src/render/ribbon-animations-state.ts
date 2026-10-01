import type { PptxAnimationPreset } from 'pptx-viewer-core';

import {
	EMPHASIS_PRESET_VALUES,
	ENTRANCE_PRESET_VALUES,
	EXIT_PRESET_VALUES,
} from './animation-authoring';
import type { AnimationGroup } from './animation-authoring';
import type { AnimationApplyGroup } from './motion-path-authoring';
import { motionPathPresetById } from './motion-path-presets';

/** Commands that carry no payload; the host decides what each one does natively. */
export type RibbonAnimationsCommand =
	| 'preview'
	| 'effectOptions'
	| 'animationPane'
	| 'trigger'
	| 'remove';

/**
 * Controlled Animations tab state. Hosts own the slide model, selection,
 * history and the inspector; the view only reflects these values.
 */
export interface RibbonAnimationsViewState {
	/** False in read-only hosts: every authoring intent is rejected. */
	editable: boolean;
	/** Whether an element is selected; effects always target one element. */
	hasSelection: boolean;
	/** Whether the Animation Pane (inspector) is open; reflected as pressed. */
	paneOpen?: boolean;
	/** Transient highlight while a host's Preview is playing, where it tracks one. */
	previewActive?: boolean;
	translate?: (key: string) => string;
}

export type RibbonAnimationsIntent =
	| { kind: 'command'; value: RibbonAnimationsCommand }
	/** `preset` is a preset name, or a motion-path catalogue id for `motionPath`. */
	| { kind: 'add'; group: AnimationApplyGroup; preset: string };

/** One gallery column: a bucket's caption key and the presets filed under it. */
export interface RibbonAnimationsCategory {
	group: AnimationGroup;
	labelKey: string;
	fallback: string;
	presets: readonly PptxAnimationPreset[];
}

export const ANIMATION_RIBBON_CATEGORIES: readonly RibbonAnimationsCategory[] = [
	{
		group: 'entrance',
		labelKey: 'pptx.animation.entrance',
		fallback: 'Entrance',
		presets: ENTRANCE_PRESET_VALUES,
	},
	{
		group: 'emphasis',
		labelKey: 'pptx.animation.emphasis',
		fallback: 'Emphasis',
		presets: EMPHASIS_PRESET_VALUES,
	},
	{
		group: 'exit',
		labelKey: 'pptx.animation.exit',
		fallback: 'Exit',
		presets: EXIT_PRESET_VALUES,
	},
];

export function animationsLabel(
	state: RibbonAnimationsViewState,
	key: string,
	fallback: string,
): string {
	const value = state.translate?.(key);
	return value && value !== key ? value : fallback;
}

/** Everything except opening the pane needs an editable host and a selected element. */
export function animationsGated(state: RibbonAnimationsViewState): boolean {
	return !state.editable || !state.hasSelection;
}

const BUCKETS: Readonly<Record<AnimationGroup, readonly PptxAnimationPreset[]>> = {
	entrance: ENTRANCE_PRESET_VALUES,
	emphasis: EMPHASIS_PRESET_VALUES,
	exit: EXIT_PRESET_VALUES,
};

/** Reject malformed programmatic intents as well as disabled pointer/keyboard picks. */
export function canRequestAnimations(
	state: RibbonAnimationsViewState,
	intent: RibbonAnimationsIntent,
): boolean {
	if (intent.kind === 'command') {
		if (intent.value === 'animationPane') {
			return true;
		}
		return (
			['preview', 'effectOptions', 'trigger', 'remove'].includes(intent.value) &&
			!animationsGated(state)
		);
	}
	if (animationsGated(state)) {
		return false;
	}
	if (intent.group === 'motionPath') {
		return motionPathPresetById(intent.preset) !== undefined;
	}
	const bucket = BUCKETS[intent.group] as readonly string[] | undefined;
	return bucket?.includes(intent.preset) ?? false;
}
