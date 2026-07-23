/**
 * Public contract for the vanilla collaboration controller, split out of
 * `collaboration-controller.ts` so that file (the factory + session lifecycle)
 * stays within the repo's 300 LOC ceiling. Types only, no runtime code.
 */

import type { PptxHandler } from 'pptx-viewer-core';
import type {
	CollaborationConfig,
	CollaborationLivePatcher,
	ConnectionStatus,
} from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';

export interface CollaborationControllerDeps {
	store: Store<ViewerState>;
	/** Live core handler (owner-role write-back re-serializes through it). */
	getHandler: () => PptxHandler | null;
	/** Enforce the read-only `viewer` role by disabling editing. */
	setEditable: (editable: boolean) => void;
	/** Notified on every connection-status transition. */
	onStatusChange?: (status: ConnectionStatus) => void;
}

export interface CollaborationController {
	/** Connect and begin syncing. Stops any prior session first. */
	start(config: CollaborationConfig): Promise<void>;
	/** Disconnect and tear the session down. */
	stop(): void;
	/** Whether a session is currently active. */
	isActive(): boolean;
	/** Current connection status. */
	getStatus(): ConnectionStatus;
	/** Publish a cursor move (slide-space px); no-op when no session is active. */
	setCursor(x: number, y: number, activeSlideIndex?: number): void;
	/** Publish the local selection; no-op when no session is active. */
	setSelection(selectedElementId: string | undefined, activeSlideIndex?: number): void;
	/** Publish the local active-slide index (drives peer follow-along). */
	setActiveSlide(index: number): void;
	/** Follow the given peer's active slide, or `null` to stop following. */
	followUser(clientId: number | null): void;
	/** The last config used to start a session (persists after `stop()`, for retry). */
	getConfig(): CollaborationConfig | null;
	/**
	 * The load pipeline is about to commit a parsed deck to the store: suppress
	 * local->doc slide publishing until {@link notifyContentLoaded} runs, so a
	 * late joiner's bootstrap deck is never written into the room's doc before
	 * the adoption check.
	 */
	beginContentLoad(): void;
	/**
	 * A content load finished applying to viewer state. When the shared doc
	 * already holds slides (the room content arrived while the load was still
	 * parsing), adopt them over the just-loaded deck; when the doc is empty this
	 * client is the seeder and the deferred publish of the loaded deck runs.
	 */
	notifyContentLoaded(): void;
	/**
	 * Interim ("live preview") Y.Doc write channel: publishes in-flight inline
	 * editor text that has not reached the store yet, so peers see typing as it
	 * happens instead of on commit. Dormant outside a session.
	 */
	readonly livePatcher: CollaborationLivePatcher;
	/** Stop and release everything (viewer destroy). */
	destroy(): void;
}
