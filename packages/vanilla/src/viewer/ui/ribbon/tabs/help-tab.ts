import { EMPTY_RESOLVED_CUSTOMIZATION, isDialogAvailable } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import { tagRibbonControl, wrapRibbonGroup } from '../ribbon-tagging';
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
	const group = wrapRibbonGroup(doc, 'help.help');
	el.appendChild(group);
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
	tagRibbonControl(settings.btn, 'help.help.options');
	tagRibbonControl(shortcuts.btn, 'help.help.keyboardShortcuts');
	tagRibbonControl(accessibility.btn, 'help.help.accessibility');
	// Both Settings entries open File > Options, so both go with that dialog.
	if (isDialogAvailable(handlers.getCustomization?.() ?? EMPTY_RESOLVED_CUSTOMIZATION, 'options')) {
		group.append(settings.btn, shortcuts.btn);
	}
	group.append(accessibility.btn);
	return el;
}
