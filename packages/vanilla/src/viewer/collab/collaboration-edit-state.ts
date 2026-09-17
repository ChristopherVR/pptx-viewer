import type { CollaborationControllerDeps } from './collaboration-controller-types';

/** Keep a session restriction separate from the host's requested edit permission. */
export function createCollaborationEditState(deps: CollaborationControllerDeps) {
	let readOnly = false;
	let previousEditable: boolean | null = null;
	return {
		isReadOnly: () => readOnly,
		setReadOnly(next: boolean): void {
			if (next === readOnly) {
				return;
			}
			readOnly = next;
			if (deps.onReadOnlyChange) {
				deps.onReadOnlyChange(next);
			} else if (next) {
				previousEditable = deps.store.get().editable;
				deps.setEditable(false);
			} else if (previousEditable !== null) {
				deps.setEditable(previousEditable);
				previousEditable = null;
			}
		},
	};
}
