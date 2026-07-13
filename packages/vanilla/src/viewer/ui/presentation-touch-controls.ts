import { buildPresentationTouchControlState } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import { makeButton } from './controls';

export interface PresentationTouchControlHandlers {
	previous(): void;
	next(): void;
	exit(): void;
}

export interface PresentationTouchControls {
	el: HTMLElement;
	update(current: number, total: number): void;
}

/** Build persistent, safe-area-aware controls for coarse-pointer slide shows. */
export function createPresentationTouchControls(
	doc: Document,
	t: Translator,
	handlers: PresentationTouchControlHandlers,
): PresentationTouchControls {
	const el = createEl(doc, 'div', 'pptxv-presentation-touch-controls');
	el.setAttribute('aria-label', t('pptx.statusBar.slideShow'));

	const exit = makeButton(doc, {
		label: t('pptx.presenter.endPresentation'),
		text: '×',
		className: 'pptxv-presentation-touch-exit',
		onClick: handlers.exit,
	});
	const previous = makeButton(doc, {
		label: t('pptx.presenter.previousSlide'),
		icon: 'chevron-left',
		className: 'pptxv-presentation-touch-prev',
		onClick: handlers.previous,
	});
	const next = makeButton(doc, {
		label: t('pptx.presenter.nextSlide'),
		icon: 'chevron-right',
		className: 'pptxv-presentation-touch-next',
		onClick: handlers.next,
	});
	const counter = createEl(doc, 'span', 'pptxv-presentation-touch-counter');
	counter.setAttribute('aria-live', 'polite');

	for (const button of [exit.btn, previous.btn, next.btn]) {
		button.addEventListener('pointerdown', (event) => event.stopPropagation());
		button.addEventListener('click', (event) => event.stopPropagation());
	}
	el.append(exit.btn, previous.btn, next.btn, counter);

	return {
		el,
		update(current, total) {
			const state = buildPresentationTouchControlState(current, total);
			previous.setDisabled(state.previousDisabled);
			next.setDisabled(state.nextDisabled);
			counter.textContent = state.counterLabel;
		},
	};
}
