import { RECORD_COMMAND_GROUPS } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import type { RibbonSlideShowHandlers } from '../ribbon-types';

/** Keep Vanilla's existing rehearsal workflow behind the shared Record view. */
export function createRecordTab(
	doc: Document,
	t: Translator,
	handlers: RibbonSlideShowHandlers,
): HTMLElement {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');
	for (const descriptor of RECORD_COMMAND_GROUPS) {
		const group = doc.createElement('pptx-ui-ribbon-group');
		group.setAttribute('label', t(descriptor.labelKey));
		group.setAttribute('data-ribbon-group', descriptor.id);
		for (const command of descriptor.commands) {
			const control = doc.createElement('pptx-ui-ribbon-command');
			control.setAttribute('label', t(command.labelKey));
			control.setAttribute('icon', command.icon);
			control.setAttribute('data-ribbon-control', command.id);
			control.setAttribute('compact', '');
			if (command.unsupported) {
				control.setAttribute('disabled', '');
			} else {
				control.addEventListener('command-request', handlers.startRehearsal);
			}
			group.append(control);
		}
		el.append(group);
	}
	return el;
}
