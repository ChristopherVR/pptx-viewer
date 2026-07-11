import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import { makeButton } from '../controls';
import type { RibbonNavHandlers, RibbonNavState } from './ribbon-types';

export interface RibbonNavRow {
	el: HTMLElement;
	update(state: RibbonNavState): void;
	setNotesExpanded(expanded: boolean): void;
}

/**
 * The persistent navigation strip: prev/next + slide counter, zoom out/in/fit
 * + zoom label, present toggle, and the notes toggle. Kept always-visible
 * (both editing and read-only chrome) rather than nested inside the View
 * ribbon tab: these are core *viewing* features a read-only viewer still
 * needs, so gating them behind an editing-only ribbon tab would regress
 * read-only mode. The View tab additionally surfaces the same actions for
 * ribbon-parity/discoverability while editing (see `tabs/view-tab.ts`).
 */
export function createRibbonNavRow(
	doc: Document,
	t: Translator,
	handlers: RibbonNavHandlers,
): RibbonNavRow {
	const el = createEl(doc, 'div', 'pptxv-ribbon-nav');
	el.setAttribute('role', 'toolbar');

	const prevBtn = makeButton(doc, {
		label: t('pptx.presenter.previousSlide'),
		icon: 'chevron-left',
		onClick: handlers.prev,
	});
	const counter = createEl(doc, 'span', 'pptxv-counter');
	counter.setAttribute('aria-live', 'polite');
	const nextBtn = makeButton(doc, {
		label: t('pptx.presenter.nextSlide'),
		icon: 'chevron-right',
		onClick: handlers.next,
	});
	el.append(prevBtn.btn, counter, nextBtn.btn);
	el.appendChild(createEl(doc, 'span', 'pptxv-ribbon-nav-spacer'));

	const zoomOut = makeButton(doc, {
		label: t('pptx.statusBar.zoomOut'),
		icon: 'zoom-out',
		onClick: handlers.zoomOut,
	});
	const zoomLabel = createEl(doc, 'span', 'pptxv-zoom-label');
	const zoomIn = makeButton(doc, {
		label: t('pptx.statusBar.zoomIn'),
		icon: 'zoom-in',
		onClick: handlers.zoomIn,
	});
	const fit = makeButton(doc, {
		label: t('pptx.statusBar.zoomToFit'),
		icon: 'fit',
		onClick: handlers.zoomToFit,
	});
	const present = makeButton(doc, {
		label: t('pptx.statusBar.slideShow'),
		icon: 'play',
		onClick: handlers.togglePresentation,
	});
	const notes = makeButton(doc, {
		label: t('pptx.statusBar.toggleNotes'),
		icon: 'notes',
		onClick: handlers.toggleNotes,
	});
	notes.btn.setAttribute('aria-pressed', 'false');
	el.append(zoomOut.btn, zoomLabel, zoomIn.btn, fit.btn, present.btn, notes.btn);

	return {
		el,
		update({ current, total, zoomPercent }) {
			counter.textContent =
				total > 0
					? t('pptx.statusBar.slideOf', { current: current + 1, total })
					: t('pptx.statusBar.noSlides');
			zoomLabel.textContent = `${Math.round(zoomPercent)}%`;
			prevBtn.setDisabled(current <= 0);
			nextBtn.setDisabled(current >= total - 1);
		},
		setNotesExpanded(expanded) {
			notes.btn.setAttribute('aria-pressed', String(expanded));
			notes.setActive(expanded);
		},
	};
}
