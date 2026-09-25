import type { RibbonControlId } from 'pptx-viewer-shared';
import { EMPTY_RESOLVED_CUSTOMIZATION, isDialogAvailable } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import { tagRibbonControl, wrapRibbonGroup } from '../ribbon-tagging';
import type { RibbonNavHandlers } from '../ribbon-types';

export interface ReviewTab {
	el: HTMLElement;
	setEditable(editable: boolean): void;
}

/**
 * The Review ribbon tab: Proofing, Accessibility, Language, Changes, Comments
 * and Protect, matching React's `ReviewSection`.
 *
 * The comment navigation (Delete / Previous / Next) and the Protect group have
 * no implementation in any binding and ship disabled, the same placeholders
 * React renders. Header & Footer moved to the Insert tab (where React puts it)
 * and the hyperlink editor is reached from the element context menu, so
 * neither is duplicated here.
 */
export function createReviewTab(
	doc: Document,
	t: Translator,
	handlers: RibbonNavHandlers,
): ReviewTab {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');

	const command = (key: string, onClick: () => void): HTMLButtonElement =>
		makeButton(doc, { label: t(key), text: t(key), onClick }).btn;
	const placeholder = (key: string): HTMLButtonElement => {
		const button = makeButton(doc, { label: t(key), text: t(key), onClick: () => {} });
		button.setDisabled(true);
		return button.btn;
	};

	const spelling = command('pptx.review.spelling', handlers.toggleSpellCheck);
	spelling.title = t('pptx.review.toggleSpellCheck');
	const accessibility = makeButton(doc, {
		label: t('pptx.review.accessibilityCheck'),
		text: t('pptx.review.accessibilityCheck'),
		icon: 'sidebar',
		onClick: handlers.openAccessibility,
	});
	accessibility.btn.title = t('pptx.review.accessibilityCheckTooltip');
	const language = command('pptx.review.language', () => handlers.openSettings('general'));
	language.title = t('pptx.review.languageTooltip');

	const compare = makeButton(doc, {
		label: t('pptx.ribbon.compare'),
		text: t('pptx.ribbon.compare'),
		onClick: handlers.openCompare,
	});
	compare.btn.title = t('pptx.ribbon.compareTitle');
	const comments = command('pptx.toolbar.comments', handlers.openComments);
	comments.title = t('pptx.review.toggleComments');
	const showComments = command('pptx.review.showComments', handlers.openComments);

	const ph = (key: string, id: RibbonControlId): HTMLButtonElement =>
		tagRibbonControl(placeholder(key), id);
	el.append(
		wrapRibbonGroup(
			doc,
			'review.proofing',
			tagRibbonControl(spelling, 'review.proofing.spelling'),
			ph('pptx.review.thesaurus', 'review.proofing.thesaurus'),
		),
		wrapRibbonGroup(
			doc,
			'review.accessibility',
			tagRibbonControl(accessibility.btn, 'review.accessibility.check'),
		),
		wrapRibbonGroup(
			doc,
			'review.language',
			ph('pptx.review.translate', 'review.language.translate'),
			language,
		),
		wrapRibbonGroup(
			doc,
			'review.compare',
			ph('pptx.review.markAllRead', 'review.compare.markAllRead'),
			tagRibbonControl(compare.btn, 'review.compare.compare'),
		),
		wrapRibbonGroup(
			doc,
			'review.comments',
			tagRibbonControl(comments, 'review.comments.newComment'),
			ph('pptx.common.delete', 'review.comments.delete'),
			ph('pptx.common.previous', 'review.comments.previous'),
			ph('pptx.common.next', 'review.comments.next'),
			tagRibbonControl(showComments, 'review.comments.showComments'),
		),
		wrapRibbonGroup(
			doc,
			'review.protect',
			ph('pptx.review.readOnly', 'review.protect.readOnly'),
			ph('pptx.review.restrictPermission', 'review.protect.restrictPermission'),
		),
		wrapRibbonGroup(doc, 'review.ink', ph('pptx.review.hideInk', 'review.ink.hideInk')),
	);
	// Language opens File > Options, so it goes with that dialog.
	if (
		!isDialogAvailable(handlers.getCustomization?.() ?? EMPTY_RESOLVED_CUSTOMIZATION, 'options')
	) {
		language.remove();
	}

	return {
		el,
		setEditable: (editable) => compare.setDisabled(!editable),
	};
}
