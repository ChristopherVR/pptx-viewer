import { canUseClipboard, compatToastStackStyleAttr } from 'pptx-viewer-shared';
import type { RunProgramNotice } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import { createIcon } from './icons';

/**
 * Non-blocking toast stack shown during a running show for `ppaction://program`
 * ("Run program") action clicks (see `presentation-action-runner.ts`'s
 * `runProgram` callback). A browser cannot launch a local executable, so each
 * click appends one of these naming the exact command PowerPoint would have
 * run, with a Copy button, rather than doing nothing or blocking the show with
 * a native `confirm`/`alert`.
 *
 * Mirrors `compat-toasts.ts` (same `compatToastStackStyleAttr()` positioning,
 * same per-item structure) rather than inventing new chrome; kept as a sibling
 * module because the two notice shapes differ (severity/code vs. a resolved
 * command string) and never compete for the same screen (compat toasts are
 * load diagnostics, run-program notices only ever appear while presenting).
 */
export interface RunProgramNoticeStack {
	el: HTMLElement;
	update(notices: readonly RunProgramNotice[]): void;
}

export function createRunProgramNoticeStack(
	doc: Document,
	t: Translator,
	onDismiss: (id: string) => void,
): RunProgramNoticeStack {
	const el = createEl(doc, 'div', 'pptxv-run-program-notices');
	el.dataset.testid = 'pptx-run-program-notices';
	el.hidden = true;
	el.setAttribute('style', compatToastStackStyleAttr());
	el.setAttribute('role', 'region');
	el.setAttribute('aria-label', t('pptx.hyperlink.actionRunProgram'));

	const clipboardAvailable = canUseClipboard(
		typeof navigator === 'undefined' ? undefined : navigator,
	);

	function renderNotice(notice: RunProgramNotice): HTMLElement {
		const item = createEl(doc, 'div', 'pptxv-run-program-notice');
		item.dataset.testid = 'pptx-run-program-notice';
		item.dataset.target = notice.target;
		item.setAttribute('role', 'status');
		const message = createEl(doc, 'span', 'pptxv-run-program-notice-message');
		message.textContent = t(notice.messageKey, { target: notice.target });
		item.appendChild(message);
		if (clipboardAvailable) {
			const copy = createEl(doc, 'button', 'pptxv-run-program-notice-copy');
			copy.type = 'button';
			copy.dataset.testid = 'pptx-run-program-notice-copy';
			copy.textContent = t(notice.copyLabelKey);
			copy.addEventListener('click', () => {
				void navigator.clipboard.writeText(notice.target);
			});
			item.appendChild(copy);
		}
		const dismiss = createEl(doc, 'button', 'pptxv-run-program-notice-dismiss');
		dismiss.type = 'button';
		dismiss.dataset.testid = 'pptx-run-program-notice-dismiss';
		dismiss.setAttribute('aria-label', t('pptx.compatibility.dismiss'));
		dismiss.appendChild(createIcon(doc, 'close'));
		dismiss.addEventListener('click', () => onDismiss(notice.id));
		item.appendChild(dismiss);
		return item;
	}

	return {
		el,
		update(notices) {
			el.hidden = notices.length === 0;
			el.replaceChildren(...notices.map(renderNotice));
		},
	};
}
