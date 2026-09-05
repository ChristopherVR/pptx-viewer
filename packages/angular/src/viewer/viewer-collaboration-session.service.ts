/**
 * viewer-collaboration-session.service.ts: Viewer-scoped state + logic for the
 * Share (two-way collaboration) and Broadcast (one-way owner) sessions. Owns the
 * two dialog visibility flags and the active-session room/server, derives the
 * shareable join / follow links, and drives connect / disconnect on the
 * {@link CollaborationService}.
 *
 * Extracted from {@link PowerPointViewerComponent}: the component binds the host
 * inputs it cannot reach from a service (author name, share defaults, the
 * template-element snapshot supplier) plus the start/stop output emitters via
 * {@link bind}; the template reads the flags / links / defaults and invokes the
 * handlers off the injected instance.
 *
 * Provide it once on the viewer component
 * (`providers: [ViewerCollaborationSessionService]`).
 */

/* oxlint-disable eslint/one-var -- pre-existing throughout this file; independent concerns, not one statement */
import { computed, inject, Injectable, signal } from '@angular/core';
import type { PptxHandlerSaveOptions, PptxSlide } from 'pptx-viewer-core';

import type { ActiveSessionUserDescriptor } from '../internal/shared';
import { buildActiveSessionUsers } from '../internal/shared';
import type { BroadcastConfig } from './broadcast-helpers';
import { buildBroadcastViewerUrl } from './broadcast-helpers';
import { CollaborationService } from './collaboration.service';
import type { ConnectOptions } from './collaboration.service';
import { buildShareUrl } from './share-helpers';
import type { TemplateElementsBySlideId } from './template-mode';
import type { CollaborationConfig } from './types';
import { ViewerOptionsService } from './viewer-options.service';

/** Seed values for the Share dialog's start form. */
interface ShareDefaults {
	roomId?: string;
	userName?: string;
	serverUrl?: string;
}

/** Host accessors/emitters a service cannot own (inputs + outputs). */
interface CollaborationSessionHost {
	readonly authorName: () => string | undefined;
	readonly shareDefaults: () => ShareDefaults | undefined;
	readonly getTemplateElements: () => TemplateElementsBySlideId;
	/** Apply a remote peer's slide set to the editable deck (echo-guarded in the service). */
	readonly applyRemoteSlides: (slides: PptxSlide[]) => void;
	/** Current slide-canvas size (presence bounds). */
	readonly canvasSize: () => { width: number; height: number };
	/** The loaded source `.pptx` bytes for elected-writer write-back, if any. */
	readonly getSourceBytes: () => Uint8Array | null;
	/**
	 * Session-level save options (view properties, table styles, tags, deck
	 * properties, ...), built the same way as the Save/Export path. Without
	 * this the elected-writer write-back dropped every session-level edit
	 * outside `slides`.
	 */
	readonly getSaveOptions: () => PptxHandlerSaveOptions;
	/** The current editable deck (seeds the sync baseline after connecting). */
	readonly currentSlides: () => readonly PptxSlide[];
	readonly emitStart: (config: CollaborationConfig) => void;
	readonly emitStop: () => void;
}

@Injectable()
export class ViewerCollaborationSessionService {
	private readonly collab = inject(CollaborationService);
	private readonly viewerOpts = inject(ViewerOptionsService, { optional: true });

	/** Share (collaboration) dialog visibility. */
	readonly showShare = signal(false);
	/** Broadcast dialog visibility. */
	readonly showBroadcast = signal(false);
	/**
	 * The config the currently active session was started/joined with, used to
	 * build the shareable join/follow links and the Share dialog's local-user
	 * identity + connected-users list. Null when no session is active.
	 */
	readonly activeCollaboration = signal<CollaborationConfig | null>(null);

	private host: CollaborationSessionHost | null = null;

	/**
	 * Last host `collaboration` config handled by {@link syncHostConfig}
	 * (reference-equal dedup). A re-invocation with the same object (e.g. a
	 * spurious effect re-run) must not reconnect: a second provider join on the
	 * same room throws inside Yjs and tears down the live session. Cleared on
	 * the explicit stop paths so stop + restart with the same object works.
	 */
	private lastSyncedConfig: CollaborationConfig | undefined;

	/** Wire the host inputs/outputs (called once from the component constructor). */
	bind(host: CollaborationSessionHost): void {
		this.host = host;
	}

	private requireHost(): CollaborationSessionHost {
		if (!this.host) {
			throw new Error('ViewerCollaborationSessionService.bind() was not called');
		}
		return this.host;
	}

	/** Browser location used to assemble share/follow URLs (omitted in SSR). */
	private browserLocation(): { origin: string; pathname: string } | undefined {
		return typeof window === 'undefined'
			? undefined
			: { origin: window.location.origin, pathname: window.location.pathname };
	}

