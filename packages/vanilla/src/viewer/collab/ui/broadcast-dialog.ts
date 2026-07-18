import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import type { BroadcastConfig, BroadcastDefaults } from '../broadcast-helpers';
import {
	buildBroadcastConfig,
	canStartBroadcast,
	canUseClipboard,
	resolveTransportForServerUrl,
	seedBroadcastFields,
} from '../broadcast-helpers';
import { createCopyField, createTextField } from './dialog-fields';
import type { ModalDialog } from './modal-dialog';
import { createModalDialog } from './modal-dialog';

/**
 * broadcast-dialog.ts: start/stop a one-way live broadcast (the presenter
 * drives slide navigation; viewers follow via a shareable link). Vanilla port
 * of the Vue `BroadcastDialog.vue`. Built on {@link createModalDialog}; pure
 * validation/link logic lives in `../broadcast-helpers.ts`.
 */

export interface BroadcastDialogHandlers {
	onStart(config: BroadcastConfig): void;
	onStop(): void;
}

export interface BroadcastDialog {
	el: HTMLElement;
	/** Open the dialog, seeding the form from `defaults` when not active. */
	open(defaults: BroadcastDefaults | undefined, active: boolean, viewerUrl: string): void;
	close(): void;
	/** Reflect the live session state (and current viewer link) while open. */
	setActive(active: boolean, viewerUrl: string): void;
	destroy(): void;
}

const COPY_RESET_MS = 2000;

export function createBroadcastDialog(
	doc: Document,
	t: Translator,
	handlers: BroadcastDialogHandlers,
	themeHost?: () => HTMLElement | null,
): BroadcastDialog {
	let fields: BroadcastConfig = seedBroadcastFields();
	let active = false;
	let copyResetTimer: ReturnType<typeof setTimeout> | null = null;

	const modal: ModalDialog = createModalDialog(doc, t, {
		title: t('pptx.broadcast.startTitle'),
		onClose: () => modal.setOpen(false),
		themeHost,
	});
	doc.body.appendChild(modal.el);

	const idleView = createEl(doc, 'div', 'pptxv-modal-section');
	const idleDesc = createEl(doc, 'p', 'pptxv-modal-desc');
	idleDesc.textContent = t('pptx.broadcast.idleDesc');
	idleView.appendChild(idleDesc);

	const roomField = createTextField(
		doc,
		t('pptx.broadcast.roomId'),
		t('pptx.broadcast.roomIdPlaceholder'),
		(value) => {
			fields = { ...fields, roomId: value };
			refresh();
		},
	);
	idleView.appendChild(roomField.el);

	const serverField = createTextField(
		doc,
		t('pptx.broadcast.serverUrl'),
		t('pptx.broadcast.serverUrlPlaceholder'),
		(value) => {
			fields = { ...fields, serverUrl: value };
			refresh();
		},
	);
	const p2pIdleHint = createEl(doc, 'p', 'pptxv-modal-hint');
	p2pIdleHint.textContent = t('pptx.broadcast.p2pHint');
	serverField.el.appendChild(p2pIdleHint);
	idleView.appendChild(serverField.el);

	const activeView = createEl(doc, 'div', 'pptxv-modal-section');
	const activeDesc = createEl(doc, 'p', 'pptxv-modal-desc');
	activeDesc.textContent = t('pptx.broadcast.liveDesc');
	activeView.appendChild(activeDesc);
	const linkField = createCopyField(doc, t, t('pptx.broadcast.viewerLink'), () => void copyLink());
	activeView.appendChild(linkField.el);
	const linkHint = createEl(doc, 'p', 'pptxv-modal-hint');
	linkHint.textContent = t('pptx.broadcast.viewerHint');
	activeView.appendChild(linkHint);
	const p2pActiveHint = createEl(doc, 'p', 'pptxv-modal-hint');
	p2pActiveHint.textContent = t('pptx.broadcast.p2pServerValue');
	activeView.appendChild(p2pActiveHint);
	const stopBtn = createEl(doc, 'button', 'pptxv-modal-danger-btn');
	stopBtn.type = 'button';
	stopBtn.textContent = t('pptx.broadcast.stopBroadcast');
	stopBtn.addEventListener('click', () => handlers.onStop());
	activeView.appendChild(stopBtn);

	modal.bodyEl.append(idleView, activeView);

	const closeBtn = createEl(doc, 'button', 'pptxv-modal-btn');
	closeBtn.type = 'button';
	closeBtn.textContent = t('pptx.common.close');
	closeBtn.addEventListener('click', () => modal.setOpen(false));
	modal.footerEl.appendChild(closeBtn);

	const startBtn = createEl(doc, 'button', 'pptxv-modal-btn pptxv-modal-btn-primary');
	startBtn.type = 'button';
	startBtn.textContent = t('pptx.broadcast.startBroadcast');
	startBtn.addEventListener('click', () => {
		const config = buildBroadcastConfig(fields);
		if (config) {
			handlers.onStart(config);
		}
	});
	modal.footerEl.appendChild(startBtn);

	async function copyLink(): Promise<void> {
		if (!canUseClipboard(typeof navigator === 'undefined' ? undefined : navigator)) {
			return;
		}
		await navigator.clipboard.writeText(linkField.input.value);
		linkField.setCopied(true);
		if (copyResetTimer !== null) {
			clearTimeout(copyResetTimer);
		}
		copyResetTimer = setTimeout(() => linkField.setCopied(false), COPY_RESET_MS);
	}

	function refresh(): void {
		modal.setTitle(active ? t('pptx.broadcast.broadcastingTitle') : t('pptx.broadcast.startTitle'));
		idleView.hidden = active;
		activeView.hidden = !active;
		startBtn.hidden = active;
		startBtn.disabled = !canStartBroadcast(fields);
		p2pIdleHint.hidden = resolveTransportForServerUrl(fields.serverUrl) !== 'webrtc';
		roomField.input.value = fields.roomId;
		serverField.input.value = fields.serverUrl;
	}
	refresh();

	return {
		el: modal.el,
		open(defaults, isActive, viewerUrl) {
			active = isActive;
			if (!active) {
				fields = seedBroadcastFields(defaults);
			}
			linkField.setValue(viewerUrl);
			linkField.setCopied(false);
			refresh();
			modal.setOpen(true);
		},
		close() {
			modal.setOpen(false);
		},
		setActive(isActive, viewerUrl) {
			active = isActive;
			linkField.setValue(viewerUrl);
			refresh();
		},
		destroy() {
			if (copyResetTimer !== null) {
				clearTimeout(copyResetTimer);
			}
			modal.destroy();
		},
	};
}
