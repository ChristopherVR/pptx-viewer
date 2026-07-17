import type { Translator } from '../../i18n';
import { makeCheckboxField, makeSelectField } from './controls-extra';
import type { DeckCard } from './deck-card-helpers';
import { makeRow, makeSection } from './deck-card-helpers';
import type { InspectorHandlers } from './types';

type ShowType = 'presented' | 'browsed' | 'kiosk';

/**
 * The PRESENTATION card of the no-selection Properties tab: the slide/element
 * counts plus React's `PresentationSettingsCard` controls (show type, loop,
 * narration, animation, frame slides, slides per page).
 */
export function createDeckPresentationCard(
	doc: Document,
	t: Translator,
	handlers: Pick<InspectorHandlers, 'updatePresentationSettings'>,
): DeckCard {
	const { el, body } = makeSection(doc, t('pptx.slideInspector.presentation'));

	const slidesRow = makeRow(doc, t('pptx.sections.slides'));
	const elementsRow = makeRow(doc, t('pptx.documentProperties.statistics.elements'));
	body.append(slidesRow.el, elementsRow.el);

	const showType = makeSelectField<ShowType>(doc, {
		label: t('pptx.presentationSettings.showType'),
		options: [
			{ value: 'presented', label: t('pptx.presentationSettings.showTypePresented') },
			{ value: 'browsed', label: t('pptx.presentationSettings.showTypeBrowsed') },
			{ value: 'kiosk', label: t('pptx.presentationSettings.showTypeKiosk') },
		],
		onChange: (value) => handlers.updatePresentationSettings({ showType: value }),
	});
	const loop = makeCheckboxField(doc, {
		label: t('pptx.presentationSettings.loopContinuously'),
		onChange: (checked) => handlers.updatePresentationSettings({ loopContinuously: checked }),
	});
	const narration = makeCheckboxField(doc, {
		label: t('pptx.presentationSettings.showNarration'),
		onChange: (checked) => handlers.updatePresentationSettings({ showWithNarration: checked }),
	});
	const animation = makeCheckboxField(doc, {
		label: t('pptx.presentationSettings.showAnimation'),
		onChange: (checked) => handlers.updatePresentationSettings({ showWithAnimation: checked }),
	});
	const frameSlides = makeCheckboxField(doc, {
		label: t('pptx.presentationSettings.frameSlides'),
		onChange: (checked) => handlers.updatePresentationSettings({ printFrameSlides: checked }),
	});
	const slidesPerPage = doc.createElement('input');
	slidesPerPage.type = 'number';
	slidesPerPage.min = '1';
	slidesPerPage.max = '16';
	slidesPerPage.className = 'pptxv-field-input';
	slidesPerPage.setAttribute('aria-label', t('pptx.presentationSettings.slidesPerPage'));
	slidesPerPage.addEventListener('change', () => {
		const value = Number.parseInt(slidesPerPage.value, 10);
		if (Number.isFinite(value)) {
			handlers.updatePresentationSettings({ printSlidesPerPage: value });
		}
	});
	const slidesPerPageRow = makeRow(doc, t('pptx.presentationSettings.slidesPerPage'));
	slidesPerPageRow.value.appendChild(slidesPerPage);

	body.append(
		showType.el,
		loop.el,
		narration.el,
		animation.el,
		frameSlides.el,
		slidesPerPageRow.el,
	);

	return {
		el,
		update(state) {
			slidesRow.value.textContent = String(state.slideCount);
			elementsRow.value.textContent = String(state.elements.length);
			const props = state.presentationProperties;
			showType.setValue(props.showType ?? 'presented');
			loop.setValue(Boolean(props.loopContinuously));
			narration.setValue(props.showWithNarration !== false);
			animation.setValue(props.showWithAnimation !== false);
			frameSlides.setValue(Boolean(props.printFrameSlides));
			if (doc.activeElement !== slidesPerPage) {
				slidesPerPage.value = String(props.printSlidesPerPage ?? 1);
			}
			for (const control of [showType, loop, narration, animation, frameSlides]) {
				control.setDisabled(!state.editable);
			}
			slidesPerPage.disabled = !state.editable;
		},
	};
}
