import { VIEWER_SHORTCUT_REFERENCE } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';

export interface ShortcutPanel {
	el: HTMLElement;
	/** Show or hide the panel; bound to "?" and to the Help ribbon entry. */
	toggle(): void;
	close(): void;
	isOpen(): boolean;
}

/**
 * The keyboard-shortcut cheat sheet.
 *
 * Every other binding shipped one; the vanilla binding was the only viewer with
 * no way to discover its own keymap. Rows come from the shared
 * {@link VIEWER_SHORTCUT_REFERENCE}, so the list cannot claim a binding the
 * shared keymap does not actually resolve.
 *
 * It carries `data-pptx-shortcuts-panel`, the neutral hook the cross-binding
 * e2e suite locates it by.
 */
export function createShortcutPanel(doc: Document, t: Translator): ShortcutPanel {
	const el = createEl(doc, 'section', 'pptxv-shortcuts-panel');
	el.hidden = true;
	el.dataset.pptxShortcutsPanel = 'true';
	el.setAttribute('role', 'dialog');
	el.setAttribute('aria-modal', 'false');
	el.setAttribute('aria-label', t('pptx.shortcuts.title'));

	const header = createEl(doc, 'div', 'pptxv-shortcuts-header');
	const title = createEl(doc, 'h2', 'pptxv-shortcuts-title');
	title.textContent = t('pptx.shortcuts.title');
	const closeButton = createEl(doc, 'button', 'pptxv-shortcuts-close') as HTMLButtonElement;
	closeButton.type = 'button';
	closeButton.textContent = t('pptx.shortcuts.close');
	closeButton.setAttribute('aria-label', t('pptx.common.close'));
	header.append(title, closeButton);

	const list = createEl(doc, 'div', 'pptxv-shortcuts-list');
	for (const item of VIEWER_SHORTCUT_REFERENCE) {
		const row = createEl(doc, 'div', 'pptxv-shortcuts-row');
		const action = createEl(doc, 'span', 'pptxv-shortcuts-action');
		action.textContent = t(item.actionKey);
		const keys = createEl(doc, 'kbd', 'pptxv-shortcuts-keys');
		keys.textContent = item.shortcut;
		row.append(action, keys);
		list.appendChild(row);
	}
	el.append(header, list);

	const close = (): void => {
		el.hidden = true;
	};
	closeButton.addEventListener('click', close);

	return {
		el,
		toggle() {
			el.hidden = !el.hidden;
		},
		close,
		isOpen: () => !el.hidden,
	};
}
