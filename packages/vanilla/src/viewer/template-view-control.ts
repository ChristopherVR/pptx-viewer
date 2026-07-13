import type { ViewerState } from './state';

/** Build the state patch for entering or leaving the dedicated master canvas. */
export function toggleMasterView(state: ViewerState): Partial<ViewerState> | null {
	if (!state.editable) {
		return null;
	}
	const cleared = { selectedElementId: null, selectedElementIds: [] };
	if (state.masterViewTarget) {
		return { ...cleared, masterViewTarget: null, editTemplateMode: false };
	}
	if (state.slideMasters.length > 0) {
		return {
			...cleared,
			masterViewTarget: { masterIndex: 0, layoutIndex: null },
			editTemplateMode: true,
		};
	}
	return { ...cleared, editTemplateMode: !state.editTemplateMode };
}
