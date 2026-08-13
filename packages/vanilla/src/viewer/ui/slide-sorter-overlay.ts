import type { PptxSlide } from 'pptx-viewer-core';
import {
	HIDDEN_SLIDE_ATTRIBUTE,
	HIDDEN_SLIDE_LABEL_KEY,
	hiddenSlideCue,
	isEditorTextInputTarget,
	mapSlideSorterKey,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';

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
	options.slides.forEach((slide, index) => {
		const card = createEl(doc, 'article', 'pptxv-sorter-card');
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
		preview.addEventListener('click', () => {
			options.onSelect(index);
			overlay.remove();
		});
		const actions = createEl(doc, 'div');
		for (const [label, action] of [
			[t('pptx.slideSorter.contextMenu.duplicate'), () => options.onDuplicate(index)],
			[
				t(
					slide.hidden
						? 'pptx.slideSorter.contextMenu.showSlides'
						: 'pptx.slideSorter.contextMenu.hideSlides',
				),
				() => options.onToggleHidden(index),
			],
			[t('pptx.slideSorter.contextMenu.delete'), () => options.onDelete(index)],
		] as const) {
			const button = createEl(doc, 'button');
			button.type = 'button';
			button.textContent = label;
			button.addEventListener('click', action);
			actions.appendChild(button);
		}
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
		card.append(preview, actions);
		grid.appendChild(card);
	});
	overlay.appendChild(grid);

	// The sorter keymap is shared (`mapSlideSorterKey`), so this overlay answers
	// the same keys as the other four bindings' sorters. Vanilla had no sorter
	// keyboard at all before: Escape did not even close it, which left the
	// overlay dismissable only by finding its ✕. Only the commands this overlay
	// can perform are dispatched; it has no slide clipboard, no multi-selection
	// and no thumbnail zoom, so those chords are left to the host.
	const dismiss = (): void => {
		doc.removeEventListener('keydown', onKeyDown);
		overlay.remove();
	};
	const onKeyDown = (event: KeyboardEvent): void => {
		// The overlay can be torn down by a re-render rather than by its own ✕, so
		// the listener detaches itself once its overlay has left the document.
		if (!overlay.isConnected) {
			doc.removeEventListener('keydown', onKeyDown);
			return;
		}
		const { action } = mapSlideSorterKey(event, {
			canEdit: options.canEdit !== false,
			isTextInputTarget: isEditorTextInputTarget(event.target),
		});
		if (action === 'close') {
			event.stopPropagation();
			dismiss();
			return;
		}
		if (action === 'delete') {
			event.preventDefault();
			options.onDelete(options.current);
			return;
		}
		if (action === 'duplicate') {
			event.preventDefault();
			options.onDuplicate(options.current);
		}
	};
	doc.addEventListener('keydown', onKeyDown);

	close.addEventListener('click', dismiss);
	host.appendChild(overlay);
}
