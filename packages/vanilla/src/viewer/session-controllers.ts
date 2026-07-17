import type { PptxHandler } from 'pptx-viewer-core';
import type { CollaborationConfig, ConnectionStatus } from 'pptx-viewer-shared';

import type { AutosaveStatus } from './autosave/autosave-controller';
import { createAutosaveController } from './autosave/autosave-controller';
import type { CollabUiController } from './collab/collab-ui';
import { createCollabUi } from './collab/collab-ui';
import type { CollaborationController } from './collab/collaboration-controller';
import { createCollaborationController } from './collab/collaboration-controller';
import type { Translator } from './i18n';
import type { Store, ViewerState } from './state';
import type { PptxViewerOptions } from './types';
import type { ViewerChrome } from './ui';

/** Default debounce (ms) between an edit and a persisted autosave snapshot. */
const DEFAULT_AUTOSAVE_INTERVAL_MS = 2_000;
/** Default IndexedDB recovery key when the host does not supply one. */
const DEFAULT_AUTOSAVE_FILE_PATH = 'presentation.pptx';

export interface SessionControllersDeps {
	doc: Document;
	store: Store<ViewerState>;
	options: PptxViewerOptions;
	getHandler: () => PptxHandler | null;
	getChrome: () => ViewerChrome;
	getTranslator: () => Translator;
	getScale: () => number;
	setEditable: (editable: boolean) => void;
	/** Navigate to a slide (follow-mode target). */
	goToSlide: (index: number) => void;
}

/**
 * Owns the collaboration + autosave session controllers and their thin wiring
 * into the viewer chrome (the autosave status pill in the toolbar). Kept out of
 * `PptxViewer` so the orchestrator class stays under its file-size budget and
 * new session capabilities hang off this one indirection module.
 */
export interface SessionControllers {
	startCollaboration(config: CollaborationConfig): Promise<void>;
	stopCollaboration(): void;
	getCollaborationStatus(): ConnectionStatus;
	/** Publish a cursor move (slide-space px); no-op when no session is active. */
	setCollaborationCursor(x: number, y: number): void;
	/** Follow the given peer's active slide, or `null` to stop following. */
	followCollaborationUser(clientId: number | null): void;
	/** Force an immediate autosave (no-op when autosave is disabled). */
	autosaveNow(): Promise<void>;
	/** Enable/disable recovery autosave for the active viewer session. */
	setAutosaveEnabled(enabled: boolean): void;
	isAutosaveEnabled(): boolean;
	/** Open the viewer's built-in broadcast dialog. */
	openBroadcast(): void;
	/** Open the viewer's built-in collaboration sharing dialog. */
	openShare(): void;
	destroy(): void;
}

/** Map an autosave lifecycle status to its localized toolbar label. */
function autosaveLabel(status: AutosaveStatus, t: Translator): string {
	switch (status) {
		case 'saving':
			return t('pptx.autosave.saving');
		case 'saved':
			return t('pptx.autosave.savedShort');
		case 'error':
			return t('pptx.autosave.saveFailed');
		default:
			return '';
	}
}

export function createSessionControllers(deps: SessionControllersDeps): SessionControllers {
	const { options } = deps;

	const autosave = createAutosaveController({
		store: deps.store,
		getHandler: deps.getHandler,
		filePath: options.autosaveFilePath ?? DEFAULT_AUTOSAVE_FILE_PATH,
		intervalMs: options.autosaveIntervalMs ?? DEFAULT_AUTOSAVE_INTERVAL_MS,
		onStatus: (status) => {
			deps
				.getChrome()
				.ribbon?.setAutosaveStatus(autosaveLabel(status, deps.getTranslator()), status);
			deps.getChrome().titleBar?.setAutosaveState(status);
			options.onAutosaveStatus?.(status);
		},
		onRecovery: (record) => options.onAutosaveRecovery?.(record),
		enabled: options.autosave ?? false,
	});

	// Set once `collabUi` is constructed below (it needs the controller's
	// start/stop functions, which must exist first); forwards every status
	// transition into the collab UI (dialogs + toolbar status pill).
	let notifyCollabUi: ((status: ConnectionStatus) => void) | null = null;

	const collaboration: CollaborationController = createCollaborationController({
		store: deps.store,
		getHandler: deps.getHandler,
		setEditable: deps.setEditable,
		onStatusChange: (status) => {
			options.onCollaborationStatus?.(status);
			notifyCollabUi?.(status);
		},
	});

	// URL-driven / host-configured join: auto-start when a config is supplied.
	if (options.collaboration) {
		void collaboration.start(options.collaboration);
	}

	// Publish local active-slide/selection changes and drive follow-mode
	// navigation off the store, so no other module needs to know about
	// collaboration to stay presence-aware.
	const unsubscribePresence = deps.store.subscribe((state, previous) => {
		if (!collaboration.isActive()) {
			return;
		}
		if (state.currentSlide !== previous.currentSlide) {
			collaboration.setActiveSlide(state.currentSlide);
		}
		if (state.selectedElementId !== previous.selectedElementId) {
			collaboration.setSelection(state.selectedElementId ?? undefined, state.currentSlide);
		}
		if (state.followedClientId !== null && state.remotePresences !== previous.remotePresences) {
			const followed = state.remotePresences.find((p) => p.clientId === state.followedClientId);
			if (followed && followed.activeSlideIndex !== state.currentSlide) {
				deps.goToSlide(followed.activeSlideIndex);
			}
		}
	});

	// Owns the Share/Broadcast dialogs, the cursor overlay, the toolbar status
	// pill, and the follow-mode bar; delegates start/stop back into `collaboration`.
	const collabUi: CollabUiController = createCollabUi({
		doc: deps.doc,
		store: deps.store,
		getChrome: deps.getChrome,
		getTranslator: deps.getTranslator,
		getScale: deps.getScale,
		startCollaboration: (config) => collaboration.start(config),
		stopCollaboration: () => collaboration.stop(),
		getStatus: () => collaboration.getStatus(),
		getConfig: () => collaboration.getConfig(),
		followUser: (clientId) => collaboration.followUser(clientId),
		shareDefaults: options.shareDefaults,
		hiddenActions: options.hiddenActions,
	});
	notifyCollabUi = (status) => collabUi.onStatusChange(status);

	return {
		startCollaboration: (config) => collaboration.start(config),
		stopCollaboration: () => collaboration.stop(),
		getCollaborationStatus: () => collaboration.getStatus(),
		setCollaborationCursor: (x, y) => collaboration.setCursor(x, y, deps.store.get().currentSlide),
		followCollaborationUser: (clientId) => collaboration.followUser(clientId),
		autosaveNow: () => autosave.saveNow(),
		setAutosaveEnabled(enabled) {
			autosave.setEnabled(enabled);
			options.onToggleAutosave?.(enabled);
		},
		isAutosaveEnabled: () => autosave.isEnabled(),
		openBroadcast: () => collabUi.openBroadcast(),
		openShare: () => collabUi.openShare(),
		destroy() {
			unsubscribePresence();
			collabUi.destroy();
			collaboration.destroy();
			autosave.destroy();
		},
	};
}
