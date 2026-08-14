import type { PptxHandler } from 'pptx-viewer-core';
import type {
	AutosaveActivation,
	CollabLoadOrigin,
	CollaborationConfig,
	ConnectionStatus,
} from 'pptx-viewer-shared';
import { publishLiveInlineText } from 'pptx-viewer-shared';

import type { AutosaveStatus } from './autosave';
import { createAutosaveSession } from './autosave';
import type { CollabUiController } from './collab/collab-ui';
import { createCollabUi } from './collab/collab-ui';
import { createCollaborationController } from './collab/collaboration-controller';
import type { CollaborationController } from './collab/collaboration-controller-types';
import type { Translator } from './i18n';
import type { Store, ViewerState } from './state';
import type { PptxViewerOptions } from './types';
import type { ViewerChrome } from './ui';

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
	/** Load bytes through the viewer's normal pipeline (recovery restore). */
	loadFile: (bytes: Uint8Array) => Promise<void>;
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
	/**
	 * Mirror in-progress inline-editor text to collaborators. Typed text only
	 * reaches the store on commit, so without this peers saw nothing while a peer
	 * typed. No-op when no session is active.
	 */
	publishCollaborationInlineText(elementId: string, text: string): void;
	/** Push any queued live-preview frame out (called just before a commit). */
	flushCollaborationLivePatch(): void;
	/** Follow the given peer's active slide, or `null` to stop following. */
	followCollaborationUser(clientId: number | null): void;
	/**
	 * The load pipeline is about to commit a parsed deck: suppress collaboration
	 * slide publishing until {@link notifyCollaborationContentLoaded} runs.
	 */
	beginCollaborationContentLoad(origin: CollabLoadOrigin): void;
	/**
	 * A content load finished. A BOOTSTRAP deck yields to a room that already
	 * holds slides (late-joiner protection); a deck the user opened during the
	 * session is published to the room instead of being thrown away.
	 */
	notifyCollaborationContentLoaded(origin: CollabLoadOrigin): void;
	/** Force an immediate autosave (no-op when autosave is disabled). */
	autosaveNow(): Promise<void>;
	/**
	 * Apply the user's AutoSave preference. INERT when the host passed
	 * `autosave: false`: that option is a policy ceiling, and a preference can
	 * never exceed a policy (see `pptx-viewer-shared/render/autosave-policy`).
	 */
	setAutosaveEnabled(enabled: boolean): void;
	/** Whether recovery snapshots are actually being written right now. */
	isAutosaveEnabled(): boolean;
	/** The user's AutoSave preference, i.e. what the title-bar switch shows. */
	isAutosavePreferred(): boolean;
	/** The full shared activation verdict (drives the title-bar switch state). */
	getAutosaveActivation(): AutosaveActivation;
	/** File > Options > Save > AutoRecover cadence, in milliseconds. */
	setAutosaveIntervalMs(ms: number | undefined): void;
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

	// Activation, cadence and the crash-recovery prompt all live in the shared
	// policy modules; this only supplies the host's options and the viewer's own
	// load path (see `autosave/autosave-session`).
	const autosave = createAutosaveSession({
		doc: deps.doc,
		store: deps.store,
		getHandler: deps.getHandler,
		getTranslator: deps.getTranslator,
		hostAutosave: options.autosave,
		hostIntervalMs: options.autosaveIntervalMs,
		filePath: options.autosaveFilePath ?? DEFAULT_AUTOSAVE_FILE_PATH,
		// Threaded through only so the snapshot uses the shared save decision;
		// a recovery snapshot stays plaintext whatever the protection state is.
		getSaveIntent: () => ({
			password: deps.store.get().presentationPassword,
			passwordProtected: deps.store.get().isPasswordProtected,
		}),
		onStatus: (status) => {
			deps
				.getChrome()
				.ribbon?.setAutosaveStatus(autosaveLabel(status, deps.getTranslator()), status);
			deps.getChrome().titleBar?.setAutosaveState(status);
			options.onAutosaveStatus?.(status);
		},
		onRecovery: (record) => options.onAutosaveRecovery?.(record),
		loadFile: (bytes) => deps.loadFile(bytes),
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
		publishCollaborationInlineText: (elementId, text) => {
			const state = deps.store.get();
			publishLiveInlineText(
				collaboration.livePatcher,
				state.slides[state.currentSlide],
				elementId,
				text,
			);
		},
		flushCollaborationLivePatch: () => collaboration.livePatcher.flush(),
		followCollaborationUser: (clientId) => collaboration.followUser(clientId),
		beginCollaborationContentLoad: (origin) => collaboration.beginContentLoad(origin),
		notifyCollaborationContentLoaded: (origin) => collaboration.notifyContentLoaded(origin),
		autosaveNow: () => autosave.saveNow(),
		setAutosaveEnabled(enabled) {
			// `setEnabled` reports whether the preference was applied at all; a
			// host that passed `autosave: false` makes the toggle inert, and a
			// callback fired for a change that never happened is a lie.
			if (autosave.setEnabled(enabled)) {
				options.onToggleAutosave?.(enabled);
			}
		},
		isAutosaveEnabled: () => autosave.isEnabled(),
		isAutosavePreferred: () => autosave.isPreferred(),
		getAutosaveActivation: () => autosave.getActivation(),
		setAutosaveIntervalMs: (ms) => autosave.setOptionsIntervalMs(ms),
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
