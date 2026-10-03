import type { PptxSlide } from 'pptx-viewer-core';
import {
	HIDDEN_SLIDE_ATTRIBUTE,
	HIDDEN_SLIDE_LABEL_KEY,
	hiddenSlideCue,
	isEditorTextInputTarget,
	mapSlideSorterKey,
	applySorterAction,
	createSlideSorterState,
	selectSorterSlide,
	sorterSelectionIndexes,
	sorterMenuContext,
	sorterGridColumns,
} from 'pptx-viewer-shared';
import type { SlideSorterState, SlideSorterKeyActionName } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import { openSlideSorterContextMenu } from './slide-sorter-context-menu';

export interface SlideSorterOptions {
	slides: readonly PptxSlide[];
	current: number;
	onSelect(index: number): void;
	onReorder(from: number, to: number): void;
	onDelete(index: number): void;
	onDuplicate(index: number): void;
	onToggleHidden(index: number): void;
	/** Whether the host allows edits; gates the deck-writing shortcuts. */
	canEdit?: boolean;
	/**
	 * Slide ids copied in the sorter. The caller keeps the object when it
	 * re-opens the overlay after an edit, so Copy then Paste survives the
	 * re-render.
	 */
	clipboard?: { ids: string[]; state?: SlideSorterState };
}

