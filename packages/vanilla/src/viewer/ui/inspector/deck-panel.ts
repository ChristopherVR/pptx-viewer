import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import type { InspectorDeckState, InspectorHandlers } from './types';

export interface DeckPanel {
	el: HTMLElement;
	update(state: InspectorDeckState): void;
	setVisible(visible: boolean): void;
}

/** A titled section with label/value rows (Presentation, Slide Size, Document). */
function makeSection(doc: Document, title: string): { el: HTMLElement; body: HTMLElement } {
	const el = createEl(doc, 'div', 'pptxv-inspector-section');
	const caption = createEl(doc, 'h4', 'pptxv-inspector-section-title');
	caption.textContent = title;
	el.appendChild(caption);
	const body = createEl(doc, 'div');
	el.appendChild(body);
	return { el, body };
}

function makeRow(doc: Document, label: string): { el: HTMLElement; value: HTMLElement } {
	const el = createEl(doc, 'div', 'pptxv-inspector-row');
	const labelEl = createEl(doc, 'span', 'pptxv-inspector-row-label');
	labelEl.textContent = label;
	const value = createEl(doc, 'span', 'pptxv-inspector-row-value');
	el.append(labelEl, value);
	return { el, value };
}

/**
 * The no-selection Properties view: presentation, slide-size, and document
 * sections, a scoped-down port of React's `PresentationPropertiesPanel`
 * (theme / theme-override / notes-and-handout cards are not ported yet).
 */
export function createDeckPanel(
	doc: Document,
	t: Translator,
	handlers: Pick<InspectorHandlers, 'openDocumentProperties'>,
): DeckPanel {
	const el = createEl(doc, 'div', 'pptxv-inspector-deck');

	const presentation = makeSection(doc, t('pptx.slideInspector.presentation'));
	const slidesRow = makeRow(doc, t('pptx.sections.slides'));
	const elementsRow = makeRow(doc, t('pptx.documentProperties.statistics.elements'));
	presentation.body.append(slidesRow.el, elementsRow.el);

	const slideSize = makeSection(doc, t('pptx.slideSize.title'));
	const sizeRow = makeRow(doc, t('pptx.slideSize.title'));
	slideSize.body.appendChild(sizeRow.el);

	const documentSection = makeSection(doc, t('pptx.documentProperties.documentHeading'));
	const titleRow = makeRow(doc, t('pptx.properties.titleLabel'));
	const authorRow = makeRow(doc, t('pptx.properties.author'));
	const openProps = createEl(doc, 'button', 'pptxv-inspector-deck-btn');
	openProps.type = 'button';
	openProps.textContent = t('pptx.ribbon.documentProperties');
	openProps.addEventListener('click', () => handlers.openDocumentProperties());
	documentSection.body.append(titleRow.el, authorRow.el, openProps);

	el.append(presentation.el, slideSize.el, documentSection.el);

	return {
		el,
		update(state) {
			slidesRow.value.textContent = String(state.slideCount);
			elementsRow.value.textContent = String(state.elements.length);
			sizeRow.value.textContent = `${Math.round(state.canvasSize.width)} x ${Math.round(state.canvasSize.height)} px`;
			titleRow.value.textContent = state.docTitle || '-';
			authorRow.value.textContent = state.docAuthor || '-';
		},
		setVisible(visible) {
			el.hidden = !visible;
		},
	};
}
