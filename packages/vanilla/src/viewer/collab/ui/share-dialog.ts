import type { CollaborationConfig } from 'pptx-viewer-shared';
import { resolveTransportForServerUrl } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import type { ShareDefaults, ShareFormFields } from '../share-helpers';
import { buildShareConfig, canStartShare, seedShareFields } from '../share-helpers';
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

	const modal: ModalDialog = createModalDialog(doc, t, {
		title: t('pptx.toolbar.share'),
		onClose: () => modal.setOpen(false),
	});
	doc.body.appendChild(modal.el);

	const form = createEl(doc, 'div', 'pptxv-modal-section');
	const desc = createEl(doc, 'p', 'pptxv-modal-desc');
	desc.textContent = t('pptx.share.formDescription');
	form.appendChild(desc);

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
		const config = buildShareConfig(fields);
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
		startBtn.disabled = !canStartShare(fields);
		p2pHint.hidden = resolveTransportForServerUrl(fields.serverUrl) !== 'webrtc';
		p2pActiveHint.hidden = resolveTransportForServerUrl(fields.serverUrl) !== 'webrtc';
		roomField.input.value = fields.roomId;
		nameField.input.value = fields.userName;
		serverField.input.value = fields.serverUrl;
	}
	refresh();

	return {
		el: modal.el,
		open(defaults, isActive) {
			active = isActive;
			if (!active) {
				fields = seedShareFields(defaults);
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
