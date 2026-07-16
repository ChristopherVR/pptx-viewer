import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import type { RibbonNavHandlers, RibbonSlideShowHandlers } from '../ribbon-types';

export function createRecordTab(
	doc: Document,
	t: Translator,
	handlers: RibbonSlideShowHandlers,
): HTMLElement {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');
	const dot = createEl(doc, 'span', 'pptxv-record-dot');
	dot.setAttribute('aria-hidden', 'true');
	const fromBeginning = makeButton(doc, {
		label: t('pptx.slideShow.fromBeginning'),
		text: t('pptx.slideShow.fromBeginning'),
		onClick: handlers.startRehearsal,
	});
	const fromCurrent = makeButton(doc, {
		label: t('pptx.slideShow.fromCurrent'),
		text: t('pptx.slideShow.fromCurrent'),
		onClick: handlers.startRehearsal,
	});
	el.append(dot, fromBeginning.btn, fromCurrent.btn);
	return el;
}

export interface ReviewTab {
	el: HTMLElement;
	setEditable(editable: boolean): void;
}

export function createReviewTab(
	doc: Document,
	t: Translator,
	handlers: RibbonNavHandlers,
): ReviewTab {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');
	const accessibility = makeButton(doc, {
		label: t('pptx.ribbon.accessibilityCheck'),
		text: t('pptx.ribbon.accessibilityCheck'),
		icon: 'sidebar',
		onClick: handlers.openAccessibility,
	});
	const headerFooter = makeButton(doc, {
		label: t('pptx.headerFooter.title'),
		text: t('pptx.headerFooter.title'),
		onClick: handlers.openHeaderFooter,
	});
	const compare = makeButton(doc, {
		label: t('pptx.ribbon.compareTitle'),
		text: t('pptx.ribbon.compare'),
		onClick: handlers.openCompare,
	});
	const comments = makeButton(doc, {
		label: t('pptx.toolbar.comments'),
		text: t('pptx.toolbar.comments'),
		onClick: handlers.openComments,
	});
	const hyperlink = makeButton(doc, {
		label: t('pptx.hyperlink.editTitle'),
		text: t('pptx.hyperlink.editTitle'),
		onClick: handlers.openHyperlink,
	});
	const spellCheck = makeButton(doc, {
		label: t('pptx.settings.spellCheck'),
		text: t('pptx.settings.spellCheck'),
		onClick: handlers.toggleSpellCheck,
	});
	const language = makeButton(doc, {
		label: t('pptx.review.language'),
		text: t('pptx.review.language'),
		onClick: () => handlers.openSettings('general'),
	});
	el.append(
		accessibility.btn,
		headerFooter.btn,
		compare.btn,
		comments.btn,
		hyperlink.btn,
		spellCheck.btn,
		language.btn,
	);
	return {
		el,
		setEditable: (editable) => compare.setDisabled(!editable),
	};
}

export function createHelpTab(
	doc: Document,
	t: Translator,
	handlers: RibbonNavHandlers,
): HTMLElement {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');
	const shortcuts = makeButton(doc, {
		label: t('pptx.settings.keyboardShortcuts'),
		text: t('pptx.settings.keyboardShortcuts'),
		onClick: () => handlers.openSettings('shortcuts'),
	});
	const accessibility = makeButton(doc, {
		label: t('pptx.ribbon.accessibilityCheck'),
		text: t('pptx.ribbon.accessibilityCheck'),
		icon: 'sidebar',
		onClick: handlers.openAccessibility,
	});
	const settings = makeButton(doc, {
		label: t('pptx.settings.title'),
		text: t('pptx.settings.title'),
		onClick: () => handlers.openSettings('general'),
	});
	el.append(settings.btn, shortcuts.btn, accessibility.btn);
	return el;
}
