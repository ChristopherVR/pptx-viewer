import type { Store, ViewerState } from '../state';

interface MasterActionDeps {
	store: Store<ViewerState>;
	pushHistory(): void;
	commitChange(): void;
}

/** Commit the preview layout as a real, undoable handout-master mutation. */
export function setHandoutSlidesPerPage(deps: MasterActionDeps, count: number): void {
	const state = deps.store.get();
	if (!state.editable || !state.handoutMaster || state.handoutSlidesPerPage === count) {
		return;
	}
	deps.pushHistory();
	deps.store.set({
		handoutSlidesPerPage: count,
		handoutMaster: { ...state.handoutMaster, slidesPerPage: count },
	});
	deps.commitChange();
}
