import type { SlideSizeRescaleMode } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';

/**
 * PowerPoint's Design > Slide Size "Maximize" / "Ensure Fit" prompt: shown
 * inline by `deck-slide-size-card.ts` when the deck has content and the size
 * about to be adopted differs from the current one. Picking either option
 * rescales every slide's elements (through the shared
 * `scaleSlidesForSizeChange`) AND adopts the new size in one undoable step;
 * the card itself decides when to show/hide this and what size is pending.
 */
export interface SlideSizeRescalePrompt {
	el: HTMLElement;
	show(): void;
	hide(): void;
}

export function createSlideSizeRescalePrompt(
	doc: Document,
	t: Translator,
	onPick: (mode: SlideSizeRescaleMode) => void,
): SlideSizeRescalePrompt {
	const el = createEl(doc, 'div', 'pptxv-slide-size-rescale');
	el.hidden = true;
	el.setAttribute('role', 'group');
	el.setAttribute('aria-label', t('pptx.slideSize.rescaleTitle'));
	const title = createEl(doc, 'div', 'pptxv-slide-size-rescale-title');
	title.textContent = t('pptx.slideSize.rescaleTitle');
	const description = createEl(doc, 'p', 'pptxv-slide-size-rescale-description');
	description.textContent = t('pptx.slideSize.rescaleDescription');
	const buttons = createEl(doc, 'div', 'pptxv-slide-size-rescale-buttons');

	function makeChoice(
		testid: string,
		labelKey: string,
		hintKey: string,
		mode: SlideSizeRescaleMode,
	): HTMLButtonElement {
		const button = createEl(doc, 'button', 'pptxv-slide-size-rescale-btn');
		button.type = 'button';
		button.dataset.testid = testid;
		button.title = t(hintKey);
		button.textContent = t(labelKey);
		button.addEventListener('click', () => onPick(mode));
		return button;
	}

	buttons.append(
		makeChoice(
			'pptx-slide-size-rescale-maximize',
			'pptx.slideSize.rescaleMaximize',
			'pptx.slideSize.rescaleMaximizeHint',
			'maximize',
		),
		makeChoice(
			'pptx-slide-size-rescale-ensure-fit',
			'pptx.slideSize.rescaleEnsureFit',
			'pptx.slideSize.rescaleEnsureFitHint',
			'ensureFit',
		),
	);
	el.append(title, description, buttons);

	return {
		el,
		show() {
			el.hidden = false;
		},
		hide() {
			el.hidden = true;
		},
	};
}
