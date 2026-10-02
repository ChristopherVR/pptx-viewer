import type { TextStyle } from 'pptx-viewer-core';
import type { RibbonGalleryId } from 'pptx-viewer-shared';
import {
	homeGalleryControls,
	paragraphHomeAction,
	paragraphHomeAlign,
	paragraphHomeControls,
	registerPptxWebControls,
	withHomeGalleries,
} from 'pptx-viewer-shared';

import type { TextFormatState } from '../../../editor/editor-format-mutations';
import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import type { RibbonGalleryHub } from '../gallery/gallery-hub';
import { createRibbonGalleryHub } from '../gallery/gallery-hub';
import { tagRibbonGroup } from '../ribbon-tagging';
import { createSharedHomeStrip } from './shared-strip';

export interface ParagraphGroupHandlers {
	toggleBulletList(): void;
	toggleNumberedList(): void;
	increaseIndent(): void;
	decreaseIndent(): void;
	setTextAlign(align: TextStyle['align']): void;
	setLineSpacing(value: number): void;
	setTextDirection(direction: NonNullable<TextStyle['textDirection']>): void;
	setColumnCount(count: number): void;
}

export interface ParagraphGroupState {
	canFormat: boolean;
	editable: boolean;
	text: TextFormatState;
}

export interface ParagraphGroup {
	el: HTMLElement;
	update(state: ParagraphGroupState): void;
}

const GALLERY_BY_CONTROL: Record<string, RibbonGalleryId> = {
	'home.paragraph.bullets': 'bullets',
	'home.paragraph.numbering': 'numbering',
};

/**
 * The Home tab's Paragraph group. Bullets and Numbering (with their library
 * galleries), indent, alignment, line spacing, text direction and columns are
 * the shared Paragraph strip; picks route to the native editing handlers.
 */
export function createParagraphGroup(
	doc: Document,
	t: Translator,
	handlers: ParagraphGroupHandlers,
	galleryHub: RibbonGalleryHub = createRibbonGalleryHub(() => {}),
): ParagraphGroup {
	registerPptxWebControls();
	const el = createEl(doc, 'div', 'pptxv-rgroup');
	el.dataset.pptxChrome = 'home-group';
	tagRibbonGroup(el, 'home.paragraph');
	const row = createEl(doc, 'div', 'pptxv-rgroup-row');
	row.dataset.pptxChrome = 'paragraph-controls';
	const label = createEl(doc, 'span', 'pptxv-rgroup-label');
	label.dataset.pptxChrome = 'ribbon-group-label';
	label.textContent = t('pptx.ribbon.paragraph');
	el.append(row, label);

	const strip = createSharedHomeStrip(doc, t, 'paragraph', ({ id, value }) => {
		if (value !== undefined) {
			if (id === 'home.paragraph.lineSpacing') {
				handlers.setLineSpacing(Number(value));
			} else if (id === 'home.paragraph.textDirection') {
				handlers.setTextDirection(value as NonNullable<TextStyle['textDirection']>);
			} else if (id === 'home.paragraph.columns') {
				handlers.setColumnCount(Number(value));
			} else if (GALLERY_BY_CONTROL[id]) {
				galleryHub.pick(GALLERY_BY_CONTROL[id], String(value));
			}
			return;
		}
		if (id === 'home.paragraph.bullets') {
			handlers.toggleBulletList();
		} else if (id === 'home.paragraph.numbering') {
			handlers.toggleNumberedList();
		}
		const action = paragraphHomeAction(id);
		if (action?.kind === 'indent') {
			(action.delta > 0 ? handlers.increaseIndent : handlers.decreaseIndent)();
		} else if (action?.kind === 'align') {
			handlers.setTextAlign(action.align);
		}
	});
	row.append(strip.el);

	let last = { enabled: false, editable: false, text: undefined as TextFormatState | undefined };
	const render = () => {
		const { text } = last;
		const base = paragraphHomeControls({
			enabled: last.enabled,
			align: paragraphHomeAlign(text?.align),
			list: text?.listType === 'bullet' || text?.listType === 'numbered' ? text.listType : 'none',
			lineSpacing: text?.lineSpacing,
		});
		strip.set(
			withHomeGalleries(
				base,
				homeGalleryControls('paragraph', galleryHub.context(), last.editable),
				last.editable,
			),
		);
	};
	// The gallery descriptors follow the selection and theme, which the hub pushes.
	galleryHub.register({ refresh: render, close: () => {} });

	return {
		el,
		update({ canFormat, editable, text }) {
			last = { enabled: editable && canFormat, editable, text };
			render();
		},
	};
}
