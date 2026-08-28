import type { Translator } from '../i18n';
import { createEl } from '../render';
import { createIcon } from './icons';

/**
 * PowerPoint's Protected View bar: a persistent strip below the Ribbon while
 * Trust Center > "Open documents in Protected View" is holding a freshly
 * opened deck read-only, with the one real "Enable Editing" affordance that
 * lifts it for the rest of the session. See `shouldOpenInProtectedView` and
 * `ViewerState.protectedView`.
 */
export interface ProtectedViewBanner {
	el: HTMLElement;
	setActive(active: boolean): void;
}

export function createProtectedViewBanner(
	doc: Document,
	t: Translator,
	onEnableEditing: () => void,
): ProtectedViewBanner {
	const el = createEl(doc, 'div', 'pptxv-protected-view');
	el.hidden = true;
	el.setAttribute('role', 'alert');
	el.appendChild(createIcon(doc, 'lock'));
	const text = createEl(doc, 'span', 'pptxv-protected-view-text');
	const title = createEl(doc, 'strong');
	title.textContent = t('pptx.security.protectedViewTitle');
	text.append(title, ': ', t('pptx.options.trust.protectedViewInfo'));
	const enable = createEl(doc, 'button', 'pptxv-protected-view-enable');
	enable.type = 'button';
	enable.textContent = t('pptx.security.enableEditing');
	enable.addEventListener('click', onEnableEditing);
	el.append(text, enable);

	return {
		el,
		setActive(active) {
			el.hidden = !active;
		},
	};
}
