import type { PptxSlide } from 'pptx-viewer-core';

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
		preview.textContent = String(index + 1);
		preview.setAttribute('aria-label', t('pptx.compare.slideNumber', { number: index + 1 }));
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
	close.addEventListener('click', () => overlay.remove());
	host.appendChild(overlay);
}
