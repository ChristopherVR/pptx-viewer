import type { PptxSlide } from 'pptx-viewer-core';
import type {
	CollabLoadOrigin,
	CollaborationConfig,
	CollaborationLivePatcher,
	ConnectionStatus,
	ExternalCollaborationSession,
	SyncGate,
	YjsFactories,
} from 'pptx-viewer-shared';
import { observeExternalCollaborationReadiness } from 'pptx-viewer-shared';

interface ExternalSyncDeps {
	factories: YjsFactories;
	livePatcher: CollaborationLivePatcher;
	gate: SyncGate;
	adoptSlides(slides: PptxSlide[]): void;
	flushLocal(): void;
	resetBaseline(): void;
	cancelWriteBack(): void;
	setStatus(status: ConnectionStatus): void;
	setReadOnly(readOnly: boolean): void;
}

export interface ExternalSessionSync {
	contentLoaded(origin: CollabLoadOrigin): void;
	dispose(): void;
}

/** Host readiness replaces transport grace timers, including the initial join barrier. */
export function createExternalSessionSync(
	session: ExternalCollaborationSession,
	config: CollaborationConfig,
	deps: ExternalSyncDeps,
): ExternalSessionSync {
	const readiness = observeExternalCollaborationReadiness(session, {
		gate: deps.gate,
		factories: deps.factories,
		livePatcher: deps.livePatcher,
		role: config.role,
		sessionIntent: config.sessionIntent,
		adoptSlides: deps.adoptSlides,
		onStatus: deps.setStatus,
		onReadOnlyChange: deps.setReadOnly,
		onSuspend: deps.cancelWriteBack,
		onReady: ({ seedEmptyRoom }) => {
			if (seedEmptyRoom) {
				deps.resetBaseline();
			}
			deps.flushLocal();
		},
	});
	return {
		contentLoaded(origin) {
			if (!readiness.handleLoad(origin) && readiness.canWrite()) {
				deps.flushLocal();
			}
		},
		dispose: readiness,
	};
}
