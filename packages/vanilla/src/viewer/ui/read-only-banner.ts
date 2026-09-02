import type { ReadOnlyRecommendation } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import { createIcon } from './icons';

/**
 * The `p:modifyVerifier` / "Mark as Final" read-only recommendation banner:
 * a strip below the ribbon telling the user WHY the deck opened locked and
 * offering "Edit anyway" (lifts the lock, hides the banner) or a plain close
 * (hides the banner, keeps the lock). See `readOnlyRecommendation` in
 * `pptx-viewer-shared` and `ViewerState.readOnlyRecommendation`.
 */
export interface ReadOnlyBanner {
	el: HTMLElement;
	update(recommendation: ReadOnlyRecommendation | null, dismissed: boolean): void;
}

export function createReadOnlyBanner(
	doc: Document,
	t: Translator,
	onEditAnyway: () => void,
	onDismiss: () => void,
): ReadOnlyBanner {
	const el = createEl(doc, 'div', 'pptxv-readonly-banner');
	el.dataset.testid = 'pptx-readonly-banner';
	el.hidden = true;
	el.setAttribute('role', 'alert');
	el.appendChild(createIcon(doc, 'lock'));
	const text = createEl(doc, 'span', 'pptxv-readonly-banner-text');
	const editAnyway = createEl(doc, 'button', 'pptxv-readonly-banner-edit');
	editAnyway.type = 'button';
	editAnyway.dataset.testid = 'pptx-readonly-edit-anyway';
	editAnyway.textContent = t('pptx.readOnly.editAnyway');
	editAnyway.addEventListener('click', onEditAnyway);
	const dismiss = createEl(doc, 'button', 'pptxv-readonly-banner-dismiss');
	dismiss.type = 'button';
	dismiss.dataset.testid = 'pptx-readonly-dismiss';
	dismiss.setAttribute('aria-label', t('pptx.readOnly.dismiss'));
	dismiss.appendChild(createIcon(doc, 'close'));
	dismiss.addEventListener('click', onDismiss);
	el.append(text, editAnyway, dismiss);

	return {
		el,
		update(recommendation, dismissed) {
			const visible = recommendation !== null && !dismissed;
			el.hidden = !visible;
			if (!visible || !recommendation) {
				return;
			}
			el.dataset.kind = recommendation.kind ?? '';
			text.textContent = t(recommendation.messageKey);
		},
	};
}
