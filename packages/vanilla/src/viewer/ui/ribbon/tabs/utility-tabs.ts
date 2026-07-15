import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import type { RibbonNavHandlers } from '../ribbon-types';

export function createRecordTab(doc: Document, t: Translator): HTMLElement {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');
	const dot = createEl(doc, 'span', 'pptxv-record-dot');
	dot.setAttribute('aria-hidden', 'true');
	const label = createEl(doc, 'span');
	label.textContent = t('pptx.titleBar.record');
	el.append(dot, label);
	return el;
}

export function createReviewTab(
	doc: Document,
	t: Translator,
	handlers: RibbonNavHandlers,
): HTMLElement {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');
	const accessibility = makeButton(doc, {
		label: t('pptx.ribbon.accessibilityCheck'),
		text: t('pptx.ribbon.accessibilityCheck'),
		icon: 'sidebar',
		onClick: handlers.openAccessibility,
	});
	el.append(accessibility.btn);
	return el;
}

export function createHelpTab(
	doc: Document,
	t: Translator,
	handlers: RibbonNavHandlers,
): HTMLElement {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');
	const shortcutList = createEl(doc, 'div', 'pptxv-shortcut-help');
	shortcutList.hidden = true;
	shortcutList.textContent =
		'Ctrl+Z Undo | Ctrl+Y Redo | Ctrl+C Copy | Ctrl+V Paste | Delete Remove';
	const shortcuts = makeButton(doc, {
		label: t('pptx.settings.keyboardShortcuts'),
		text: t('pptx.settings.keyboardShortcuts'),
		onClick: () => {
			shortcutList.hidden = !shortcutList.hidden;
		},
	});
	const accessibility = makeButton(doc, {
		label: t('pptx.ribbon.accessibilityCheck'),
		text: t('pptx.ribbon.accessibilityCheck'),
		icon: 'sidebar',
		onClick: handlers.openAccessibility,
	});
	el.append(shortcuts.btn, accessibility.btn, shortcutList);
	return el;
}