export function openSlideSorterOverlay(
	doc: Document,
	host: HTMLElement,
	t: Translator,
	options: SlideSorterOptions,
): void {
	host.querySelector('[data-pptx-slide-sorter]')?.remove();
	const overlay = createEl(doc, 'section', 'pptxv-slide-sorter');
	overlay.dataset.pptxSlideSorter = 'true';
	overlay.setAttribute('role', 'dialog');
	const header = createEl(doc, 'header');
	const title = createEl(doc, 'h2');
	title.textContent = t('pptx.slideSorter.title');
	const count = createEl(doc, 'span');
	count.textContent = t('pptx.slideSorter.slideCount', { count: options.slides.length });
	const close = createEl(doc, 'button');
	close.type = 'button';
	close.textContent = '×';
	close.setAttribute('aria-label', t('pptx.slideSorter.close'));
	header.append(title, count, close);
	overlay.appendChild(header);
	const grid = createEl(doc, 'div', 'pptxv-sorter-grid');

	// Slide ids copied in this sorter session (the shared Copy / Paste pair).
	const clipboard = options.clipboard ?? { ids: [] };
	let closeMenu: (() => void) | null = null;
	let sorter = clipboard.state ?? createSlideSorterState(options.slides, options.current);
	const refreshSelection = (): void => {
		clipboard.state = sorter;
		overlay
			.querySelectorAll<HTMLElement>('[data-pptx-chrome="sorter-tile"]')
			.forEach((card, index) => {
				const selected = sorter.selectedIds.includes(options.slides[index].id);
				card.dataset.pptxSelected = String(selected);
				card.classList.toggle('is-current', selected);
			});
		const slider = overlay.querySelector<HTMLInputElement>('input[type=range]');
		if (slider) {
			slider.value = String(sorter.zoom);
		}
		grid.style.gridTemplateColumns = `repeat(${sorterGridColumns(sorter.zoom)}, minmax(0, 1fr))`;
		grid.querySelectorAll<HTMLElement>('article > button').forEach((button) => {
			button.style.height = `${(100 * sorter.zoom) / 100}px`;
		});
	};
	const runAction = (action: SlideSorterKeyActionName | 'toggle-hidden'): void => {
		const result = applySorterAction(sorter, options.slides, action, options.current);
		sorter = result.state;
		clipboard.ids = sorter.clipboardIds;
		clipboard.state = sorter;
		if (result.close) {
			dismiss();
		}
		for (const index of result.indexes) {
			if (result.operation === 'duplicate') {
				options.onDuplicate(index);
			}
			if (result.operation === 'delete') {
				options.onDelete(index);
			}
			if (result.operation === 'toggle-hidden') {
				options.onToggleHidden(index);
			}
		}
		refreshSelection();
	};
	options.slides.forEach((slide, index) => {
		const card = createEl(doc, 'article', 'pptxv-sorter-card');
		card.dataset.pptxChrome = 'sorter-tile';
		card.addEventListener('contextmenu', (event) => {
			if (options.canEdit === false) {
				return;
			}
			event.preventDefault();
			closeMenu?.();
			sorter = selectSorterSlide(sorter, options.slides, index, {}, true);
			refreshSelection();
			closeMenu = openSlideSorterContextMenu({
				doc,
				t,
				host: overlay,
				x: event.clientX,
				y: event.clientY,
				context: sorterMenuContext(sorter, options.slides),
				onCommand: runAction,
			});
		});
		card.draggable = true;
		card.classList.toggle('is-current', index === options.current);
		card.classList.toggle('is-hidden', Boolean(slide.hidden));
		const preview = createEl(doc, 'button');
		preview.type = 'button';
		// The number lives in its own span so the hidden-slide slash can be drawn
		// across the number alone rather than the whole preview button.
		const num = createEl(doc, 'span', 'pptxv-sorter-num');
		num.textContent = String(index + 1);
		preview.appendChild(num);
		preview.setAttribute('aria-label', t('pptx.compare.slideNumber', { number: index + 1 }));
		const cue = hiddenSlideCue(slide.hidden, 'sorter', index);
		if (cue.marker && cue.labelId) {
			card.setAttribute(HIDDEN_SLIDE_ATTRIBUTE, cue.marker);
			preview.setAttribute('aria-describedby', cue.labelId);
			const badge = createEl(doc, 'span', 'pptxv-sorter-hidden');
			badge.id = cue.labelId;
			badge.textContent = t(HIDDEN_SLIDE_LABEL_KEY);
			preview.appendChild(badge);
		}
		preview.addEventListener('click', (event) => {
			sorter = selectSorterSlide(sorter, options.slides, index, event);
			refreshSelection();
		});
		preview.addEventListener('dblclick', () => {
			options.onSelect(index);
			overlay.remove();
		});
		card.addEventListener('dragstart', (event) =>
			event.dataTransfer?.setData('text/plain', String(index)),
		);
		card.addEventListener('dragover', (event) => event.preventDefault());
		card.addEventListener('drop', (event) => {
			event.preventDefault();
			const from = Number(event.dataTransfer?.getData('text/plain'));
			if (Number.isInteger(from)) {
				options.onReorder(from, index);
			}
		});
		card.append(preview);
		grid.appendChild(card);
	});
	overlay.appendChild(grid);

	const dismiss = (): void => {
		closeMenu?.();
		doc.removeEventListener('keydown', onKeyDown);
		overlay.remove();
	};
	const onKeyDown = (event: KeyboardEvent): void => {
		if (!overlay.isConnected) {
			doc.removeEventListener('keydown', onKeyDown);
			return;
		}
		const { action } = mapSlideSorterKey(event, {
			canEdit: options.canEdit !== false,
			hasMultiSelection: sorterSelectionIndexes(sorter, options.slides).length > 1,
			isTextInputTarget: isEditorTextInputTarget(event.target),
		});
		if (!action) {
			return;
		}
		closeMenu?.();
		event.preventDefault();
		event.stopPropagation();
		runAction(action);
	};
	doc.addEventListener('keydown', onKeyDown);

	const zoom = createEl(doc, 'input');
	zoom.type = 'range';
	zoom.min = '50';
	zoom.max = '200';
	zoom.step = '10';
	zoom.value = String(sorter.zoom);
	zoom.setAttribute('aria-label', t('pptx.slideSorter.zoom'));
	zoom.addEventListener('input', () => {
		sorter = { ...sorter, zoom: Number(zoom.value) };
		refreshSelection();
	});
	overlay.appendChild(zoom);
	refreshSelection();
	close.addEventListener('click', dismiss);
	host.appendChild(overlay);
}
