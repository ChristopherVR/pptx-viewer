import type {
	CollaborationConfig,
	ExternalCollaborationSession,
	YjsFactories,
} from '../internal/shared';
import {
	borrowExternalCollaborationAwareness,
	DEFAULT_CURSOR_COLOR,
	observeExternalCollaborationSession,
	observeYDocSlides,
} from '../internal/shared';
import { LocalPresencePublisher } from './collaboration-local-presence';
import type { ActiveSession, ActivateSessionDeps } from './collaboration-session-setup';

/** Attach viewer-owned observers without acquiring ownership of host resources. */
export function activateExternalSession(
	external: ExternalCollaborationSession,
	config: CollaborationConfig,
	factories: YjsFactories,
	deps: ActivateSessionDeps,
): ActiveSession {
	const borrowed = borrowExternalCollaborationAwareness(external.awareness);
	const awareness = borrowed.awareness;
	deps.slideSync.bind({
		ydoc: external.doc,
		factories,
		onRemoteSlides: deps.onRemoteSlides,
		scheduleWriteBack: deps.scheduleWriteBack,
		readOnly: config.role === 'viewer',
		external: true,
		initialJoin: config.sessionIntent === 'join',
	});
	const localPresence = new LocalPresencePublisher(awareness, {
		userName: config.userName,
		userColor: config.userColor ?? DEFAULT_CURSOR_COLOR,
		userAvatar: config.userAvatar,
		role: config.role,
	});
	localPresence.publish();
	awareness.on('change', deps.refreshPresence);
	awareness.on('update', deps.refreshPresence);
	let synced = false;
	const refreshReadiness = (): void => {
		if (synced && deps.slideSync.canPublishExternal()) {
			deps.livePatcher.configure(external.doc, factories);
			deps.slideSync.gate.open();
		} else {
			deps.cancelWriteBack();
			deps.slideSync.gate.reset();
			deps.livePatcher.configure(null, null);
		}
	};
	const unobserve = observeYDocSlides(external.doc, (_events, transaction) => {
		deps.slideSync.adoptExternalDocument(transaction);
		refreshReadiness();
	});
	let unsubscribe = (): void => {};
	const dispose = (): void => {
		unsubscribe();
		unobserve();
		awareness.off('change', deps.refreshPresence);
		awareness.off('update', deps.refreshPresence);
		borrowed.dispose();
	};
	try {
		unsubscribe = observeExternalCollaborationSession(external, (snapshot) => {
			synced = snapshot.synced;
			if (snapshot.synced && !deps.slideSync.gate.isOpen()) {
				// Initial adoption must beat both the pending broadcast and live edits.
				deps.slideSync.adoptExternalDocument();
			}
			refreshReadiness();
			deps.setStatus(snapshot.status);
		});
	} catch (error) {
		dispose();
		throw error;
	}
	return {
		ydoc: external.doc,
		awareness,
		selfId: awareness.clientID,
		localPresence,
		refreshReadiness,
		dispose,
	};
}
