import type {
	CollaborationConfig,
	ExternalCollaborationSession,
	ExternalCollaborationReadiness,
	YjsFactories,
} from '../internal/shared';
import {
	borrowExternalCollaborationAwareness,
	DEFAULT_CURSOR_COLOR,
	observeExternalCollaborationReadiness,
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
	let readiness: ExternalCollaborationReadiness | undefined;
	const dispose = (): void => {
		readiness?.();
		awareness.off('change', deps.refreshPresence);
		awareness.off('update', deps.refreshPresence);
		borrowed.dispose();
	};
	try {
		readiness = observeExternalCollaborationReadiness(external, {
			gate: deps.slideSync.gate,
			livePatcher: deps.livePatcher,
			factories,
			role: config.role,
			sessionIntent: config.sessionIntent,
			onStatus: deps.setStatus,
			onReadOnlyChange: deps.setReadOnly,
			adoptSlides: (slides) => deps.slideSync.adoptSlides(slides),
			onReady: ({ seedEmptyRoom }) => deps.slideSync.publishCurrent(seedEmptyRoom),
			onSuspend: () => {
				deps.slideSync.cancelPending();
				deps.cancelWriteBack();
			},
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
		readiness,
		dispose,
	};
}
