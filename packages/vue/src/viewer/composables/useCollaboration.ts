/**
 * Vue session lifecycle for owned providers or a borrowed host connection.
 * Document readiness is shared across bindings; Vue watches and presence have
 * focused composables so resource ownership stays visible here.
 */
import type {
	CollaborationConfig,
	CollaborationRole,
	ConnectionStatus,
	YjsFactories,
} from 'pptx-viewer-shared';
import {
	borrowExternalCollaborationAwareness,
	CONNECTION_TIMEOUT_MS,
	createSnapshotTextPositions,
	isMixedContentBlocked,
	registerCollaborationTeardown,
	resolveTransportForServerUrl,
	resolveCollaborationShellState,
	validateRoomId,
} from 'pptx-viewer-shared';
import { computed, onScopeDispose, ref, shallowRef, toValue, watch } from 'vue';

import { createCollabProvider } from './collaboration-provider';
import type { CollabProviderHandle } from './collaboration-provider';
import type { UseCollaborationOptions, UseCollaborationResult } from './collaboration-types';
import { useCollaborationDocumentSync } from './useCollaborationDocumentSync';
import { useCollaborationPresence } from './useCollaborationPresence';

export type {
	RemotePresence,
	UseCollaborationOptions,
	UseCollaborationResult,
} from './collaboration-types';

export function useCollaboration(options: UseCollaborationOptions): UseCollaborationResult {
	const status = ref<ConnectionStatus>('disconnected');
	const connected = computed(() => status.value === 'connected');
	const active = ref(false);
	const activeCollaboration = shallowRef<CollaborationConfig | null>(null);
	const activeRole = ref<CollaborationRole | undefined>(undefined);
	const presence = useCollaborationPresence(options);
	const document = useCollaborationDocumentSync(options, status);
	const shellState = computed(() =>
		resolveCollaborationShellState({
			authorizedCanEdit: toValue(options.canEdit) ?? true,
			configured: Boolean(toValue(options.collaboration) || activeCollaboration.value),
			readOnly: document.readOnly.value,
			sourcePending: toValue(options.sourcePending) ?? false,
			sourceError: toValue(options.sourceError) ?? false,
			status: status.value,
			remoteUsers: presence.remoteUsers.value,
		}),
	);
	const connectedCount = computed(
		() => presence.remotePresences.value.length + (active.value ? 1 : 0),
	);
	let ydoc: { destroy: () => void } | null = null;
	let provider: CollabProviderHandle | null = null;
	let restoreExternalPresence: (() => void) | null = null;
	let connectTimer: ReturnType<typeof setTimeout> | null = null;
	let lastConfig: CollaborationConfig | null = null;
	let startToken = 0;

	async function start(config: CollaborationConfig): Promise<void> {
		stop();
		const token = ++startToken;
		lastConfig = config;
		activeCollaboration.value = config;
		activeRole.value = config.role;
		document.begin(config);
		const external = config.externalSession;
		try {
			validateRoomId(config.roomId);
			const transport = config.transport ?? resolveTransportForServerUrl(config.serverUrl);
			if (!external && transport === 'websocket' && isMixedContentBlocked(config.serverUrl)) {
				throw new Error('Mixed-content connection blocked');
			}
			status.value = 'connecting';
			const Y = await import('yjs');
			if (token !== startToken) {
				return;
			}
			const ownedDoc = external ? null : new Y.Doc();
			const doc = (external?.doc ?? ownedDoc!) as import('yjs').Doc;
			ydoc = ownedDoc;
			const factories: YjsFactories = {
				createMap: () => new Y.Map(),
				createArray: () => new Y.Array(),
				createText: () => new Y.Text(),
				createTextPositions: (text) =>
					createSnapshotTextPositions(text, {
						read: () => Y.snapshot(doc),
						equal: Y.equalSnapshots,
						subscribeBeforeObservers: (listener) => {
							doc.on('beforeObserverCalls', listener);
							return () => doc.off('beforeObserverCalls', listener);
						},
					}),
			};
			if (external) {
				const borrowed = borrowExternalCollaborationAwareness(external.awareness);
				restoreExternalPresence = borrowed.dispose;
				presence.start(borrowed.awareness, config);
				active.value = true;
				document.attach(doc, factories);
				return;
			}
			const created = await createCollabProvider(transport, config, ownedDoc!);
			if (token !== startToken) {
				created.destroy();
				ownedDoc!.destroy();
				return;
			}
			provider = created;
			presence.start(created.awareness, config);
			// Observe and catch up before opening the first-write gate. A provider
			// can already contain the room while its async factory is resolving.
			document.attach(doc, factories);
			created.onSynced(() => document.gate.open());
			if (created.syncedNow) {
				document.gate.open();
			} else {
				document.gate.arm();
			}
			created.onStatus((isConnected) => {
				if (isConnected) {
					if (connectTimer !== null) {
						clearTimeout(connectTimer);
					}
					connectTimer = null;
					status.value = 'connected';
				} else if (active.value) {
					status.value = 'disconnected';
					document.gate.reset();
					document.gate.arm();
				}
			});
			if (transport === 'webrtc' || created.connectedNow) {
				// Same-browser WebRTC peers meet immediately through BroadcastChannel.
				status.value = 'connected';
			} else {
				connectTimer = setTimeout(() => {
					connectTimer = null;
					if (status.value !== 'connected') {
						stop();
						status.value = 'error';
					}
				}, CONNECTION_TIMEOUT_MS);
			}
			active.value = true;
		} catch {
			if (token !== startToken) {
				return;
			}
			stop();
			status.value = 'error';
		}
	}

	function stop(): void {
		startToken++;
		document.stop();
		if (connectTimer !== null) {
			clearTimeout(connectTimer);
		}
		connectTimer = null;
		presence.stop();
		restoreExternalPresence?.();
		restoreExternalPresence = null;
		provider?.destroy();
		ydoc?.destroy();
		provider = null;
		ydoc = null;
		status.value = 'disconnected';
		active.value = false;
		activeCollaboration.value = null;
		activeRole.value = undefined;
	}
	async function retry(): Promise<void> {
		if (lastConfig) {
			await start(lastConfig);
		}
	}
	watch(
		() => toValue(options.collaboration),
		(config) => {
			if (config && config !== activeCollaboration.value) {
				void start(config);
			} else if (!config && activeCollaboration.value) {
				stop();
			}
		},
		{ immediate: true },
	);
	// A cancelled beforeunload must not detach a borrowed connection. pagehide
	// still releases our listeners/presence if the page actually goes away.
	const disposeTeardown = registerCollaborationTeardown({
		leave: stop,
		rejoin: () => void retry(),
		leaveOnBeforeUnload: () => !lastConfig?.externalSession,
	});
	onScopeDispose(() => {
		disposeTeardown();
		stop();
		document.dispose();
	});
	return {
		shellState,
		activeCollaboration,
		status,
		connected,
		active,
		activeRole,
		connectedCount,
		readOnly: document.readOnly,
		cursors: presence.cursors,
		remotePresences: presence.remotePresences,
		followedClientId: presence.followedClientId,
		followedSlideIndex: presence.followedSlideIndex,
		broadcasterSlideIndex: presence.broadcasterSlideIndex,
		setCursor: presence.setCursor,
		setSelection: presence.setSelection,
		setActiveSlide: presence.setActiveSlide,
		followUser: presence.followUser,
		start,
		stop,
		retry,
		livePatcher: document.livePatcher,
	};
}
