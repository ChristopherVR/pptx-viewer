import type { ViewerState } from './state';

/** Build the state patch for entering or leaving the dedicated master canvas. */
export function toggleMasterView(state: ViewerState): Partial<ViewerState> | null {
	if (!state.editable) {
		return null;
	}
	const cleared = { selectedElementId: null, selectedElementIds: [] };
	if (state.masterViewTarget) {
		return {
			...cleared,
			masterViewTarget: null,
			masterViewTab: 'slides',
			editTemplateMode: false,
		};
	}
	if (state.slideMasters.length > 0) {
		return {
			...cleared,
			masterViewTarget: { masterIndex: 0, layoutIndex: null },
			masterViewTab: 'slides',
			editTemplateMode: true,
		};
	}
	if (state.notesMaster || state.handoutMaster) {
		return {
			...cleared,
			masterViewTarget: { masterIndex: 0, layoutIndex: null },
			masterViewTab: state.notesMaster ? 'notes' : 'handout',
			editTemplateMode: true,
		};
	}
	return { ...cleared, editTemplateMode: !state.editTemplateMode };
}
