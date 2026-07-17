import type { ToolbarActionId } from 'pptx-viewer-shared';
import { buildPresentationTouchControlState, isActionHidden } from 'pptx-viewer-shared';

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

/**
 * Build persistent, safe-area-aware controls for coarse-pointer slide shows.
 * The prev/next pair is gated as a unit on the `'navigation'` action (the exit
 * affordance always stays, since removing it would trap a touch user in
 * presentation mode).
 */
export function createPresentationTouchControls(
	doc: Document,
	t: Translator,
	handlers: PresentationTouchControlHandlers,
	hiddenActions?: readonly ToolbarActionId[],
): PresentationTouchControls {
	const el = createEl(doc, 'div', 'pptxv-presentation-touch-controls');
	el.setAttribute('role', 'toolbar');
	el.setAttribute('aria-label', t('pptx.toolbar.presentationToolbarAria'));

	const exit = makeButton(doc, {
		label: t('pptx.presenter.endPresentation'),
		text: '×',
		className: 'pptxv-presentation-touch-exit',
		onClick: handlers.exit,
	});
	const showNavigation = !isActionHidden('navigation', hiddenActions);
	const previous = showNavigation
		? makeButton(doc, {
				label: t('pptx.presenter.previousSlide'),
				icon: 'chevron-left',
				className: 'pptxv-presentation-touch-prev',
				onClick: handlers.previous,
			})
		: null;
	const next = showNavigation
		? makeButton(doc, {
				label: t('pptx.presenter.nextSlide'),
				icon: 'chevron-right',
				className: 'pptxv-presentation-touch-next',
				onClick: handlers.next,
			})
		: null;
	const counter = createEl(doc, 'span', 'pptxv-presentation-touch-counter');
	counter.setAttribute('aria-live', 'polite');

	for (const button of [exit.btn, previous?.btn, next?.btn]) {
		button?.addEventListener('pointerdown', (event) => event.stopPropagation());
		button?.addEventListener('click', (event) => event.stopPropagation());
	}
	el.append(exit.btn, ...(previous ? [previous.btn] : []), ...(next ? [next.btn] : []), counter);

	return {
		el,
		update(current, total) {
			const state = buildPresentationTouchControlState(current, total);
			previous?.setDisabled(state.previousDisabled);
			next?.setDisabled(state.nextDisabled);
			counter.textContent = state.counterLabel;
		},
	};
}
