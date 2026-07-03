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

import { computed, inject, Injectable, signal } from '@angular/core';

import type { BroadcastConfig } from './broadcast-helpers';
import { buildBroadcastViewerUrl } from './broadcast-helpers';
import { CollaborationService } from './collaboration.service';
import { buildShareUrl } from './share-helpers';
import type { TemplateElementsBySlideId } from './template-mode';
import type { CollaborationConfig } from './types';

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
	readonly emitStart: (config: CollaborationConfig) => void;
	readonly emitStop: () => void;
}

@Injectable()
export class ViewerCollaborationSessionService {
	private readonly collab = inject(CollaborationService);

	/** Share (collaboration) dialog visibility. */
	readonly showShare = signal(false);
	/** Broadcast dialog visibility. */
	readonly showBroadcast = signal(false);
	/**
	 * Room/server of the currently active session, used to build the shareable
	 * join/follow links shown in the dialogs. Null when no session is active.
	 */
	private readonly activeSession = signal<{ roomId: string; serverUrl: string } | null>(null);

	private host: CollaborationSessionHost | null = null;

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
		const session = this.activeSession();
		return session ? buildShareUrl(session.roomId, session.serverUrl, this.browserLocation()) : '';
	});

	/** Shareable follow link for the active broadcast. */
	readonly broadcastViewerUrl = computed<string>(() => {
		const session = this.activeSession();
		return session
			? buildBroadcastViewerUrl(session.roomId, session.serverUrl, this.browserLocation())
			: '';
	});

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
		if (config) {
			this.activeSession.set({ roomId: config.roomId, serverUrl: config.serverUrl });
			void this.collab.connect(config, {
				getTemplateElements: () => this.requireHost().getTemplateElements(),
			});
		} else {
			this.collab.disconnect();
			this.activeSession.set(null);
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
		this.activeSession.set({
			roomId: collaboratorConfig.roomId,
			serverUrl: collaboratorConfig.serverUrl,
		});
		void this.collab.connect(collaboratorConfig, {
			getTemplateElements: () => host.getTemplateElements(),
		});
		host.emitStart(collaboratorConfig);
	}

	onShareStop(): void {
		this.collab.disconnect();
		this.activeSession.set(null);
		this.requireHost().emitStop();
	}

	/** Start broadcasting (presenter as session owner) from the broadcast config. */
	onBroadcastStart(config: BroadcastConfig): void {
		const host = this.requireHost();
		const collabConfig: CollaborationConfig = {
			roomId: config.roomId,
			serverUrl: config.serverUrl,
			userName: host.authorName() ?? 'Presenter',
			role: 'owner',
		};
		this.activeSession.set({ roomId: config.roomId, serverUrl: config.serverUrl });
		void this.collab.connect(collabConfig, {
			getTemplateElements: () => host.getTemplateElements(),
		});
		host.emitStart(collabConfig);
	}

	onBroadcastStop(): void {
		this.collab.disconnect();
		this.activeSession.set(null);
		this.requireHost().emitStop();
	}
}
