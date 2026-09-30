import {
	EMPTY_RESOLVED_CUSTOMIZATION,
	HELP_RIBBON_COMMANDS,
	isDialogAvailable,
} from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import type { RibbonNavHandlers } from '../ribbon-types';

/** DOM adapter for the shared Help command catalog. */
export function createHelpTab(
	doc: Document,
	t: Translator,
	handlers: RibbonNavHandlers,
): HTMLElement {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');
	const group = doc.createElement('pptx-ui-ribbon-group');
	group.setAttribute('data-ribbon-group', 'help.help');
	group.setAttribute('label', t('pptx.ribbon.tab.help'));
	const optionsAvailable = isDialogAvailable(
		handlers.getCustomization?.() ?? EMPTY_RESOLVED_CUSTOMIZATION,
		'options',
	);
	const actions = {
		'help.help.options': () => handlers.openSettings('general'),
		'help.help.keyboardShortcuts': () => handlers.openSettings('shortcuts'),
		'help.help.accessibility': handlers.openAccessibility,
	};
	for (const command of HELP_RIBBON_COMMANDS) {
		// Both Settings entries use Options in this binding.
		if (!optionsAvailable && command.id !== 'help.help.accessibility') {
			continue;
		}
		const button = doc.createElement('pptx-ui-ribbon-command');
		button.setAttribute('data-ribbon-control', command.id);
		button.setAttribute('label', t(command.labelKey));
		button.setAttribute('icon', command.icon);
		button.setAttribute('compact', '');
		button.addEventListener('command-request', actions[command.id as keyof typeof actions]);
		group.append(button);
	}
	el.append(group);
	return el;
}
