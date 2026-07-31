import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import type { RibbonNavHandlers } from '../ribbon-types';

/**
 * The Help ribbon tab: viewer settings, keyboard shortcuts and the
 * accessibility checker, the three commands React's `HelpSection` offers.
 */
export function createHelpTab(
	doc: Document,
	t: Translator,
	handlers: RibbonNavHandlers,
): HTMLElement {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');
	const settings = makeButton(doc, {
		label: t('pptx.settings.title'),
		text: t('pptx.settings.title'),
		onClick: () => handlers.openSettings('general'),
	});
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
	el.append(settings.btn, shortcuts.btn, accessibility.btn);
	return el;
}
