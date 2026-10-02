import {
	normalizeHexColor,
	slideBackgroundClearPatch,
	slideBackgroundClearState,
} from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import type { DeckCard } from './deck-card-helpers';
import { makeDeckButton, makeSection } from './deck-card-helpers';
import type { InspectorHandlers } from './types';

/**
 * The BACKGROUND card: the active slide's own solid colour plus the Clear
 * Background action (React's `SlideBackgroundPanel`, Vue's and Angular's
 * slide-background card). Clear visibility and enablement come from the
 * shared `slideBackgroundClearState`; one click is one `updateActiveSlide`
 * patch, so it is one undo step.
 */
export function createSlideBackgroundFillCard(
	doc: Document,
	t: Translator,
	handlers: Pick<InspectorHandlers, 'updateActiveSlide' | 'pushRecentColor'>,
): DeckCard {
	const { el, body } = makeSection(doc, t('pptx.viewer.background'));
	const row = createEl(doc, 'label', 'pptxv-inspector-row');
	const label = createEl(doc, 'span', 'pptxv-inspector-row-label');
	label.textContent = t('pptx.slideBackground.colour');
	const input = doc.createElement('input');
	input.type = 'color';
	input.setAttribute('aria-label', t('pptx.slideBackground.colourAriaLabel'));
	input.addEventListener('change', () => {
		handlers.updateActiveSlide({ backgroundColor: input.value });
		handlers.pushRecentColor(input.value);
	});
	row.append(label, input);
	const clear = makeDeckButton(doc, t('pptx.slideBackground.clearBackground'), () =>
		handlers.updateActiveSlide(slideBackgroundClearPatch()),
	);
	body.append(row, clear);
	return {
		el,
		update(state) {
			el.hidden = !state.activeSlide;
			input.value = normalizeHexColor(state.activeSlide?.backgroundColor, '#ffffff');
			input.disabled = !state.editable;
			const clearState = slideBackgroundClearState(state.activeSlide, state.editable);
			clear.hidden = !clearState.visible;
			clear.disabled = !clearState.enabled;
		},
	};
}
