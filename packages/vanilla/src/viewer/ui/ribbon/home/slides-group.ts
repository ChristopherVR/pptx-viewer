import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';

export interface SlidesGroupHandlers {
	addSlide(): void;
	addSection(): void;
	duplicateSlide(): void;
	deleteSlide(): void;
}

export interface SlidesGroupState {
	editable: boolean;
	slideCount: number;
}

export interface SlidesGroup {
	el: HTMLElement;
	update(state: SlidesGroupState): void;
}

/** The ribbon Home tab's Slides group: new, duplicate, delete, and section actions. */
export function createSlidesGroup(
	doc: Document,
	t: Translator,
	handlers: SlidesGroupHandlers,
): SlidesGroup {
	const el = createEl(doc, 'div', 'pptxv-rgroup');
	const row = createEl(doc, 'div', 'pptxv-rgroup-row');
	el.appendChild(row);
	const label = createEl(doc, 'span', 'pptxv-rgroup-label');
	label.textContent = t('pptx.sections.slides');
	el.appendChild(label);

	const add = makeButton(doc, {
		label: t('pptx.home.newSlide'),
		icon: 'new-slide',
		onClick: handlers.addSlide,
	});
	const duplicate = makeButton(doc, {
		label: t('pptx.arrange.duplicate'),
		icon: 'duplicate',
		onClick: handlers.duplicateSlide,
	});
	const section = makeButton(doc, {
		label: t('pptx.sections.sectionButtonLabel'),
		text: '§',
		onClick: handlers.addSection,
	});
	const del = makeButton(doc, {
		label: t('pptx.arrange.delete'),
		icon: 'trash',
		onClick: handlers.deleteSlide,
	});
	row.append(add.btn, duplicate.btn, del.btn, section.btn);

	return {
		el,
		update({ editable, slideCount }) {
			add.setDisabled(!editable);
			duplicate.setDisabled(!editable || slideCount === 0);
			del.setDisabled(!editable || slideCount <= 1);
			section.setDisabled(!editable || slideCount === 0);
		},
	};
}
