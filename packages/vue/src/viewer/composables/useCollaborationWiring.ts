import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import type { CollaborationConfig, CollaborationTransport } from 'pptx-viewer-shared';
import { buildBroadcastViewerUrl } from 'pptx-viewer-shared';
import { computed, ref, watch } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import { useCollaboration } from './useCollaboration';
import type { UseCollaborationResult } from './useCollaboration';

export interface UseCollaborationWiringInput {
	slides: Ref<PptxSlide[]>;
	getTemplateElements: () => Record<string, PptxElement[]>;
	/** Retain the loaded source bytes for elected-writer (role 'owner') write-back. */
	getSourceBytes: () => Uint8Array | null;
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
		getTemplateElements,
		getSourceBytes,
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

	const collab = useCollaboration({
		slides,
		onRemoteSlides: (remote) => {
			slides.value = remote;
		},
		getTemplateElements,
		getSourceBytes,
		userColor: initialUserColor,
		canvasWidth,
		canvasHeight,
	});
	const shareOpen = ref(false);
	const collabActive = collab.active;

	// Auto-start/stop a session when the host supplies (or clears) a `collaboration`
	// config, so URL-driven joins connect without opening the Share dialog.
	// Dialog-initiated sessions echo the same config object back through this prop,
	// so we compare by reference to avoid restarting a session we already started.
	let lastStartedCollab: CollaborationConfig | null = null;
	watch(
		collaborationProp,
		(config) => {
			if (config && config !== lastStartedCollab) {
				lastStartedCollab = config;
				void collab.start(config);
			} else if (!config && collab.active.value) {
				lastStartedCollab = null;
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
	watch(collab.broadcasterSlideIndex, (index) => {
		if (index !== null && collab.followedClientId.value === null) {
			goTo(index);
		}
	});

	function onShareStart(config: CollaborationConfig): void {
		// Two-way collaboration: peers edit together (default role).
		const collaboratorConfig: CollaborationConfig = { role: 'collaborator', ...config };
		lastStartedCollab = collaboratorConfig;
		void collab.start(collaboratorConfig);
		onStartCollaboration(collaboratorConfig);
		shareOpen.value = false;
	}
	function onShareStop(): void {
		lastStartedCollab = null;
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
		const rect = stage.getBoundingClientRect();
		collab.setCursor(
			(event.clientX - rect.left) / effectiveZoom.value,
			(event.clientY - rect.top) / effectiveZoom.value,
		);
	}

	// ── Broadcast (one-way, viewer-follows-presenter) ────────────────────
	const broadcastOpen = ref(false);
	const broadcastConfig = ref<{
		roomId: string;
		serverUrl: string;
		transport?: CollaborationTransport;
	} | null>(null);
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
		lastStartedCollab = broadcastSession;
		void collab.start(broadcastSession);
		onStartCollaboration(broadcastSession);
		broadcastOpen.value = false;
	}
	function onBroadcastStop(): void {
		lastStartedCollab = null;
		broadcastConfig.value = null;
		collab.stop();
		onStopCollaboration();
		broadcastOpen.value = false;
	}

	return {
		collab,
		collabActive,
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
