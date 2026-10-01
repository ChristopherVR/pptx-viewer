/** The Font strip adapter: reflected state and the decoding of the shared intent. */
import { describe, expect, it } from 'vitest';

import { fontHomeAction, fontHomeState } from './ribbon-font-home';

describe('ribbon font home helpers', () => {
	it('reflects pressed flags and gates on edit eligibility', () => {
		const state = fontHomeState({ bold: true, textShadowColor: '#000000' }, true, (key) => key);
		expect(state.controls['home.font.bold']).toStrictEqual({ disabled: false, pressed: true });
		expect(state.controls['home.font.italic']?.pressed).toBeFalsy();
		expect(state.controls['home.font.shadow']?.pressed).toBeTruthy();
		expect(
			fontHomeState(null, false, (key) => key).controls['home.font.bold']?.disabled,
		).toBeTruthy();
	});

	it('maps each intent id to the native edit', () => {
		expect(fontHomeAction('home.font.underline')).toStrictEqual({
			kind: 'toggle',
			flag: 'underline',
		});
		expect(fontHomeAction('home.font.shadow')).toStrictEqual({ kind: 'shadow' });
		expect(fontHomeAction('home.font.increaseFontSize')).toStrictEqual({
			kind: 'step',
			direction: 1,
		});
		expect(fontHomeAction('home.font.decreaseFontSize')).toStrictEqual({
			kind: 'step',
			direction: -1,
		});
		expect(fontHomeAction('home.font.clearFormatting')).toStrictEqual({ kind: 'clear' });
		expect(fontHomeAction('home.font.fontColor')).toBeUndefined();
	});
});
