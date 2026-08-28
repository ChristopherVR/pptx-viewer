/* oxlint-disable eslint/one-var -- pre-existing throughout this file; independent concerns, not one statement */
import type { CollaborationConfig, ConnectionStatus, SanitizedPresence } from 'pptx-viewer-shared';
import {
	buildActiveSessionUsers,
	buildCollaborationShareUrl,
	resolveTransportForServerUrl,
} from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import type { ShareDefaults, ShareFormFields } from '../share-helpers';
import {
	buildJoinConfig,
	buildShareConfig,
	canJoinShare,
	canStartShare,
	seedShareFields,
} from '../share-helpers';
import { createCopyField, createTextField } from './dialog-fields';
import type { ModalDialog } from './modal-dialog';
import { createModalDialog } from './modal-dialog';

/**
 * share-dialog.ts: start/stop a two-way real-time collaboration session.
 * Vanilla port of the Vue `ShareDialog.vue` (see
 * `useCollaborationWiring.onShareStart` for the `role: 'collaborator'` config
 * assembly this mirrors, done in `../share-helpers.ts`). Built on
 * {@link createModalDialog}.
 */

export interface ShareDialogHandlers {
	/** Fired with the assembled config when the user starts sharing. */
	onStart(config: CollaborationConfig): void;
	/** Fired when the user stops an active session. */
	onStop(): void;
}

/** Live session state for the active-session view (status/count/connected users). */
export interface ShareDialogSession {
	status: ConnectionStatus;
	/** Includes the local user (matches the toolbar status pill's contract). */
	connectedCount: number;
	/** The config the active session was started with; null while stopped. */
	config: CollaborationConfig | null;
	remoteUsers: readonly SanitizedPresence[];
}

export interface ShareDialog {
	el: HTMLElement;
	/** Open the dialog, seeding the form from `defaults` when not active. */
	open(defaults: ShareDefaults | undefined, active: boolean): void;
	close(): void;
	/** Reflect the live session state while the dialog may be open. */
	setActive(active: boolean): void;
	/** Reflect status/participant-count/connected-user changes while active. */
	updateSession(session: ShareDialogSession): void;
	destroy(): void;
}

