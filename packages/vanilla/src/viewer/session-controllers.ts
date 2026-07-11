import type { PptxHandler } from 'pptx-viewer-core';
import type { CollaborationConfig, ConnectionStatus } from 'pptx-viewer-shared';

import type { AutosaveController, AutosaveStatus } from './autosave/autosave-controller';
import { createAutosaveController } from './autosave/autosave-controller';
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
	store: Store<ViewerState>;
	options: PptxViewerOptions;
	getHandler: () => PptxHandler | null;
	getChrome: () => ViewerChrome;
	getTranslator: () => Translator;
	setEditable: (editable: boolean) => void;
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
	/** Force an immediate autosave (no-op when autosave is disabled). */
	autosaveNow(): Promise<void>;
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

	let autosave: AutosaveController | null = null;
	if (options.autosave) {
		autosave = createAutosaveController({
			store: deps.store,
			getHandler: deps.getHandler,
			filePath: options.autosaveFilePath ?? DEFAULT_AUTOSAVE_FILE_PATH,
			intervalMs: options.autosaveIntervalMs ?? DEFAULT_AUTOSAVE_INTERVAL_MS,
			onStatus: (status) => {
				deps
					.getChrome()
					.ribbon?.setAutosaveStatus(autosaveLabel(status, deps.getTranslator()), status);
				options.onAutosaveStatus?.(status);
			},
			onRecovery: (record) => options.onAutosaveRecovery?.(record),
		});
	}

	const collaboration: CollaborationController = createCollaborationController({
		store: deps.store,
		getHandler: deps.getHandler,
		setEditable: deps.setEditable,
		onStatusChange: (status) => options.onCollaborationStatus?.(status),
	});

	// URL-driven / host-configured join: auto-start when a config is supplied.
	if (options.collaboration) {
		void collaboration.start(options.collaboration);
	}

	return {
		startCollaboration: (config) => collaboration.start(config),
		stopCollaboration: () => collaboration.stop(),
		getCollaborationStatus: () => collaboration.getStatus(),
		autosaveNow: () => autosave?.saveNow() ?? Promise.resolve(),
		destroy() {
			collaboration.destroy();
			autosave?.destroy();
		},
	};
}