	/** Shareable join link for the active collaboration session. */
	readonly shareUrl = computed<string>(() => {
		const session = this.activeCollaboration();
		return session ? buildShareUrl(session.roomId, session.serverUrl, this.browserLocation()) : '';
	});

	/** Shareable follow link for the active broadcast. */
	readonly broadcastViewerUrl = computed<string>(() => {
		const session = this.activeCollaboration();
		return session
			? buildBroadcastViewerUrl(session.roomId, session.serverUrl, this.browserLocation())
			: '';
	});

	/** Whether the active session is serverless (peer-to-peer / webrtc). */
	readonly activeSessionP2p = computed<boolean>(
		() => (this.activeCollaboration()?.serverUrl ?? '').trim().length === 0 && this.collab.active(),
	);

	/** Connected-users list (local user + remote presence) for the Share dialog. */
	readonly users = computed<ActiveSessionUserDescriptor[]>(() => {
		const config = this.activeCollaboration();
		if (!config) {
			return [];
		}
		return buildActiveSessionUsers({
			localUserName: config.userName,
			localUserInitials: this.viewerOpts?.options().general.userInitials,
			localUserColor: config.userColor,
			remoteUsers: this.collab.presence(),
		});
	});

	/**
	 * Assemble the {@link ConnectOptions} shared by every connect call site: apply
	 * remote slides to the editor, size the presence bounds to the canvas, and
	 * expose the source bytes + separated template elements for write-back.
	 */
	private connectOptions(): ConnectOptions {
		const host = this.requireHost();
		const size = host.canvasSize();
		return {
			onRemoteSlides: (slides) => host.applyRemoteSlides(slides),
			canvasWidth: size.width,
			canvasHeight: size.height,
			getSourceBytes: () => host.getSourceBytes(),
			getTemplateElements: () => host.getTemplateElements(),
			getSaveOptions: () => host.getSaveOptions(),
		};
	}

	/**
	 * Connect and immediately seed the sync baseline with the current deck, so a
	 * joiner whose deck is still a placeholder never broadcasts (and overwrites)
	 * the shared document before the first remote sync arrives.
	 */
	private connectWithBaseline(config: CollaborationConfig): void {
		void this.collab.connect(config, this.connectOptions());
		this.collab.seedBaseline(this.requireHost().currentSlides());
	}

	/**
	 * Seed values for the Share dialog: the host-supplied `shareDefaults`, with
	 * `userName` falling back to `authorName` (then "You") so the local user's
	 * name pre-fills the form. Mirrors React/Vue.
	 */
	readonly shareDialogDefaults = computed<ShareDefaults>(() => {
		const host = this.host;
		const defaults = host?.shareDefaults() ?? {};
		return {
			...defaults,
			userName: defaults.userName ?? host?.authorName() ?? 'You',
		};
	});

	/**
	 * Connect / disconnect real-time collaboration when the host `collaboration`
	 * input changes (called from the component's effect).
	 */
	syncHostConfig(config: CollaborationConfig | undefined): void {
		if (config === this.lastSyncedConfig) {
			return;
		}
		this.lastSyncedConfig = config;
		if (config) {
			this.activeCollaboration.set(config);
			this.connectWithBaseline(config);
		} else {
			this.collab.disconnect();
			this.activeCollaboration.set(null);
		}
	}

	/** Start a real-time collaboration session from the share dialog config. */
	onShareStart(config: CollaborationConfig): void {
		const host = this.requireHost();
		// Two-way collaboration: peers edit together (default `collaborator` role).
		const collaboratorConfig: CollaborationConfig = {
			role: 'collaborator',
			...config,
			userName: config.userName || (host.authorName() ?? 'You'),
		};
		this.activeCollaboration.set(collaboratorConfig);
		this.connectWithBaseline(collaboratorConfig);
		host.emitStart(collaboratorConfig);
	}

	onShareStop(): void {
		this.lastSyncedConfig = undefined;
		this.collab.disconnect();
		this.activeCollaboration.set(null);
		this.requireHost().emitStop();
	}

	/** Start broadcasting (presenter as session owner) from the broadcast config. */
	onBroadcastStart(config: BroadcastConfig): void {
		const host = this.requireHost();
		const collabConfig: CollaborationConfig = {
			roomId: config.roomId,
			serverUrl: config.serverUrl,
			transport: config.transport,
			userName: host.authorName() ?? 'Presenter',
			role: 'owner',
		};
		this.activeCollaboration.set(collabConfig);
		this.connectWithBaseline(collabConfig);
		host.emitStart(collabConfig);
	}

	onBroadcastStop(): void {
		this.lastSyncedConfig = undefined;
		this.collab.disconnect();
		this.activeCollaboration.set(null);
		this.requireHost().emitStop();
	}
}
