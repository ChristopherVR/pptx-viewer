/**
 * Framework-neutral state and intents for the shared Transitions ribbon view
 * (`pptx-ui-ribbon-transitions`). Hosts own the slide, history and persistence;
 * this module only describes what the controls show and what they may request.
 *
 * @module render/ribbon-transitions-state
 */
import type { PptxSlideTransition, PptxTransitionType } from 'pptx-viewer-core';

import { getEffectSoundAsset } from './effect-sound-synth';
import type { RibbonTransitionDraft } from './ribbon-transitions';
import { RIBBON_TRANSITION_PRESETS } from './ribbon-transitions';
import {
	applyTransitionSoundFile,
	applyTransitionStockSound,
	clearTransitionSound,
	readSoundFileAsDataUrl,
	TRANSITION_SOUND_NONE_VALUE,
	TRANSITION_SOUND_OTHER_VALUE,
	transitionStockSoundId,
} from './slide-transition-sound';

export type RibbonTransitionsTranslate = (key: string, params?: Record<string, string>) => string;

/** Controlled Transitions tab state. The host derives it from the ACTIVE slide. */
export interface RibbonTransitionsViewState {
	draft: RibbonTransitionDraft;
	/** The slide's transition, used only to list and select the Sound entries. */
	transition?: PptxSlideTransition;
	editable: boolean;
	inspectorOpen?: boolean;
	translate?: RibbonTransitionsTranslate;
}

export type RibbonTransitionsIntent =
	| { kind: 'preview' }
	| { kind: 'preset'; value: PptxTransitionType }
	| { kind: 'duration'; value: number }
	| { kind: 'advanceOnClick'; value: boolean }
	| { kind: 'advanceAfter'; value: boolean }
	| { kind: 'advanceAfterText'; value: string }
	| { kind: 'applyToAll' }
	| { kind: 'sound'; value: string }
	| { kind: 'soundFile'; file: File }
	| { kind: 'soundPreview' }
	| { kind: 'inspector' };

/** Intents that never write to the deck, so read-only hosts still allow them. */
const NON_EDITING: readonly RibbonTransitionsIntent['kind'][] = [
	'preview',
	'soundPreview',
	'inspector',
];

export const TRANSITION_DURATION_MAX_SEC = 20;

export function transitionsLabel(
	state: RibbonTransitionsViewState,
	key: string,
	fallback: string,
	params?: Record<string, string>,
): string {
	const value = state.translate?.(key, params);
	if (!value || value === key) {
		return fallback.replace('{{name}}', params?.name ?? '');
	}
	// Hosts whose catalog uses another interpolation syntax still show the name.
	return params?.name ? value.replace(/\{\{?\s*name\s*\}?\}/gu, params.name) : value;
}

/** Reject malformed programmatic intents as well as disabled pointer/keyboard picks. */
export function canRequestTransitions(
	state: RibbonTransitionsViewState,
	intent: RibbonTransitionsIntent,
): boolean {
	if (!state.editable && !NON_EDITING.includes(intent.kind)) {
		return false;
	}
	switch (intent.kind) {
		case 'preset':
			return RIBBON_TRANSITION_PRESETS.some((preset) => preset.type === intent.value);
		case 'duration':
			return (
				Number.isFinite(intent.value) &&
				intent.value >= 0 &&
				intent.value <= TRANSITION_DURATION_MAX_SEC
			);
		case 'advanceAfterText':
		case 'sound':
			return typeof intent.value === 'string' && intent.value !== TRANSITION_SOUND_OTHER_VALUE;
		case 'soundFile':
			return typeof Blob !== 'undefined' && intent.file instanceof Blob;
		case 'soundPreview':
			return transitionStockSoundId(state.transition) !== undefined;
		default:
			return true;
	}
}

/** The draft fields a control intent changes; `undefined` for non-draft intents. */
export function ribbonTransitionsDraftPatch(
	intent: RibbonTransitionsIntent,
): Partial<RibbonTransitionDraft> | undefined {
	switch (intent.kind) {
		case 'preset':
			return { type: intent.value };
		case 'duration':
			return { durationSec: intent.value };
		case 'advanceOnClick':
			return { advanceOnClick: intent.value };
		case 'advanceAfter':
			return { advanceAfter: intent.value };
		case 'advanceAfterText':
			return { advanceAfterText: intent.value };
		default:
			return undefined;
	}
}

/**
 * The transition fields a Sound pick writes (None, a stock sound, or a picked
 * file). Resolves `undefined` when there is nothing to commit, e.g. a failed
 * file read. Reading the bytes is the only async step; committing stays native.
 */
export async function ribbonTransitionsSoundChange(
	intent: RibbonTransitionsIntent,
): Promise<Partial<PptxSlideTransition> | undefined> {
	if (intent.kind === 'sound') {
		return intent.value === TRANSITION_SOUND_NONE_VALUE
			? clearTransitionSound()
			: applyTransitionStockSound(intent.value);
	}
	if (intent.kind === 'soundFile') {
		const dataUrl = await readSoundFileAsDataUrl(intent.file);
		return dataUrl ? applyTransitionSoundFile({ name: intent.file.name, dataUrl }) : undefined;
	}
	return undefined;
}

/** The `data:` URL of the slide's stock sound, for the host's own audio playback. */
export function ribbonTransitionStockSoundUrl(
	transition: PptxSlideTransition | undefined,
): string | undefined {
	const id = transitionStockSoundId(transition);
	return id ? getEffectSoundAsset(id)?.dataUrl : undefined;
}
