import type { CollaborationConfig, CollaborationRole } from 'pptx-viewer-shared';
/**
 * Types for the `useCollaboration` composable.
 * Extracted here to keep useCollaboration.ts under the 300-line limit.
 */
import type { Ref, ComputedRef } from 'vue';

import type { RemoteCursor } from '../components/CollaborationCursors.vue';

export type { CollaborationConfig, CollaborationRole };

export interface UseCollaborationOptions {
	/** The editor's reactive slides ref (broadcast on local change). */
	slides: Ref<import('pptx-viewer-core').PptxSlide[]>;
	/** Called when a remote peer broadcasts a newer slide set. */
	onRemoteSlides: (slides: import('pptx-viewer-core').PptxSlide[]) => void;
	/** This user's cursor/label colour. */
	userColor?: string;
	/**
	 * Slide canvas width/height (unscaled px) used to clamp incoming cursor
	 * coordinates. Defaults to a generous bound when omitted.
	 */
	canvasWidth?: Ref<number> | number;
	canvasHeight?: Ref<number> | number;
	/**
	 * Return the source PPTX bytes for elected-writer write-back. Only called
	 * when role === 'owner' and config.onWriteBack is provided.
	 */
	getSourceBytes?: () => Uint8Array | null;
	/**
	 * Return the separate per-slide master/layout (template) element store so the
	 * elected-writer write-back can merge template edits back into the saved file.
	 */
	getTemplateElements?: () => Record<string, import('pptx-viewer-core').PptxElement[]>;
}

/**
 * A remote peer's full presence: identity plus the live cursor, selection and
 * active slide they have published over awareness.
 */
export interface RemotePresence {
	clientId: number;
	userName: string;
	color: string;
	cursor?: { x: number; y: number };
	selectionIds: string[];
	activeSlide: number;
	role?: CollaborationRole;
}

export interface UseCollaborationResult {
	status: Ref<import('pptx-viewer-shared').ConnectionStatus>;
	connected: Ref<boolean>;
	cursors: Ref<RemoteCursor[]>;
	remotePresences: Ref<RemotePresence[]>;
	connectedCount: ComputedRef<number>;
	active: Ref<boolean>;
	followedClientId: Ref<number | null>;
	followedSlideIndex: ComputedRef<number | null>;
	broadcasterSlideIndex: ComputedRef<number | null>;
	start: (config: CollaborationConfig) => Promise<void>;
	stop: () => void;
	retry: () => Promise<void>;
	setCursor: (x: number, y: number) => void;
	setSelection: (ids: string[]) => void;
	setActiveSlide: (index: number) => void;
	followUser: (clientId: number | null) => void;
}

// Internal structural type for the lazily-imported Yjs awareness surface.
export interface AwarenessLike {
	clientID?: number;
	setLocalStateField: (field: string, value: unknown) => void;
	getStates: () => Map<number, Record<string, unknown>>;
	on: (event: string, cb: () => void) => void;
	off?: (event: string, cb: () => void) => void;
}
