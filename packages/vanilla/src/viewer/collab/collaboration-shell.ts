import type { CollaborationConfig, CollaborationShellState } from 'pptx-viewer-shared';
import { resolveCollaborationShellState } from 'pptx-viewer-shared';

import { createCollaborationController } from './collaboration-controller';
import type {
	CollaborationController,
	CollaborationControllerDeps,
} from './collaboration-controller-types';
import { createCollaborationCursors } from './ui/collaboration-cursors';
import type { CollaborationCursors } from './ui/collaboration-cursors';
import { createRemoteSelectionOverlay } from './ui/remote-selection-overlay';
import type { RemoteSelectionOverlay } from './ui/remote-selection-overlay';

export interface CollaborationShellOptions extends Pick<
	CollaborationControllerDeps,
	'store' | 'getHandler' | 'getSaveOptions'
> {
	document: Document;
	/** Host permission, independent of the effective store.editable value. */
	getCanEdit(): boolean;
	/** True only while an actual source is loading, not for a blank deck. */
	getSourcePending?(): boolean;
	getSourceError?(): boolean;
	getScale?(): number;
	onStateChange?(state: CollaborationShellState): void;
}

export interface CollaborationShell {
	/** Existing controller for load boundaries and interim edit publication. */
	controller: CollaborationController;
	/** Mount beside the scaled stage; refresh after changing the host's zoom. */
	cursorOverlay: CollaborationCursors;
	selectionOverlay: RemoteSelectionOverlay;
	setConfig(config: CollaborationConfig | undefined): Promise<void>;
	getState(): CollaborationShellState;
	/** Re-evaluate host permission, loading or zoom getters after host-only changes. */
	refresh(): void;
	destroy(): void;
}

/** Thin custom-chrome wiring; document ownership and sync stay in the controller. */
export function createCollaborationShell(options: CollaborationShellOptions): CollaborationShell {
	const { store } = options;
	const cursorOverlay = createCollaborationCursors(options.document);
	const selectionOverlay = createRemoteSelectionOverlay(options.document);
	let configured = false;
	let readOnly = false;
	let destroyed = false;
	let refreshing = false;
	const getState = (): CollaborationShellState =>
		resolveCollaborationShellState({
			authorizedCanEdit: options.getCanEdit(),
			configured,
			readOnly,
			sourcePending: options.getSourcePending?.() ?? false,
			sourceError: options.getSourceError?.() ?? Boolean(store.get().error),
			status: controller.getStatus(),
			remoteUsers: store.get().remotePresences,
		});
	const refresh = (): void => {
		if (destroyed || refreshing) {
			return;
		}
		refreshing = true;
		try {
			const state = getState();
			if (store.get().editable !== state.canEdit) {
				store.set({ editable: state.canEdit });
			}
			cursorOverlay.update(configured ? store.get().cursors : [], options.getScale?.() ?? 1);
			selectionOverlay.update(
				state.remoteUsers,
				store.get().slides[store.get().currentSlide]?.elements ?? [],
				store.get().currentSlide,
				options.getScale?.() ?? 1,
			);
			options.onStateChange?.(state);
		} finally {
			refreshing = false;
		}
	};
	const controller = createCollaborationController({
		store,
		getHandler: options.getHandler,
		getSaveOptions: options.getSaveOptions,
		setEditable: (editable) => store.set({ editable }),
		onReadOnlyChange: (value) => {
			readOnly = value;
			refresh();
		},
		onStatusChange: refresh,
	});
	const unsubscribe = store.subscribe((state, previous) => {
		if (state.currentSlide !== previous.currentSlide) {
			controller.setActiveSlide(state.currentSlide);
		}
		if (state.selectedElementId !== previous.selectedElementId) {
			controller.setSelection(state.selectedElementId ?? undefined, state.currentSlide);
		}
		refresh();
	});
	refresh();
	return {
		controller,
		cursorOverlay,
		selectionOverlay,
		getState,
		refresh,
		async setConfig(config) {
			if (destroyed) {
				return;
			}
			configured = Boolean(config);
			if (config) {
				await controller.start(config);
			} else {
				controller.stop();
			}
			refresh();
		},
		destroy() {
			if (destroyed) {
				return;
			}
			destroyed = true;
			unsubscribe();
			controller.destroy();
			cursorOverlay.destroy();
			selectionOverlay.destroy();
		},
	};
}
