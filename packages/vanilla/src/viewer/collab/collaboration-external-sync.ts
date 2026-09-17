import type {
	CollabLoadOrigin,
	CollaborationConfig,
	CollaborationLivePatcher,
	ConnectionStatus,
	ExternalCollaborationSession,
	YjsFactories,
} from 'pptx-viewer-shared';
import {
	createSyncGate,
	observeExternalCollaborationSession,
	readSlidesFromYDoc,
} from 'pptx-viewer-shared';

interface ExternalSyncDeps {
	factories: YjsFactories;
	livePatcher: CollaborationLivePatcher;
	gate: ReturnType<typeof createSyncGate>;
	applyRemote(allowEmpty: boolean): boolean;
	flushLocal(): void;
	cancelWriteBack(): void;
	setStatus(status: ConnectionStatus): void;
}

export interface ExternalSessionSync {
	applyRemote(): void;
	localPublished(): void;
	contentLoaded(origin: CollabLoadOrigin): void;
	dispose(): void;
}

/** Host readiness replaces transport grace timers, including the initial join barrier. */
export function createExternalSessionSync(
	session: ExternalCollaborationSession,
	config: CollaborationConfig,
	deps: ExternalSyncDeps,
): ExternalSessionSync {
	let synced = false;
	let awaitingInitialRoom = config.sessionIntent === 'join';
	let allowEmpty = false;
	const localPublished = (): void => {
		allowEmpty ||= readSlidesFromYDoc(session.doc).length > 0;
	};
	const adopt = (): boolean => {
		if (!deps.applyRemote(allowEmpty)) {
			return false;
		}
		awaitingInitialRoom = false;
		allowEmpty = true;
		return true;
	};
	const refresh = (): void => {
		if (synced && !awaitingInitialRoom && config.role !== 'viewer') {
			deps.livePatcher.configure(session.doc, deps.factories);
			deps.gate.open();
			localPublished();
		} else {
			deps.cancelWriteBack();
			deps.gate.reset();
			deps.livePatcher.configure(null, null);
		}
	};
	const unsubscribe = observeExternalCollaborationSession(session, (snapshot) => {
		synced = snapshot.synced;
		if (synced && !deps.gate.isOpen()) {
			adopt();
		}
		refresh();
		deps.setStatus(snapshot.status);
	});
	return {
		localPublished,
		applyRemote() {
			adopt();
			refresh();
		},
		contentLoaded(origin) {
			if (origin === 'user') {
				awaitingInitialRoom = false;
				allowEmpty = true;
			} else if (adopt()) {
				refresh();
				return;
			}
			refresh();
			if (deps.gate.isOpen()) {
				deps.flushLocal();
			}
		},
		dispose: unsubscribe,
	};
}
