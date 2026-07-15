import type { ConnectionStatus } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';

/**
 * collaboration-status.ts: a small status pill (colour dot + text + Retry
 * link on error) showing the collaboration connection state and connected
 * participant count. Vanilla port of the Vue `CollaborationStatusIndicator.vue`.
 * Mounted alongside the autosave status pill in the toolbar's editing cluster.
 */

export interface CollaborationStatus {
	el: HTMLElement;
	/** `connectedCount` includes the local user (matches the Vue contract). */
	update(status: ConnectionStatus, connectedCount: number): void;
	destroy(): void;
}

const STATUS_LABEL_KEYS: Record<ConnectionStatus, string> = {
	connected: 'pptx.collaboration.status.connected',
	connecting: 'pptx.collaboration.status.connecting',
	disconnected: 'pptx.collaboration.status.disconnected',
	error: 'pptx.collaboration.status.error',
};

export function createCollaborationStatus(
	doc: Document,
	t: Translator,
	onRetry: () => void,
): CollaborationStatus {
	const el = createEl(doc, 'span', 'pptxv-collab-status');
	el.hidden = true;
	el.setAttribute('role', 'status');
	el.setAttribute('data-testid', 'collaboration-status');

	const dot = createEl(doc, 'span', 'pptxv-collab-status-dot');
	el.appendChild(dot);
	const text = createEl(doc, 'span', 'pptxv-collab-status-text');
	el.appendChild(text);
	const retry = createEl(doc, 'button', 'pptxv-collab-status-retry');
	retry.type = 'button';
	retry.textContent = t('pptx.collaboration.retry');
	retry.hidden = true;
	retry.addEventListener('click', onRetry);
	el.appendChild(retry);

	return {
		el,
		update(status, connectedCount) {
			el.hidden = status === 'disconnected';
			dot.className = `pptxv-collab-status-dot is-${status}`;
			text.textContent =
				status === 'connected'
					? connectedCount === 1
						? t('pptx.collaboration.onePersonHere')
						: t('pptx.collaboration.peopleHere', { count: connectedCount })
					: t(STATUS_LABEL_KEYS[status]);
			retry.hidden = status !== 'error';
			el.setAttribute(
				'aria-label',
				t('pptx.collaboration.statusAriaLabel', {
					status: t(STATUS_LABEL_KEYS[status]),
					count: connectedCount,
				}),
			);
		},
		destroy() {
			el.remove();
		},
	};
}
