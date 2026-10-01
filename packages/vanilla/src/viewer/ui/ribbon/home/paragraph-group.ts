import type { TextStyle } from 'pptx-viewer-core';
import type {
	PptxUiRibbonHomeElement,
	RibbonHomeAlign,
	RibbonHomeRequestEvent,
} from 'pptx-viewer-shared';
import {
	FIXED_TAB_GALLERIES,
	LINE_SPACING_OPTIONS,
	paragraphHomeAction,
	paragraphHomeAlign,
	paragraphHomeControls,
	registerPptxWebControls,
} from 'pptx-viewer-shared';

import type { TextFormatState } from '../../../editor/editor-format-mutations';
import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import { makeDropdown } from '../../dropdown';
import type { RibbonGalleryHub } from '../gallery/gallery-hub';
import { createRibbonGalleryHub } from '../gallery/gallery-hub';
import { createRibbonGallery } from '../gallery/ribbon-gallery';
import { tagRibbonControl, tagRibbonGroup } from '../ribbon-tagging';

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

/** PowerPoint's four text-flow directions, in React's Text Direction menu order. */
const TEXT_DIRECTIONS: ReadonlyArray<{
	value: NonNullable<TextStyle['textDirection']>;
	labelKey: string;
}> = [
	{ value: 'horizontal', labelKey: 'pptx.slideInspector.horizontal' },
	{ value: 'vertical', labelKey: 'pptx.ribbon.textDirectionRotate90' },
	{ value: 'vertical270', labelKey: 'pptx.ribbon.textDirectionRotate270' },
	{ value: 'wordArtVert', labelKey: 'pptx.ribbon.textDirectionStacked' },
];

const COLUMN_COUNTS: ReadonlyArray<{ count: number; labelKey: string }> = [
	{ count: 1, labelKey: 'pptx.ribbon.columns1' },
	{ count: 2, labelKey: 'pptx.ribbon.columns2' },
	{ count: 3, labelKey: 'pptx.ribbon.columns3' },
];

export interface ParagraphGroupState {
	canFormat: boolean;
	editable: boolean;
	text: TextFormatState;
}

export interface ParagraphGroup {
	el: HTMLElement;
	update(state: ParagraphGroupState): void;
}

/**
 * A list toggle plus the chevron that drops its shared library gallery
 * (Bullets / Numbering), tagged as one catalogue control.
 */
function listToggleWithGallery(
	doc: Document,
	t: Translator,
	toggle: HTMLElement,
	control: 'home.paragraph.bullets' | 'home.paragraph.numbering',
	hub: RibbonGalleryHub,
): HTMLElement {
	const placement = FIXED_TAB_GALLERIES.find((entry) => entry.control === control);
	const wrap = tagRibbonControl(createEl(doc, 'div', 'pptxv-split-gallery'), control);
	wrap.appendChild(toggle);
	if (placement) {
		wrap.appendChild(createRibbonGallery(doc, t, placement, hub, { chevronOnly: true }).el);
	}
	return wrap;
}

/** The ribbon Home tab's Paragraph group: bullets/numbering, indent, align, line spacing. */
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
	el.appendChild(row);
	const label = createEl(doc, 'span', 'pptxv-rgroup-label');
	label.dataset.pptxChrome = 'ribbon-group-label';
	label.textContent = t('pptx.ribbon.paragraph');
	el.appendChild(label);

	const bullets = makeButton(doc, {
		label: t('pptx.text.bulletList'),
		icon: 'bullet-list',
		onClick: handlers.toggleBulletList,
	});
	const numbered = makeButton(doc, {
		label: t('pptx.text.numberedList'),
		icon: 'numbered-list',
		onClick: handlers.toggleNumberedList,
	});
	// Keep the active editor/caret: focusing a list button would commit on blur
	// before its formatting command runs. Keyboard activation is unchanged.
	for (const { btn } of [bullets, numbered]) {
		btn.addEventListener('mousedown', (event) => event.preventDefault());
	}
	// Indent and alignment are the shared strip; its intent maps onto the handlers.
	const strip = doc.createElement('pptx-ui-ribbon-home-paragraph') as PptxUiRibbonHomeElement;
	let stripState = { enabled: false, align: undefined as RibbonHomeAlign | undefined };
	const syncStrip = () => {
		strip.state = {
			controls: paragraphHomeControls({ enabled: stripState.enabled, align: stripState.align }),
			translate: t,
		};
	};
	strip.addEventListener('home-request', (event) => {
		const action = paragraphHomeAction((event as RibbonHomeRequestEvent).detail.id);
		if (action?.kind === 'indent') {
			(action.delta > 0 ? handlers.increaseIndent : handlers.decreaseIndent)();
		} else if (action?.kind === 'align') {
			handlers.setTextAlign(action.align);
		}
	});
	syncStrip();
	const lineSpacing = makeDropdown(doc, {
		triggerLabel: t('pptx.paragraph.lineSpacing'),
		triggerText: '',
		icon: 'line-spacing',
		items: LINE_SPACING_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
		onSelect: handlers.setLineSpacing,
	});
	lineSpacing.el.querySelector('.pptxv-dropdown-text')?.remove();

	const textDirection = makeDropdown(doc, {
		triggerLabel: t('pptx.paragraph.textDirection'),
		triggerText: '',
		icon: 'text-direction',
		items: TEXT_DIRECTIONS.map((d) => ({ label: t(d.labelKey), value: d.value })),
		onSelect: handlers.setTextDirection,
	});
	textDirection.el.querySelector('.pptxv-dropdown-text')?.remove();

	const columns = makeDropdown(doc, {
		triggerLabel: t('pptx.paragraph.columns'),
		triggerText: '',
		icon: 'columns',
		items: COLUMN_COUNTS.map((option) => ({
			label: t(option.labelKey),
			value: option.count,
		})),
		onSelect: handlers.setColumnCount,
	});
	columns.el.querySelector('.pptxv-dropdown-text')?.remove();

	tagRibbonControl(lineSpacing.el, 'home.paragraph.lineSpacing');
	tagRibbonControl(textDirection.el, 'home.paragraph.textDirection');
	tagRibbonControl(columns.el, 'home.paragraph.columns');
	row.append(
		listToggleWithGallery(doc, t, bullets.btn, 'home.paragraph.bullets', galleryHub),
		listToggleWithGallery(doc, t, numbered.btn, 'home.paragraph.numbering', galleryHub),
		strip,
		lineSpacing.el,
		textDirection.el,
		columns.el,
	);

	const gated = [bullets, numbered, lineSpacing, textDirection, columns];

	return {
		el,
		update({ canFormat, editable, text }) {
			bullets.setActive(text.listType === 'bullet');
			numbered.setActive(text.listType === 'numbered');
			lineSpacing.setSelected(text.lineSpacing);
			for (const c of gated) {
				c.setDisabled(!editable || !canFormat);
			}
			stripState = { enabled: editable && canFormat, align: paragraphHomeAlign(text.align) };
			syncStrip();
		},
	};
}
