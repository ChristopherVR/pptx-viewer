import type { PptxElement, PptxHandlerSaveOptions, PptxSlide } from 'pptx-viewer-core';
import type {
	CollabLoadOrigin,
	CollaborationConfig,
	CollaborationTransport,
} from 'pptx-viewer-shared';
import { buildBroadcastViewerUrl, shouldAutoFollowBroadcaster } from 'pptx-viewer-shared';
import { computed, ref, watch } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import { useCollaboration } from './useCollaboration';
import type { UseCollaborationResult } from './useCollaboration';

export interface UseCollaborationWiringInput {
	slides: Ref<PptxSlide[]>;
	/**
	 * Bumped by the load pipeline each time a parsed deck is applied to viewer
	 * state; the session re-adopts the doc's slides on each bump so a slow local
	 * load cannot clobber remotely-synced content.
	 */
	loadVersion?: Ref<number>;
	/** Why the last content load ran; see `shouldRoomSlidesReplaceLoad`. */
	getLoadOrigin?: () => CollabLoadOrigin;
	getTemplateElements: () => Record<string, PptxElement[]>;
	/** Retain the loaded source bytes for elected-writer (role 'owner') write-back. */
	getSourceBytes: () => Uint8Array | null;
	/**
	 * Session-level save options (view properties, table styles, tags, deck
	 * properties, ...), built the same way as the Save/Export path. Without
	 * this the elected-writer write-back dropped every session-level edit
	 * outside `slides`.
	 */
	getSaveOptions: () => PptxHandlerSaveOptions;
	/** This user's initial cursor/label colour (read once, matching `useCollaboration`'s own option). */
	initialUserColor: string | undefined;
	canvasWidth: ComputedRef<number>;
	canvasHeight: ComputedRef<number>;
	/** Live `props.collaboration`, watched to auto-start/stop a session. */
	collaborationProp: () => CollaborationConfig | undefined;
	selectedElementIds: Ref<string[]>;
	activeSlideIndex: Ref<number>;
	goTo: (index: number) => void;
	effectiveZoom: ComputedRef<number>;
	/** Display name used for the presenter role when starting a broadcast. */
	authorName: () => string | undefined;
	onStartCollaboration: (config: CollaborationConfig) => void;
	onStopCollaboration: () => void;
}

export interface UseCollaborationWiringResult {
	collab: UseCollaborationResult;
	collabActive: Ref<boolean>;
	/** The config the active session was started with (null when stopped); the
	 * Share dialog's active view reads the local user's name/colour from this. */
	activeCollaboration: Ref<CollaborationConfig | null>;
	shareOpen: Ref<boolean>;
	onShareStart: (config: CollaborationConfig) => void;
	onShareStop: () => void;
	onCollabPointerMove: (event: PointerEvent) => void;
	broadcastOpen: Ref<boolean>;
	broadcastViewerUrl: ComputedRef<string>;
	onBroadcastStart: (config: {
		roomId: string;
		serverUrl: string;
		transport?: CollaborationTransport;
	}) => void;
	onBroadcastStop: () => void;
}

/**
 * useCollaborationWiring: the real-time collaboration session lifecycle
 * (Share dialog two-way collaboration, one-way Broadcast, auto-start/stop from
 * a host-supplied `collaboration` prop, and local cursor/selection/active-slide
 * publishing), layered on top of the underlying `useCollaboration` Yjs
 * composable. Extracted verbatim from `PowerPointViewer.vue`.
 */
