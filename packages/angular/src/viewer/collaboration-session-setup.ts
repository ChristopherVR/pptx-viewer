/**
 * collaboration-session-setup.ts: build up and tear down a live collaboration
 * session for the Angular `CollaborationService`.
 *
 * Extracted from `collaboration.service.ts` so the service keeps only its
 * reactive state and public API. `activateSession` wires a freshly-created
 * provider bundle into a running session and returns the {@link ActiveSession}
 * the service holds as a single atomic handle; `teardownSession` disposes it.
 */

import type { PptxHandlerSaveOptions, PptxSlide } from 'pptx-viewer-core';

import type {
	CollaborationConfig,
	CollaborationLivePatcher,
	CollaborationTransport,
	ConnectionStatus,
	DepartureChannel,
	YjsFactories,
} from '../internal/shared';
import { clearLocalAwareness, observeYDocSlides } from '../internal/shared';
import type { ConnectionWiring } from './collaboration-connection';
import { wireConnectionStatus } from './collaboration-connection';
import { DEFAULT_CURSOR_COLOR } from './collaboration-helpers';
import { LocalPresencePublisher } from './collaboration-local-presence';
import type {
	AwarenessLike,
	DestroyableYDoc,
	ProviderBundle,
	ProviderLike,
} from './collaboration-providers';
import { SlideSyncEngine } from './collaboration-slide-sync';
import type { TemplateElementsBySlideId } from './template-mode';

/** Options a host passes to `connect`, held for reconnection. */
export interface ConnectOptions {
	onRemoteSlides?: (slides: PptxSlide[]) => void;
	canvasWidth?: number;
	canvasHeight?: number;
	getSourceBytes?: () => Uint8Array | null;
	/**
	 * Returns the editor's separated template (master/layout) elements keyed by
	 * slide id, so the elected-writer write-back can merge them back into the
	 * broadcast (template-free) slides before serializing. Without this, template
	 * edits would be dropped from the persisted deck.
	 */
	getTemplateElements?: () => TemplateElementsBySlideId;
	/**
	 * Session-level save options (view properties, table styles, tags, deck
	 * properties, ...), built the same way as the Save/Export path
	 * (`buildDeckSaveOptions`). Without this the elected-writer write-back
	 * dropped every session-level edit outside `slides`.
	 */
	getSaveOptions?: () => PptxHandlerSaveOptions;
}

/** The transport objects + wiring handles of one live session, owned together. */
export interface ActiveSession {
	ydoc: DestroyableYDoc;
	provider: ProviderLike;
	awareness: AwarenessLike;
	departure: DepartureChannel;
	factories: YjsFactories;
	selfId: number;
	localPresence: LocalPresencePublisher;
	connection: ConnectionWiring;
	unobserve: () => void;
}

/** Everything `activateSession` reads from / calls back into the service. */
export interface ActivateSessionDeps {
	slideSync: SlideSyncEngine;
	livePatcher: CollaborationLivePatcher;
	onRemoteSlides: ((slides: PptxSlide[]) => void) | null;
	/** Recompute the presence signal from awareness (bound in the service). */
	refreshPresence: () => void;
	/** Schedule an owner-role write-back after a doc mutation. */
	scheduleWriteBack: () => void;
	setStatus: (status: ConnectionStatus) => void;
	getStatus: () => ConnectionStatus;
	isActive: () => boolean;
	/** Websocket connect timeout / hard failure: tear down and surface 'error'. */
	failConnection: () => void;
}

/**
 * Wire `bundle` into an active session: configure the live-patch channel, bind
 * the slide-sync engine, publish local presence, subscribe to awareness +
 * connection-status + remote-slide changes, then open the first-write gate.
 */
export function activateSession(
	bundle: ProviderBundle,
	config: CollaborationConfig,
	transport: CollaborationTransport,
	deps: ActivateSessionDeps,
): ActiveSession {
	deps.livePatcher.configure(bundle.doc, bundle.factories);
	deps.slideSync.bind({
		ydoc: bundle.doc,
		factories: bundle.factories,
		onRemoteSlides: deps.onRemoteSlides,
		scheduleWriteBack: deps.scheduleWriteBack,
	});

	const localPresence = new LocalPresencePublisher(bundle.awareness, {
		userName: config.userName,
		userColor: config.userColor ?? DEFAULT_CURSOR_COLOR,
		userAvatar: config.userAvatar,
		role: config.role,
	});
	localPresence.publish();
	bundle.awareness.on('change', deps.refreshPresence);
	bundle.awareness.on('update', deps.refreshPresence);

	deps.slideSync.gate.reset();
	const connection = wireConnectionStatus({
		provider: bundle.provider,
		transport,
		setStatus: deps.setStatus,
		getStatus: deps.getStatus,
		isActive: deps.isActive,
		reArmGate: () => {
			deps.slideSync.gate.reset();
			deps.slideSync.gate.arm();
		},
		onConnectTimeout: deps.failConnection,
	});
	deps.slideSync.wireSynced(bundle.provider);

	const unobserve = observeYDocSlides(bundle.doc, (_events, transaction) =>
		deps.slideSync.onRemoteChange(transaction),
	);

	return {
		ydoc: bundle.doc,
		provider: bundle.provider,
		awareness: bundle.awareness,
		departure: bundle.departure,
		factories: bundle.factories,
		selfId: bundle.awareness.clientID ?? -1,
		localPresence,
		connection,
		unobserve,
	};
}

/**
 * Dispose a live session. Announces the departure synchronously first: the
 * provider's own awareness removal is broadcast a microtask later and would be
 * dropped when this runs from a document being destroyed, leaving a ghost
 * collaborator until the 30s awareness timeout.
 */
export function teardownSession(session: ActiveSession, refreshPresence: () => void): void {
	session.connection.cancelConnectTimer();
	session.unobserve();
	session.awareness.off?.('change', refreshPresence);
	session.awareness.off?.('update', refreshPresence);
	session.departure.announce();
	session.departure.dispose();
	clearLocalAwareness(session.awareness);
	session.provider.disconnect();
	session.provider.destroy();
	session.ydoc.destroy();
}
