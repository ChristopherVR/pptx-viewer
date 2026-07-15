import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { buildRibbonPropsActions } from './ribbon-props-actions';
import type { UseRibbonPropsInput } from './ribbon-props-types';
import { useRibbonUiState } from './useRibbonUiState';

describe('useRibbonUiState', () => {
	it('toggles the ribbon eyedropper state', () => {
		const state = useRibbonUiState();
		const actions = buildRibbonPropsActions({
			...state,
			canDistribute: ref(false),
		} as unknown as UseRibbonPropsInput);

		expect(state.eyedropperActive.value).toBeFalsy();
		actions.onToggleEyedropper();
		expect(state.eyedropperActive.value).toBeTruthy();
		actions.onToggleEyedropper();
		expect(state.eyedropperActive.value).toBeFalsy();
	});
});
