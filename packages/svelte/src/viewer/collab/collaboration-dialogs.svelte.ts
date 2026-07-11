/**
 * collaboration-dialogs.svelte.ts: reactive open/closed state and start/stop
 * handlers for the Share and Broadcast dialogs, factored out of
 * `PowerPointViewer.svelte` to keep that file within the repo's file-size
 * budget. Both dialogs drive the same `CollaborationController` the
 * `collaboration` prop auto-starts.
 *
 * A broadcast is a one-way session: the presenter joins with `role: 'owner'`.
 * `BroadcastConfig` (unlike `CollaborationConfig`) has no `userName`, so the
 * presenter's display name is supplied separately (falling back to
 * "Presenter"), and the viewer follow-link is built from the broadcast's own
 * `roomId`/`serverUrl` rather than the (possibly unrelated) `collaboration`
 * prop.
 */
import type { BroadcastConfig, CollaborationConfig } from 'pptx-viewer-shared';
import { buildBroadcastViewerUrl } from 'pptx-viewer-shared';

import type { CollaborationController } from './collaboration.svelte';

/** Prefilled values for the Share dialog's form (Broadcast reuses `serverUrl`). */
export interface ShareDefaultsInput {
	roomId?: string;
	userName?: string;
	serverUrl?: string;
}

export class CollaborationDialogsState {
	shareOpen = $state(false);
	broadcastOpen = $state(false);
	#broadcastConfig = $state<BroadcastConfig | null>(null);
	/** The last config started via either dialog, used as a `retry()` fallback. */
	#lastDialogConfig: CollaborationConfig | null = null;

	readonly #collab: CollaborationController;
	readonly #getShareDefaults: () => ShareDefaultsInput | undefined;

	constructor(
		collab: CollaborationController,
		getShareDefaults: () => ShareDefaultsInput | undefined,
	) {
		this.#collab = collab;
		this.#getShareDefaults = getShareDefaults;
	}

	/** Number of connected participants (including the local user), when active. */
	get connectedCount(): number {
		return this.#collab.remotePresences.length + (this.#collab.active ? 1 : 0);
	}

	/** The shareable follow link for the current (or last) broadcast, once known. */
	get broadcastViewerUrl(): string | undefined {
		if (!this.#broadcastConfig || typeof window === 'undefined') {
			return undefined;
		}
		return buildBroadcastViewerUrl(
			this.#broadcastConfig.roomId,
			this.#broadcastConfig.serverUrl,
			window.location,
		);
	}

	openShare(): void {
		this.shareOpen = true;
	}

	openBroadcast(): void {
		this.broadcastOpen = true;
	}

	readonly onShareStart = (config: CollaborationConfig): void => {
		const full: CollaborationConfig = { role: 'collaborator', ...config };
		this.#lastDialogConfig = full;
		void this.#collab.start(full);
		this.shareOpen = false;
	};

	readonly onShareStop = (): void => {
		this.#collab.stop();
		this.shareOpen = false;
	};

	readonly onBroadcastStart = (config: BroadcastConfig): void => {
		this.#broadcastConfig = config;
		const full: CollaborationConfig = {
			...config,
			userName: this.#getShareDefaults()?.userName ?? 'Presenter',
			role: 'owner',
		};
		this.#lastDialogConfig = full;
		void this.#collab.start(full);
		this.broadcastOpen = false;
	};

	readonly onBroadcastStop = (): void => {
		this.#broadcastConfig = null;
		this.#collab.stop();
		this.broadcastOpen = false;
	};

	/**
	 * Retry the active session after a connection error: prefers the host's
	 * live `collaboration` prop, falling back to whatever config either dialog
	 * last started (since a dialog-started session has no corresponding prop).
	 */
	retry(propConfig: CollaborationConfig | undefined): void {
		const config = propConfig ?? this.#lastDialogConfig;
		if (config) {
			void this.#collab.start(config);
		}
	}
}
