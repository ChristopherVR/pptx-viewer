import type { Translator } from '../i18n';
import { createEl } from '../render';
import type { IconName } from './icons';
import { createIcon } from './icons';

export interface ToolbarHandlers {
	prev(): void;
	next(): void;
	zoomIn(): void;
	zoomOut(): void;
	zoomToFit(): void;
	togglePresentation(): void;
}

export interface ToolbarUpdate {
	/** Zero-based current slide index. */
	current: number;
	/** Total slide count. */
	total: number;
	/** Effective zoom percentage (100 = 1:1). */
	zoomPercent: number;
}

export interface Toolbar {
	el: HTMLElement;
	update(state: ToolbarUpdate): void;
}

/**
 * The viewer toolbar: prev/next + slide counter, zoom out/in/fit + zoom label,
 * and the presentation (fullscreen) toggle. All labels come from the shared
 * i18n dictionary; all colors from the shared theme CSS vars.
 */
export function createToolbar(doc: Document, t: Translator, handlers: ToolbarHandlers): Toolbar {
	const el = createEl(doc, 'div', 'pptxv-toolbar');
	el.setAttribute('role', 'toolbar');

	const button = (icon: IconName, label: string, onClick: () => void): HTMLButtonElement => {
		const btn = createEl(doc, 'button', 'pptxv-btn');
		btn.type = 'button';
		btn.title = label;
		btn.setAttribute('aria-label', label);
		btn.appendChild(createIcon(doc, icon));
		btn.addEventListener('click', onClick);
		el.appendChild(btn);
		return btn;
	};

	const prevBtn = button('chevron-left', t('pptx.presenter.previousSlide'), handlers.prev);
	const counter = createEl(doc, 'span', 'pptxv-counter');
	counter.setAttribute('aria-live', 'polite');
	el.appendChild(counter);
	const nextBtn = button('chevron-right', t('pptx.presenter.nextSlide'), handlers.next);

	el.appendChild(createEl(doc, 'span', 'pptxv-toolbar-spacer'));

	button('zoom-out', t('pptx.statusBar.zoomOut'), handlers.zoomOut);
	const zoomLabel = createEl(doc, 'span', 'pptxv-zoom-label');
	el.appendChild(zoomLabel);
	button('zoom-in', t('pptx.statusBar.zoomIn'), handlers.zoomIn);
	button('fit', t('pptx.statusBar.zoomToFit'), handlers.zoomToFit);
	button('play', t('pptx.statusBar.slideShow'), handlers.togglePresentation);

	return {
		el,
		update({ current, total, zoomPercent }) {
			counter.textContent =
				total > 0
					? t('pptx.statusBar.slideOf', { current: current + 1, total })
					: t('pptx.statusBar.noSlides');
			zoomLabel.textContent = `${Math.round(zoomPercent)}%`;
			prevBtn.disabled = current <= 0;
			nextBtn.disabled = current >= total - 1;
		},
	};
}
