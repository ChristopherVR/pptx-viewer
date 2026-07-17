import type { CollaborationConfig, ConnectionStatus, ToolbarActionId } from 'pptx-viewer-shared';
import { buildBroadcastViewerUrl, isActionHidden } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import type { Store, ViewerState } from '../state';
import type { ViewerChrome } from '../ui';
import { createIcon } from '../ui';
import type { BroadcastConfig } from './broadcast-helpers';
import { buildBroadcastSessionConfig } from './broadcast-helpers';
import type { ShareDefaults } from './share-helpers';
import { createBroadcastDialog } from './ui/broadcast-dialog';
import { createCollaborationCursors } from './ui/collaboration-cursors';
import { createCollaborationStatus } from './ui/collaboration-status';
import { createFollowModeBar } from './ui/follow-mode-bar';
import { createShareDialog } from './ui/share-dialog';

/**
 * collab-ui.ts: owns the Share/Broadcast dialogs, the toolbar status pill +
 * trigger buttons, the remote-cursor overlay, and the follow-mode bar; wires
 * them all to the store and the session controllers' collaboration
 * functions. Vanilla port of the Vue `useCollaborationWiring` composable plus
 * its four presentational components, mounted imperatively. Constructed by
 * `session-controllers.ts` (the integration point that already owns the
 * collaboration controller this delegates to).
 */

export interface CollabUiDeps {
	doc: Document;
	store: Store<ViewerState>;
	getChrome: () => ViewerChrome;
	getTranslator: () => Translator;
	getScale: () => number;
	startCollaboration: (config: CollaborationConfig) => Promise<void>;
	stopCollaboration: () => void;
	getStatus: () => ConnectionStatus;
	getConfig: () => CollaborationConfig | null;
	followUser: (clientId: number | null) => void;
	shareDefaults?: ShareDefaults;
	/** Individually hidden toolbar buttons; gates the Share/Broadcast triggers this module builds. */
	hiddenActions?: readonly ToolbarActionId[];
}

export interface CollabUiController {
	/** Reflect a connection-status transition (dialogs + status pill). */
	onStatusChange(status: ConnectionStatus): void;
	/** Open the existing collaboration sharing dialog from another chrome surface. */
	openShare(): void;
	/** Open the existing broadcast dialog from another chrome surface. */
	openBroadcast(): void;
	destroy(): void;
}