export function createShareDialog(
	doc: Document,
	t: Translator,
	handlers: ShareDialogHandlers,
	themeHost?: () => HTMLElement | null,
	/** Options > General > "Initials" override for the local-user avatar. */
	getUserInitials?: () => string | undefined,
): ShareDialog {
	let fields: ShareFormFields = seedShareFields();
	let active = false;
	let mode: 'create' | 'join' = 'create';
	let invitation = '';
	let session: ShareDialogSession = {
		status: 'disconnected',
		connectedCount: 0,
		config: null,
		remoteUsers: [],
	};
	let copied = false;
	let copiedTimer: ReturnType<typeof setTimeout> | undefined;

	const modal: ModalDialog = createModalDialog(doc, t, {
		title: t('pptx.toolbar.share'),
		onClose: () => modal.setOpen(false),
		themeHost,
	});
	doc.body.appendChild(modal.el);

	const form = createEl(doc, 'div', 'pptxv-modal-section');
	const desc = createEl(doc, 'p', 'pptxv-modal-desc');
	desc.textContent = t('pptx.share.formDescription');
	const tabs = createEl(doc, 'div', 'pptxv-share-tabs');
	tabs.setAttribute('role', 'tablist');
	const createTab = createEl(doc, 'button');
	createTab.type = 'button';
	createTab.textContent = t('pptx.share.createSession');
	const joinTab = createEl(doc, 'button');
	joinTab.type = 'button';
	joinTab.textContent = t('pptx.share.joinSession');
	tabs.append(createTab, joinTab);
	form.append(tabs, desc);

	const invitationField = createTextField(
		doc,
		t('pptx.share.invitationLabel'),
		t('pptx.share.invitationPlaceholder'),
		(value) => {
			invitation = value;
			refresh();
		},
	);
	form.appendChild(invitationField.el);

	const roomField = createTextField(
		doc,
		t('pptx.share.roomId'),
		t('pptx.share.roomIdPlaceholder'),
		(value) => {
			fields = { ...fields, roomId: value };
			refresh();
		},
	);
	form.appendChild(roomField.el);

	const nameField = createTextField(
		doc,
		t('pptx.share.yourName'),
		t('pptx.share.yourNamePlaceholder'),
		(value) => {
			fields = { ...fields, userName: value };
			refresh();
		},
	);
	form.appendChild(nameField.el);

	const serverField = createTextField(
		doc,
		t('pptx.share.serverUrl'),
		t('pptx.share.serverPlaceholder'),
		(value) => {
			fields = { ...fields, serverUrl: value };
			refresh();
		},
	);
	const p2pHint = createEl(doc, 'p', 'pptxv-modal-hint');
	p2pHint.textContent = t('pptx.share.p2pHint');
	serverField.el.appendChild(p2pHint);
	form.appendChild(serverField.el);

	const activeView = createEl(doc, 'div', 'pptxv-modal-section');

	// Status row: connection dot + raw status word + participant count.
	const statusRow = createEl(doc, 'div', 'pptxv-share-status-row');
	const statusDot = createEl(doc, 'span', 'pptxv-collab-status-dot');
	statusRow.appendChild(statusDot);
	const statusText = createEl(doc, 'span', 'pptxv-share-status-text');
	statusRow.appendChild(statusText);
	const statusCount = createEl(doc, 'span', 'pptxv-share-count');
	statusRow.appendChild(statusCount);
	activeView.appendChild(statusRow);

	// Share URL: copyable link + hint.
	const shareLinkField = createCopyField(doc, t, t('pptx.share.shareLink'), () => {
		if (!shareLinkField.input.value) {
			return;
		}
		void doc.defaultView?.navigator.clipboard.writeText(shareLinkField.input.value).then(() => {
			copied = true;
			shareLinkField.setCopied(true);
			clearTimeout(copiedTimer);
			copiedTimer = setTimeout(() => {
				copied = false;
				shareLinkField.setCopied(false);
			}, 2000);
			return undefined;
		});
	});
	activeView.appendChild(shareLinkField.el);
	const shareHint = createEl(doc, 'p', 'pptxv-modal-hint');
	shareHint.textContent = t('pptx.share.shareHint');
	activeView.appendChild(shareHint);

	// Session details: room id + server (or the p2p placeholder value).
	const sessionDetails = createEl(doc, 'div', 'pptxv-share-details');
	const roomDetail = createEl(doc, 'span');
	sessionDetails.appendChild(roomDetail);
	const serverDetail = createEl(doc, 'span');
	sessionDetails.appendChild(serverDetail);
	activeView.appendChild(sessionDetails);
	const p2pActiveHint = createEl(doc, 'p', 'pptxv-modal-hint');
	p2pActiveHint.textContent = t('pptx.share.p2pServerValue');
	activeView.appendChild(p2pActiveHint);

	// Connected users: local user first, then remote peers with their slide.
	const usersField = createEl(doc, 'div', 'pptxv-modal-field');
	const usersLabel = createEl(doc, 'label', 'pptxv-modal-label');
	usersLabel.textContent = t('pptx.share.connectedUsers');
	usersField.appendChild(usersLabel);
	const usersList = createEl(doc, 'div', 'pptxv-share-users-list');
	usersField.appendChild(usersList);
	activeView.appendChild(usersField);

	const stopBtn = createEl(doc, 'button', 'pptxv-modal-danger-btn');
	stopBtn.type = 'button';
	stopBtn.textContent = t('pptx.share.stopSharing');
	stopBtn.addEventListener('click', () => handlers.onStop());
	activeView.appendChild(stopBtn);

	modal.bodyEl.append(form, activeView);

	const cancelBtn = createEl(doc, 'button', 'pptxv-modal-btn');
	cancelBtn.type = 'button';
	cancelBtn.addEventListener('click', () => modal.setOpen(false));
	modal.footerEl.appendChild(cancelBtn);

	const startBtn = createEl(doc, 'button', 'pptxv-modal-btn pptxv-modal-btn-primary');
	startBtn.type = 'button';
	startBtn.textContent = t('pptx.share.startSharing');
	startBtn.addEventListener('click', () => {
		const config =
			mode === 'join'
				? buildJoinConfig({ invitation, userName: fields.userName, serverUrl: fields.serverUrl })
				: buildShareConfig(fields);
		if (config) {
			handlers.onStart(config);
		}
	});
	modal.footerEl.appendChild(startBtn);

	/** Paint the active-session view from the current `session` snapshot. */
	function renderSession(): void {
		const config = session.config;
		const isP2P = resolveTransportForServerUrl(config?.serverUrl ?? '') === 'webrtc';

		statusDot.className = `pptxv-collab-status-dot is-${session.status}`;
		statusText.textContent = session.status;
		statusCount.textContent = t('pptx.collaboration.userCount', { count: session.connectedCount });

		const shareUrl = config
			? buildCollaborationShareUrl(
					config,
					doc.defaultView
						? {
								origin: doc.defaultView.location.origin,
								pathname: doc.defaultView.location.pathname,
							}
						: undefined,
				)
			: '';
		shareLinkField.el.hidden = !shareUrl;
		shareHint.hidden = !shareUrl;
		shareLinkField.setValue(shareUrl);
		shareLinkField.setCopied(copied);

		sessionDetails.hidden = !config;
		if (config) {
			roomDetail.replaceChildren(
				`${t('pptx.share.room')} `,
				Object.assign(doc.createElement('code'), { textContent: config.roomId }),
			);
			serverDetail.replaceChildren(
				`${t('pptx.share.server')} `,
				Object.assign(doc.createElement('code'), {
					textContent: isP2P ? t('pptx.share.p2pServerValue') : config.serverUrl,
				}),
			);
		}
		p2pActiveHint.hidden = Boolean(config) || !isP2P;

		const users = config
			? buildActiveSessionUsers({
					localUserName: config.userName,
					localUserInitials: getUserInitials?.(),
					localUserColor: config.userColor,
					remoteUsers: session.remoteUsers,
				})
			: [];
		usersField.hidden = users.length === 0;
		usersList.replaceChildren(
			...users.map((user) => {
				const row = createEl(doc, 'div', 'pptxv-share-user');
				const avatar = createEl(doc, 'span', 'pptxv-share-user-avatar');
				avatar.style.backgroundColor = user.color;
				if (user.avatarUrl) {
					const img = doc.createElement('img');
					img.src = user.avatarUrl;
					img.alt = '';
					avatar.appendChild(img);
				} else {
					avatar.textContent = user.initials;
				}
				row.appendChild(avatar);
				const name = createEl(doc, 'span', 'pptxv-share-user-name');
				name.textContent = user.name;
				row.appendChild(name);
				const tag = createEl(doc, 'span', 'pptxv-share-user-tag');
				tag.textContent = user.isLocal
					? t('pptx.share.you')
					: t('pptx.notes.slideN', { n: user.slideNumber ?? 1 });
				row.appendChild(tag);
				return row;
			}),
		);
	}

	function refresh(): void {
		modal.setTitle(active ? t('pptx.share.collaborationActive') : t('pptx.toolbar.share'));
		form.hidden = active;
		activeView.hidden = !active;
		startBtn.hidden = active;
		cancelBtn.textContent = active ? t('pptx.share.close') : t('pptx.share.cancel');
		createTab.setAttribute('aria-selected', String(mode === 'create'));
		joinTab.setAttribute('aria-selected', String(mode === 'join'));
		desc.textContent = t(
			mode === 'join' ? 'pptx.share.joinDescription' : 'pptx.share.formDescription',
		);
		invitationField.el.hidden = mode !== 'join';
		roomField.el.hidden = mode === 'join';
		startBtn.textContent = t(
			mode === 'join' ? 'pptx.share.joinSession' : 'pptx.share.startSharing',
		);
		startBtn.disabled =
			mode === 'join'
				? !canJoinShare({ invitation, userName: fields.userName, serverUrl: fields.serverUrl })
				: !canStartShare(fields);
		p2pHint.hidden = resolveTransportForServerUrl(fields.serverUrl) !== 'webrtc';
		roomField.input.value = fields.roomId;
		nameField.input.value = fields.userName;
		serverField.input.value = fields.serverUrl;
		invitationField.input.value = invitation;
		renderSession();
	}
	createTab.addEventListener('click', () => {
		mode = 'create';
		refresh();
	});
	joinTab.addEventListener('click', () => {
		mode = 'join';
		refresh();
	});
	refresh();

	return {
		el: modal.el,
		open(defaults, isActive) {
			active = isActive;
			if (!active) {
				fields = seedShareFields(defaults);
				invitation = '';
			}
			refresh();
			modal.setOpen(true);
		},
		close() {
			modal.setOpen(false);
		},
		setActive(isActive) {
			active = isActive;
			refresh();
		},
		updateSession(nextSession) {
			session = nextSession;
			renderSession();
		},
		destroy() {
			clearTimeout(copiedTimer);
			modal.destroy();
		},
	};
}
