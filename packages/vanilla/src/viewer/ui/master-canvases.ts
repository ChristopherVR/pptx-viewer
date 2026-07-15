import type { PptxHandoutMaster, PptxNotesMaster } from 'pptx-viewer-core';
import type { CanvasSize } from 'pptx-viewer-shared';
import { computeHandoutSlotLayout, NOTES_MASTER_PLACEHOLDER_RECTS } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';

const LABEL_KEYS: Record<string, string> = {
	sldImg: 'pptx.master.notesMasterSlideImage',
	body: 'pptx.master.notesMasterBody',
	hdr: 'pptx.master.notesMasterHeader',
	ftr: 'pptx.master.notesMasterFooter',
	dt: 'pptx.master.notesMasterDate',
	sldNum: 'pptx.master.notesMasterPageNumber',
};

function page(doc: Document, className: string, size: CanvasSize, color?: string): HTMLElement {
	const el = createEl(doc, 'div', `pptxv-master-page ${className}`);
	el.style.width = `${size.width}px`;
	el.style.height = `${size.height}px`;
	el.style.backgroundColor = color ?? '#ffffff';
	return el;
}

export function renderNotesMasterCanvas(
	doc: Document,
	t: Translator,
	master: PptxNotesMaster | undefined,
	size: CanvasSize,
): HTMLElement {
	if (!master) {
		const empty = createEl(doc, 'div', 'pptxv-master-canvas-empty');
		empty.dataset.testid = 'notes-master-empty';
		empty.textContent = t('pptx.master.noNotesMaster');
		return empty;
	}
	const el = page(doc, 'pptxv-notes-master-page', size, master.backgroundColor);
	el.dataset.testid = 'notes-master-page';
	const placeholders = master.placeholders ?? [
		{ type: 'sldImg' },
		{ type: 'body' },
		{ type: 'hdr' },
		{ type: 'ftr' },
		{ type: 'dt' },
		{ type: 'sldNum' },
	];
	for (const ph of placeholders) {
		const position = NOTES_MASTER_PLACEHOLDER_RECTS[ph.type];
		if (!position) {
			continue;
		}
		const region = createEl(doc, 'div', `pptxv-notes-region is-${ph.type}`);
		region.dataset.region = ph.type;
		region.style.left = `${position.x * size.width}px`;
		region.style.top = `${position.y * size.height}px`;
		region.style.width = `${position.w * size.width}px`;
		region.style.height = `${position.h * size.height}px`;
		region.textContent = t(LABEL_KEYS[ph.type] ?? ph.type);
		el.appendChild(region);
	}
	return el;
}

export const computeHandoutSlots = computeHandoutSlotLayout;

export function renderHandoutMasterCanvas(
	doc: Document,
	t: Translator,
	master: PptxHandoutMaster | undefined,
	size: CanvasSize,
	slidesPerPage: number,
): HTMLElement {
	if (!master) {
		const empty = createEl(doc, 'div', 'pptxv-master-canvas-empty');
		empty.dataset.testid = 'handout-master-empty';
		empty.textContent = t('pptx.master.noHandoutMaster');
		return empty;
	}
	const el = page(doc, 'pptxv-handout-master-page', size, master.backgroundColor);
	el.dataset.testid = 'handout-master-page';
	for (const [index, slot] of computeHandoutSlots(slidesPerPage).entries()) {
		const region = createEl(doc, 'div', 'pptxv-handout-slot');
		region.dataset.testid = 'handout-slot';
		region.style.left = `${slot.x * size.width}px`;
		region.style.top = `${slot.y * size.height}px`;
		region.style.width = `${slot.w * size.width}px`;
		region.style.height = `${slot.h * size.height}px`;
		region.textContent = t('pptx.master.handoutSlideSlot', { number: index + 1 });
		el.appendChild(region);
	}
	for (const [className, key] of [
		['is-top-left', 'pptx.master.notesMasterHeader'],
		['is-top-right', 'pptx.master.notesMasterDate'],
		['is-bottom-left', 'pptx.master.notesMasterFooter'],
		['is-bottom-right', 'pptx.master.notesMasterPageNumber'],
	] as const) {
		const corner = createEl(doc, 'div', `pptxv-handout-corner ${className}`);
		corner.textContent = t(key);
		el.appendChild(corner);
	}
	return el;
}
