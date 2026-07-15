import type { CollaborationConfig } from 'pptx-viewer-shared';
import { resolveTransportForServerUrl } from 'pptx-viewer-shared';

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
import { createTextField } from './dialog-fields';
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

export interface ShareDialog {
	el: HTMLElement;
	/** Open the dialog, seeding the form from `defaults` when not active. */
	open(defaults: ShareDefaults | undefined, active: boolean): void;
	close(): void;
	/** Reflect the live session state while the dialog may be open. */
	setActive(active: boolean): void;
	destroy(): void;
}

export function createShareDialog(
	doc: Document,
	t: Translator,
	handlers: ShareDialogHandlers,
): ShareDialog {
	let fields: ShareFormFields = seedShareFields();
	let active = false;
	let mode: 'create' | 'join' = 'create';
	let invitation = '';

	const modal: ModalDialog = createModalDialog(doc, t, {
		title: t('pptx.toolbar.share'),
		onClose: () => modal.setOpen(false),
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
	const activeDesc = createEl(doc, 'p', 'pptxv-modal-desc');
	activeDesc.textContent = t('pptx.share.activeDescription');
	activeView.appendChild(activeDesc);
	const p2pActiveHint = createEl(doc, 'p', 'pptxv-modal-hint');
	p2pActiveHint.textContent = t('pptx.share.p2pServerValue');
	activeView.appendChild(p2pActiveHint);
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
		p2pActiveHint.hidden = resolveTransportForServerUrl(fields.serverUrl) !== 'webrtc';
		roomField.input.value = fields.roomId;
		nameField.input.value = fields.userName;
		serverField.input.value = fields.serverUrl;
		invitationField.input.value = invitation;
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
		destroy() {
			modal.destroy();
		},
	};
}