export function createCollabUi(deps: CollabUiDeps): CollabUiController {
	const { doc } = deps;
	const t = deps.getTranslator();
	const chrome = deps.getChrome();

	let broadcastRoomId = '';
	let broadcastServerUrl = '';

	function viewerUrl(): string {
		if (!broadcastRoomId) {
			return '';
		}
		const location = doc.defaultView?.location;
		return buildBroadcastViewerUrl(
			broadcastRoomId,
			broadcastServerUrl,
			location ? { origin: location.origin, pathname: location.pathname } : undefined,
		);
	}

	const shareDialog = createShareDialog(doc, t, {
		onStart: (config) =>
			void deps.startCollaboration(config).then(() => shareDialog.setActive(true)),
		onStop: () => {
			deps.stopCollaboration();
			shareDialog.setActive(false);
			shareDialog.close();
		},
	});

	const broadcastDialog = createBroadcastDialog(doc, t, {
		onStart: (config: BroadcastConfig) => {
			broadcastRoomId = config.roomId;
			broadcastServerUrl = config.serverUrl;
			const session = buildBroadcastSessionConfig(config, deps.shareDefaults?.userName);
			void deps
				.startCollaboration(session)
				.then(() => broadcastDialog.setActive(true, viewerUrl()));
		},
		onStop: () => {
			deps.stopCollaboration();
			broadcastRoomId = '';
			broadcastServerUrl = '';
			broadcastDialog.setActive(false, '');
			broadcastDialog.close();
		},
	});

	const statusPill = createCollaborationStatus(doc, t, () => {
		const config = deps.getConfig();
		if (config) {
			void deps.startCollaboration(config);
		}
	});

	let shareBtn: HTMLButtonElement | null = null;
	let mobileShareBtn: HTMLButtonElement | null = null;
	let broadcastBtn: HTMLButtonElement | null = null;
	const openShare = (): void => {
		shareDialog.open(deps.shareDefaults, deps.getStatus() !== 'disconnected');
	};
	const openBroadcast = (): void => {
		broadcastDialog.open(
			{ roomId: broadcastRoomId, serverUrl: broadcastServerUrl },
			deps.getStatus() !== 'disconnected',
			viewerUrl(),
		);
	};
	// Share lives on the ribbon tab row's right side (React's `TabRowActions`
	// orange Share button); Broadcast + the status pill stay on the quick-access
	// primary row. When no tab row exists (toolbar-less chrome, tests) both fall
	// back to the primary row. Hidden per the host's `hiddenActions` option
	// ('share' / 'broadcast'), each button is only constructed (not merely
	// hidden) when its action is visible.
	const showShare = !isActionHidden('share', deps.hiddenActions);
	const showBroadcast = !isActionHidden('broadcast', deps.hiddenActions);
	const toolbarEl = chrome.ribbon?.el.querySelector<HTMLElement>('.pptxv-ribbon-primary') ?? null;
	const tabRowActionsEl =
		chrome.ribbon?.el.querySelector<HTMLElement>('.pptxv-tabrow-actions') ?? null;
	if (toolbarEl) {
		if (showShare) {
			shareBtn = createEl(doc, 'button', tabRowActionsEl ? 'pptxv-tabrow-share' : 'pptxv-btn');
			shareBtn.type = 'button';
			shareBtn.title = t('pptx.toolbar.share');
			shareBtn.setAttribute('aria-label', t('pptx.toolbar.share'));
			shareBtn.appendChild(createIcon(doc, 'share'));
			if (tabRowActionsEl) {
				const label = createEl(doc, 'span');
				label.textContent = t('pptx.toolbar.share');
				shareBtn.appendChild(label);
			}
			shareBtn.addEventListener('click', openShare);
			(tabRowActionsEl ?? toolbarEl).appendChild(shareBtn);
		}
		if (showBroadcast) {
			broadcastBtn = createEl(doc, 'button', 'pptxv-btn');
			broadcastBtn.type = 'button';
			broadcastBtn.title = t('pptx.broadcast.startTitle');
			broadcastBtn.setAttribute('aria-label', t('pptx.broadcast.startTitle'));
			broadcastBtn.appendChild(createIcon(doc, 'broadcast'));
			broadcastBtn.addEventListener('click', openBroadcast);
			toolbarEl.appendChild(broadcastBtn);
		}
		toolbarEl.appendChild(statusPill.el);
	}
	const mobileCollaborationHost = chrome.mobileToolbar?.collaborationHost ?? null;
	if (mobileCollaborationHost && showShare) {
		mobileShareBtn = createEl(doc, 'button', 'pptxv-mobile-toolbar-btn pptxv-mobile-share');
		mobileShareBtn.type = 'button';
		mobileShareBtn.title = t('pptx.toolbar.share');
		mobileShareBtn.setAttribute('aria-label', t('pptx.toolbar.share'));
		mobileShareBtn.appendChild(createIcon(doc, 'share'));
		mobileShareBtn.addEventListener('click', openShare);
		mobileCollaborationHost.appendChild(mobileShareBtn);
	}

	const cursors = createCollaborationCursors(doc);
	const followBar = createFollowModeBar(doc, t, {
		onFollow: (clientId) => deps.followUser(clientId),
	});

	function mountOverlay(): void {
		const host = deps.getChrome().stageWrap;
		if (cursors.el.parentElement !== host) {
			host.appendChild(cursors.el);
		}
		if (followBar.el.parentElement !== host) {
			host.appendChild(followBar.el);
		}
	}

	function connectedCount(state: ViewerState): number {
		return deps.getStatus() === 'disconnected' ? 0 : state.remotePresences.length + 1;
	}

	function render(state: ViewerState): void {
		mountOverlay();
		cursors.update(state.cursors, deps.getScale());
		followBar.update(state.remotePresences, state.followedClientId);
		statusPill.update(deps.getStatus(), connectedCount(state));
	}
	render(deps.store.get());

	const unsubscribe = deps.store.subscribe((state, previous) => {
		if (
			state.cursors !== previous.cursors ||
			state.remotePresences !== previous.remotePresences ||
			state.followedClientId !== previous.followedClientId
		) {
			render(state);
		}
	});

	return {
		onStatusChange(status) {
			render(deps.store.get());
			if (status === 'disconnected') {
				shareDialog.setActive(false);
				broadcastDialog.setActive(false, '');
			}
		},
		openShare,
		openBroadcast,
		destroy() {
			unsubscribe();
			shareBtn?.remove();
			mobileShareBtn?.remove();
			broadcastBtn?.remove();
			statusPill.destroy();
			cursors.destroy();
			followBar.destroy();
			shareDialog.destroy();
			broadcastDialog.destroy();
		},
	};
}
