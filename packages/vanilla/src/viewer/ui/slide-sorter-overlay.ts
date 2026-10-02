import type { PptxSlide } from 'pptx-viewer-core';
import {
	HIDDEN_SLIDE_ATTRIBUTE,
	HIDDEN_SLIDE_LABEL_KEY,
	hiddenSlideCue,
	isEditorTextInputTarget,
	mapSlideSorterKey,
	slideSorterPasteIndexes,
} from 'pptx-viewer-shared';
import type { SlideSorterContextMenuCommandId } from 'pptx-viewer-shared';

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
	clipboard?: { ids: string[] };
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
	const copySlide = (index: number): void => {
		const slide = options.slides[index];
		if (slide) {
			clipboard.ids = [slide.id];
		}
	};
	// Paste inserts a copy after each copied slide; highest index first so the
	// earlier indexes stay valid while the deck grows.
	const pasteSlides = (): void => {
		const indexes = slideSorterPasteIndexes(clipboard.ids, options.slides);
		for (const index of [...indexes].sort((a, b) => b - a)) {
			options.onDuplicate(index);
		}
	};
	const runCommand = (id: SlideSorterContextMenuCommandId, index: number): void => {
		switch (id) {
			case 'copy':
				copySlide(index);
				break;
			case 'paste':
				pasteSlides();
				break;
			case 'duplicate':
				options.onDuplicate(index);
				break;
			case 'toggle-hidden':
				options.onToggleHidden(index);
				break;
			case 'delete':
				options.onDelete(index);
				break;
			default:
				break;
		}
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
			closeMenu = openSlideSorterContextMenu({
				doc,
				t,
				host: overlay,
				x: event.clientX,
				y: event.clientY,
				hidden: Boolean(slide.hidden),
				hasClipboard: clipboard.ids.length > 0,
				totalSlides: options.slides.length,
				onCommand: (id) => runCommand(id, index),
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
		preview.addEventListener('click', () => {
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

	// The sorter keymap is shared (`mapSlideSorterKey`), so this overlay answers
	// the same keys as the other four bindings' sorters. Vanilla had no sorter
	// keyboard at all before: Escape did not even close it, which left the
	// overlay dismissable only by finding its ✕. Only the commands this overlay
	// can perform are dispatched; it has no multi-selection and no thumbnail
	// zoom, so those chords are left to the host.
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
			return;
		}
		if (action === 'copy') {
			event.preventDefault();
			copySlide(options.current);
			return;
		}
		if (action === 'paste') {
			event.preventDefault();
			pasteSlides();
		}
	};
	doc.addEventListener('keydown', onKeyDown);

	close.addEventListener('click', dismiss);
	host.appendChild(overlay);
}
