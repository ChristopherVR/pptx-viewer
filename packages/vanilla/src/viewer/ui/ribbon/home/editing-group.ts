import { editingHomeControls, registerPptxWebControls } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { tagRibbonGroup } from '../ribbon-tagging';
import { createSharedHomeStrip } from './shared-strip';

export interface EditingGroupHandlers {
	toggleFindReplace(): void;
	selectAll(): void;
}

export interface EditingGroup {
	el: HTMLElement;
	update(state: { editable: boolean }): void;
}

/**
 * The ribbon Home tab's Editing group: the shared strip renders Find, Replace
 * and the Select menu (a trigger named after the pointer tool with a "Select
 * All" row); this binding keeps the find panel and the selection itself.
 */
export function createEditingGroup(
	doc: Document,
	t: Translator,
	handlers: EditingGroupHandlers,
): EditingGroup {
	registerPptxWebControls();
	const el = createEl(doc, 'div', 'pptxv-rgroup');
	el.dataset.pptxChrome = 'home-group';
	tagRibbonGroup(el, 'home.editing');
	const row = createEl(doc, 'div', 'pptxv-rgroup-row');
	row.dataset.pptxChrome = 'editing-controls';
	const label = createEl(doc, 'span', 'pptxv-rgroup-label');
	label.dataset.pptxChrome = 'ribbon-group-label';
	label.textContent = t('pptx.shortcuts.group.editing');
	el.append(row, label);

	const strip = createSharedHomeStrip(doc, t, 'editing', ({ id }) =>
		id === 'home.editing.select' ? handlers.selectAll() : handlers.toggleFindReplace(),
	);
	row.append(strip.el);
	strip.set(editingHomeControls({ selectAll: false }));

	return {
		el,
		update({ editable }) {
			strip.set(editingHomeControls({ selectAll: editable }));
		},
	};
}
