import { normalizeHexColor, resolveTemplateBackgroundRows } from 'pptx-viewer-shared';
import type { TemplateBackgroundRow } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import type { DeckCard } from './deck-card-helpers';
import { makeSection } from './deck-card-helpers';
import type { InspectorHandlers } from './types';

/**
 * The SLIDE BACKGROUND card's template-backgrounds section (React/Vue/
 * Angular's shortcut to edit the active slide's LAYOUT and MASTER background
 * colour directly, without leaving the slide for the separate Master Views
 * overlay). Shown only while `editTemplateMode` is on and the active slide
 * has a layout and/or master to edit.
 */
export function createSlideBackgroundCard(
	doc: Document,
	t: Translator,
	handlers: Pick<
		InspectorHandlers,
		'setTemplateBackground' | 'getTemplateBackgroundColor' | 'pushRecentColor'
	>,
): DeckCard {
	const { el, body } = makeSection(doc, t('pptx.slideBackground.templateBackgroundsHeading'));

	function buildRow(row: TemplateBackgroundRow, roleLabel: string): HTMLElement {
		const rowEl = createEl(doc, 'label', 'pptxv-inspector-row');
		const label = createEl(doc, 'span', 'pptxv-inspector-row-label');
		label.textContent = roleLabel;
		label.title = row.title;
		const input = doc.createElement('input');
		input.type = 'color';
		input.value = normalizeHexColor(handlers.getTemplateBackgroundColor(row.path), '#ffffff');
		input.addEventListener('change', () => {
			handlers.setTemplateBackground(row.path, input.value);
			handlers.pushRecentColor(input.value);
		});
		const value = createEl(doc, 'span', 'pptxv-inspector-row-value');
		value.textContent = row.label;
		rowEl.append(label, input, value);
		return rowEl;
	}

	return {
		el,
		update(state) {
			const rows =
				state.editTemplateMode && state.activeSlide
					? resolveTemplateBackgroundRows(
							state.activeSlide,
							state.slideMasters,
							t('pptx.master.layout'),
							t('pptx.master.master'),
						)
					: {};
			el.hidden = !rows.layout && !rows.master;
			body.replaceChildren();
			if (rows.layout) {
				body.appendChild(buildRow(rows.layout, t('pptx.master.layout')));
			}
			if (rows.master) {
				body.appendChild(buildRow(rows.master, t('pptx.master.master')));
			}
		},
	};
}