export function useCollaborationWiring(
	input: UseCollaborationWiringInput,
): UseCollaborationWiringResult {
	const {
		slides,
		loadVersion,
		getLoadOrigin,
		getTemplateElements,
		getSourceBytes,
		getSaveOptions,
		initialUserColor,
		canvasWidth,
		canvasHeight,
		collaborationProp,
		selectedElementIds,
		activeSlideIndex,
		goTo,
		effectiveZoom,
		authorName,
		onStartCollaboration,
		onStopCollaboration,
	} = input;

	// oxlint-disable-next-line eslint/one-var -- distinct concerns, forcing one statement hurts readability
	const collab = useCollaboration({
		slides,
		loadVersion,
		getLoadOrigin,
		onRemoteSlides: (remote) => {
			// oxlint-disable-next-line react/immutability -- Vue ref write, not a React prop mutation
			slides.value = remote;
		},
		getTemplateElements,
		getSourceBytes,
		getSaveOptions,
		userColor: initialUserColor,
		canvasWidth,
		canvasHeight,
	});
	// oxlint-disable-next-line eslint/one-var -- distinct concerns, forcing one statement hurts readability
	const shareOpen = ref(false);
	// oxlint-disable-next-line eslint/one-var -- distinct concerns, forcing one statement hurts readability
	const collabActive = collab.active;

	// Auto-start/stop a session when the host supplies (or clears) a `collaboration`
	// config, so URL-driven joins connect without opening the Share dialog.
	// Dialog-initiated sessions echo the same config object back through this prop,
	// so we compare by reference to avoid restarting a session we already started.
	// oxlint-disable-next-line eslint/one-var -- distinct concerns, forcing one statement hurts readability
	const activeCollaboration = ref<CollaborationConfig | null>(null);
	watch(
		collaborationProp,
		(config) => {
			if (config && config !== activeCollaboration.value) {
				activeCollaboration.value = config;
				void collab.start(config);
			} else if (!config && collab.active.value) {
				activeCollaboration.value = null;
				collab.stop();
			}
		},
		{ immediate: true },
	);

	// Publish local selection + active slide to peers; follow a peer's active slide.
	watch(selectedElementIds, (ids) => {
		if (collab.active.value) {
			collab.setSelection(ids);
		}
	});
	watch(activeSlideIndex, (index) => {
		if (collab.active.value) {
			collab.setActiveSlide(index);
		}
	});
	watch(collab.followedSlideIndex, (index) => {
		if (index !== null) {
			goTo(index);
		}
	});
	// Viewers in a one-way broadcast auto-follow the broadcaster's active slide.
	// The role guard is the shared policy (only a local `viewer` follows the
	// `owner`), so Vue no longer yanks a `collaborator` to the owner's slide
	// while React/Angular leave it free. `broadcasterSlideIndex` is only
	// non-null when an `owner` peer exists, so the broadcaster role is `owner`.
	watch(collab.broadcasterSlideIndex, (index) => {
		if (
			index !== null &&
			collab.followedClientId.value === null &&
			shouldAutoFollowBroadcaster({ localRole: collab.activeRole.value, broadcasterRole: 'owner' })
		) {
			goTo(index);
		}
	});

	function onShareStart(config: CollaborationConfig): void {
		// Two-way collaboration: peers edit together (default role).
		const collaboratorConfig: CollaborationConfig = { role: 'collaborator', ...config };
		activeCollaboration.value = collaboratorConfig;
		void collab.start(collaboratorConfig);
		onStartCollaboration(collaboratorConfig);
		shareOpen.value = false;
	}
	function onShareStop(): void {
		activeCollaboration.value = null;
		collab.stop();
		onStopCollaboration();
		shareOpen.value = false;
	}
	/** Publish the local cursor in slide coordinates while collaborating. */
	function onCollabPointerMove(event: PointerEvent): void {
		if (!collab.active.value) {
			return;
		}
		const stage = (event.currentTarget as HTMLElement | null)?.querySelector('.pptx-vue-stage');
		if (!stage) {
			return;
		}
		// oxlint-disable-next-line eslint/one-var -- an early-return sits between this and the previous const
		const rect = stage.getBoundingClientRect();
		collab.setCursor(
			(event.clientX - rect.left) / effectiveZoom.value,
			(event.clientY - rect.top) / effectiveZoom.value,
		);
	}

	// ── Broadcast (one-way, viewer-follows-presenter) ────────────────────
	// oxlint-disable-next-line eslint/one-var -- distinct concerns, forcing one statement hurts readability
	const broadcastOpen = ref(false);
	// oxlint-disable-next-line eslint/one-var -- distinct concerns, forcing one statement hurts readability
	const broadcastConfig = ref<{
		roomId: string;
		serverUrl: string;
		transport?: CollaborationTransport;
	} | null>(null);
	// oxlint-disable-next-line eslint/one-var -- distinct concerns, forcing one statement hurts readability
	const broadcastViewerUrl = computed(() => {
		if (!broadcastConfig.value || typeof window === 'undefined') {
			return '';
		}
		const { roomId, serverUrl } = broadcastConfig.value;
		return buildBroadcastViewerUrl(roomId, serverUrl, window.location);
	});
	function onBroadcastStart(config: {
		roomId: string;
		serverUrl: string;
		transport?: CollaborationTransport;
	}): void {
		broadcastConfig.value = config;
		// One-way broadcast: the presenter owns navigation; viewers auto-follow via
		// `broadcasterSlideIndex`. The presenter joins with the `owner` role.
		const broadcastSession: CollaborationConfig = {
			...config,
			userName: authorName() ?? 'Presenter',
			role: 'owner',
		};
		activeCollaboration.value = broadcastSession;
		void collab.start(broadcastSession);
		onStartCollaboration(broadcastSession);
		broadcastOpen.value = false;
	}
	function onBroadcastStop(): void {
		activeCollaboration.value = null;
		broadcastConfig.value = null;
		collab.stop();
		onStopCollaboration();
		broadcastOpen.value = false;
	}

	return {
		collab,
		collabActive,
		activeCollaboration,
		shareOpen,
		onShareStart,
		onShareStop,
		onCollabPointerMove,
		broadcastOpen,
		broadcastViewerUrl,
		onBroadcastStart,
		onBroadcastStop,
	};
}
