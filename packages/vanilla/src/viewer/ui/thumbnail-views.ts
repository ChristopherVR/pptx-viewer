import type { PptxSlide, PptxSlideMaster } from 'pptx-viewer-core';
import {
	EDITOR_THUMBNAIL_WIDTH,
	editorThumbnailHeight,
	HIDDEN_SLIDE_ATTRIBUTE,
	HIDDEN_SLIDE_LABEL_KEY,
	hiddenSlideCue,
} from 'pptx-viewer-shared';
import type { CanvasSize } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import { createIcon } from './icons';

export function createThumbnailRow(
	doc: Document,
	t: Translator,
	slide: PptxSlide,
	index: number,
	canvasSize: CanvasSize,
	renderStage: (slide: PptxSlide, scale: number) => HTMLElement,
	scale: number,
): HTMLButtonElement {
	const btn = createEl(doc, 'button', 'pptxv-thumb');
	btn.type = 'button';
	btn.dataset.slideIndex = String(index);
	btn.dataset.pptxChrome = 'slide-row';
	btn.setAttribute('aria-label', t('pptx.slidesPanel.goToSlide', { n: index + 1 }));
	const num = createEl(doc, 'span', 'pptxv-thumb-num');
	num.textContent = String(index + 1);
	num.dataset.pptxChrome = 'slide-number';
	const frame = createEl(doc, 'span', 'pptxv-thumb-frame', {
		display: 'block',
		width: `${EDITOR_THUMBNAIL_WIDTH}px`,
		height: `${editorThumbnailHeight(canvasSize.width, canvasSize.height)}px`,
	});
	frame.dataset.pptxChrome = 'slide-frame';
	frame.appendChild(renderStage(slide, scale));
	btn.append(num, frame);
	// A slide the author hid still lists here (hiding is a slide-show rule),
	// so it needs the shared cue: the dim + number slash come off the marker
	// attribute in CSS, and the description carries the state to assistive
	// tech without disturbing the "Go to slide {{n}}" accessible name.
	const cue = hiddenSlideCue(slide.hidden, 'rail', index);
	if (cue.marker && cue.labelId) {
		btn.setAttribute(HIDDEN_SLIDE_ATTRIBUTE, cue.marker);
		btn.setAttribute('aria-describedby', cue.labelId);
		const badge = createEl(doc, 'span', 'pptxv-thumb-hidden');
		badge.id = cue.labelId;
		badge.appendChild(createIcon(doc, 'eye-off'));
		const word = createEl(doc, 'span', 'pptxv-sr-only');
		word.textContent = t(HIDDEN_SLIDE_LABEL_KEY);
		badge.appendChild(word);
		frame.appendChild(badge);
	}
	return btn;
}

export function createThumbnailMasterRows(
	doc: Document,
	t: Translator,
	masters: readonly PptxSlideMaster[],
	canvasSize: CanvasSize,
	renderStage: (slide: PptxSlide, scale: number) => HTMLElement,
	select: (masterIndex: number, layoutIndex: number | null) => void,
	active: { masterIndex: number; layoutIndex: number | null },
): HTMLButtonElement[] {
	const items: HTMLButtonElement[] = [];
	const scale = EDITOR_THUMBNAIL_WIDTH / Math.max(canvasSize.width, 1);
	const add = (
		slide: PptxSlide,
		label: string,
		masterIndex: number,
		layoutIndex: number | null,
	) => {
		const btn = createEl(
			doc,
			'button',
			`pptxv-thumb${layoutIndex === null ? '' : ' pptxv-master-layout'}`,
		);
		btn.type = 'button';
		btn.setAttribute('aria-label', label);
		btn.classList.toggle(
			'is-active',
			active.masterIndex === masterIndex && active.layoutIndex === layoutIndex,
		);
		if (active.masterIndex === masterIndex && active.layoutIndex === layoutIndex) {
			btn.setAttribute('aria-current', 'page');
		}
		const name = createEl(doc, 'span', 'pptxv-thumb-num');
		name.textContent = label;
		const frame = createEl(doc, 'span', 'pptxv-thumb-frame', {
			display: 'block',
			width: `${EDITOR_THUMBNAIL_WIDTH}px`,
			height: `${Math.round(canvasSize.height * scale)}px`,
		});
		frame.appendChild(renderStage(slide, scale));
		btn.append(name, frame);
		btn.addEventListener('click', () => select(masterIndex, layoutIndex));
		items.push(btn);
	};
	masters.forEach((master, masterIndex) => {
		add(
			{
				id: master.path,
				rId: '',
				slideNumber: 0,
				elements: master.elements ?? [],
				backgroundColor: master.backgroundColor,
				backgroundImage: master.backgroundImage,
			},
			master.name || t('pptx.master.master'),
			masterIndex,
			null,
		);
		master.layouts?.forEach((layout, layoutIndex) =>
			add(
				{
					id: layout.path,
					rId: '',
					slideNumber: 0,
					elements: [...(master.elements ?? []), ...(layout.elements ?? [])],
					backgroundColor: layout.backgroundColor ?? master.backgroundColor,
					backgroundImage: layout.backgroundImage ?? master.backgroundImage,
				},
				layout.name || t('pptx.master.layout'),
				masterIndex,
				layoutIndex,
			),
		);
	});
	return items;
}

export function createThumbnailFooter(
	doc: Document,
	t: Translator,
	onAddSlide: () => void,
): HTMLElement {
	const footer = createEl(doc, 'div', 'pptxv-thumbs-footer');
	footer.dataset.pptxChrome = 'slide-footer';
	footer.hidden = true;
	const addBtn = createEl(doc, 'button', 'pptxv-thumbs-add');
	addBtn.type = 'button';
	addBtn.appendChild(createIcon(doc, 'plus'));
	addBtn.appendChild(doc.createTextNode(t('pptx.sections.addSlide')));
	addBtn.addEventListener('click', () => onAddSlide());
	footer.appendChild(addBtn);
	return footer;
}
