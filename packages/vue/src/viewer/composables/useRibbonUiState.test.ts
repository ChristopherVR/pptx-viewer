import { describe, expect, it, vi } from 'vitest';
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

	it('packages the presentation without opening the collaboration dialog', () => {
		const state = useRibbonUiState();
		const shareOpen = ref(false);
		const packageForSharing = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
		const actions = buildRibbonPropsActions({
			...state,
			canDistribute: ref(false),
			shareOpen,
			packageForSharing,
		} as unknown as UseRibbonPropsInput);

		actions.onPackageForSharing();

		expect(packageForSharing).toHaveBeenCalledOnce();
		expect(shareOpen.value).toBeFalsy();
	});
});
