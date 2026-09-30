import {
	buildReviewRibbon,
	EMPTY_RESOLVED_CUSTOMIZATION,
	isDialogAvailable,
} from 'pptx-viewer-shared';
import type { RibbonCommandRequestEvent } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import type { RibbonNavHandlers } from '../ribbon-types';

export interface ReviewTab {
	el: HTMLElement;
	setEditable(editable: boolean): void;
	setSpellCheck(enabled: boolean): void;
}

/** Shared commands emit intents; the binding retains native panels and editor settings. */
export function createReviewTab(
	doc: Document,
	t: Translator,
	handlers: RibbonNavHandlers,
): ReviewTab {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');
	const section = doc.createElement('pptx-ui-ribbon-section');
	el.append(section);
	let editable = false;
	let spellCheck = false;
	const refresh = () => {
		section.groups = buildReviewRibbon(t, {
			editable,
			spellCheck,
			canAccessibility: true,
			canLanguage: true,
			canCompare: true,
			canComments: true,
			languageHidden: !isDialogAvailable(
				handlers.getCustomization?.() ?? EMPTY_RESOLVED_CUSTOMIZATION,
				'options',
			),
		});
	};
	section.addEventListener('command-request', (event) => {
		switch ((event as RibbonCommandRequestEvent).detail.id) {
			case 'review.proofing.spelling':
				handlers.toggleSpellCheck();
				break;
			case 'review.accessibility.check':
				handlers.openAccessibility();
				break;
			case 'review.language.language':
				handlers.openSettings('general');
				break;
			case 'review.compare.compare':
				if (editable) {
					handlers.openCompare();
				}
				break;
			case 'review.comments.newComment':
			case 'review.comments.showComments':
				handlers.openComments();
				break;
		}
	});
	refresh();
	return {
		el,
		setEditable(value) {
			editable = value;
			refresh();
		},
		setSpellCheck(value) {
			spellCheck = value;
			refresh();
		},
	};
}
