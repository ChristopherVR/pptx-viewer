import type { Translator } from '../i18n';
import { createEl } from '../render';
import { makeButton } from './controls';
import type { RibbonNavState } from './ribbon/ribbon-types';

/** Actions exposed by the narrow-screen navigation dock. */
export interface MobileNavigationHandlers {
	prev(): void;
	next(): void;
	toggleNotes(): void;
	togglePresentation(): void;
	zoomIn(): void;
	zoomOut(): void;
}

/** Imperative state bridge for the compact, mobile-only control dock. */
export interface MobileNavigation {
	el: HTMLElement;
	update(state: RibbonNavState): void;
	setNotesExpanded(expanded: boolean): void;
}

/**
 * Build the phone-sized control dock. It deliberately reuses the viewer's
 * existing navigation, notes, zoom, and presentation actions rather than
 * surfacing a partial editor ribbon on a screen that cannot support it.
 */
export function createMobileNavigation(
	doc: Document,
	t: Translator,
	handlers: MobileNavigationHandlers,
): MobileNavigation {
	const el = createEl(doc, 'nav', 'pptxv-mobile-nav');
	el.setAttribute('aria-label', t('pptx.statusBar.normalView'));

	const prev = makeButton(doc, {
		label: t('pptx.presenter.previousSlide'),
		icon: 'chevron-left',
		className: 'pptxv-mobile-nav-btn',
		onClick: handlers.prev,
	});
	const counter = createEl(doc, 'span', 'pptxv-mobile-nav-counter');
	counter.setAttribute('aria-live', 'polite');
	const next = makeButton(doc, {
		label: t('pptx.presenter.nextSlide'),
		icon: 'chevron-right',
		className: 'pptxv-mobile-nav-btn',
		onClick: handlers.next,
	});
	const notes = makeButton(doc, {
		label: t('pptx.statusBar.toggleNotes'),
		icon: 'notes',
		className: 'pptxv-mobile-nav-btn',
		onClick: handlers.toggleNotes,
	});
	const zoomOut = makeButton(doc, {
		label: t('pptx.statusBar.zoomOut'),
		icon: 'minus',
		className: 'pptxv-mobile-nav-btn',
		onClick: handlers.zoomOut,
	});
	const zoom = createEl(doc, 'span', 'pptxv-mobile-nav-zoom');
	zoom.setAttribute('aria-live', 'polite');
	const zoomIn = makeButton(doc, {
		label: t('pptx.statusBar.zoomIn'),
		icon: 'plus',
		className: 'pptxv-mobile-nav-btn',
		onClick: handlers.zoomIn,
	});
	const present = makeButton(doc, {
		label: t('pptx.statusBar.slideShow'),
		icon: 'presentation',
		className: 'pptxv-mobile-nav-btn',
		onClick: handlers.togglePresentation,
	});

	el.append(prev.btn, counter, next.btn, notes.btn, zoomOut.btn, zoom, zoomIn.btn, present.btn);

	return {
		el,
		update({ current, total, zoomPercent }) {
			counter.textContent = total > 0 ? `${current + 1} / ${total}` : '0 / 0';
			zoom.textContent = `${Math.round(zoomPercent)}%`;
			prev.setDisabled(current <= 0);
			next.setDisabled(current >= total - 1);
		},
		setNotesExpanded(expanded) {
			notes.setActive(expanded);
		},
	};
}
