import { describe, expect, it } from 'vitest';

import { EMPTY_RIBBON_TRANSITION_DRAFT } from './ribbon-transitions';
import {
	canRequestTransitions,
	ribbonTransitionsDraftPatch,
	ribbonTransitionsSoundChange,
	ribbonTransitionStockSoundUrl,
	transitionsLabel,
} from './ribbon-transitions-state';
import type { RibbonTransitionsViewState } from './ribbon-transitions-state';

const state: RibbonTransitionsViewState = { draft: EMPTY_RIBBON_TRANSITION_DRAFT, editable: true };

describe('ribbon transitions state', () => {
	it('maps control intents to draft patches only', () => {
		expect(ribbonTransitionsDraftPatch({ kind: 'preset', value: 'fade' })).toStrictEqual({
			type: 'fade',
		});
		expect(ribbonTransitionsDraftPatch({ kind: 'duration', value: 2 })).toStrictEqual({
			durationSec: 2,
		});
		expect(ribbonTransitionsDraftPatch({ kind: 'advanceAfter', value: true })).toStrictEqual({
			advanceAfter: true,
		});
		expect(ribbonTransitionsDraftPatch({ kind: 'preview' })).toBeUndefined();
	});

	it('gates edits on editability and rejects malformed intents', () => {
		expect(canRequestTransitions(state, { kind: 'preset', value: 'fade' })).toBeTruthy();
		expect(canRequestTransitions(state, { kind: 'preset', value: 'bogus' as never })).toBeFalsy();
		expect(canRequestTransitions(state, { kind: 'duration', value: Number.NaN })).toBeFalsy();
		expect(canRequestTransitions(state, { kind: 'duration', value: 21 })).toBeFalsy();
		expect(canRequestTransitions(state, { kind: 'sound', value: 'other' })).toBeFalsy();
		const locked = { ...state, editable: false };
		expect(canRequestTransitions(locked, { kind: 'applyToAll' })).toBeFalsy();
		expect(canRequestTransitions(locked, { kind: 'preview' })).toBeTruthy();
		expect(canRequestTransitions(locked, { kind: 'soundPreview' })).toBeFalsy();
	});

	it('resolves sound intents into transition patches and stock sound urls', async () => {
		const none = await ribbonTransitionsSoundChange({ kind: 'sound', value: 'none' });
		expect(none).toHaveProperty('soundName', undefined);
		await expect(ribbonTransitionsSoundChange({ kind: 'preview' })).resolves.toBeUndefined();
		expect(ribbonTransitionStockSoundUrl(undefined)).toBeUndefined();
	});

	it('falls back to English and fills the preset name for any interpolation syntax', () => {
		expect(transitionsLabel(state, 'k', 'Fallback')).toBe('Fallback');
		expect(transitionsLabel(state, 'k', '{{name}} transition', { name: 'Fade' })).toBe(
			'Fade transition',
		);
		const translated = { ...state, translate: () => '{name} Uebergang' };
		expect(transitionsLabel(translated, 'k', 'x', { name: 'Fade' })).toBe('Fade Uebergang');
	});
});
