import type { PptxLayoutPreview } from 'pptx-viewer-core';
import type { SlideTemplateId } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import { createIcon } from '../../icons';
import { tagRibbonControl, tagRibbonGroup } from '../ribbon-tagging';
import type { LayoutOption } from '../ribbon-types';
import { createLayoutMenu } from './layout-menu';
import type { LayoutPreviewRenderer } from './layout-menu';
import { createSlideTemplateDialog } from './slide-template-dialog';

export type { LayoutPreviewRenderer } from './layout-menu';

export interface SlidesGroupHandlers {
	addSlide(): void;
	insertSlideFromLayout(layoutPath: string, layoutName?: string): void;
	/** Insert a pre-designed starter slide from the shared template catalog. */
	insertSlideFromTemplate(templateId: SlideTemplateId): void;
	applyLayout(layoutPath: string): void;
	resetSlide(): void;
	addSection(): void;
	/** Deck scheme map so template previews show the deck's theme colours. */
	getTemplateScheme?(): Record<string, string> | undefined;
	/** Renders one layout's artwork for a gallery thumbnail. */
	renderLayoutPreview?: LayoutPreviewRenderer;
}

export interface SlidesGroupState {
	editable: boolean;
	slideCount: number;
	layouts: readonly LayoutOption[];
	/** Artwork by layout path; tiles stay name-only until it arrives. */
	layoutPreviews?: ReadonlyMap<string, PptxLayoutPreview>;
	/** `layoutPath` of the active slide, marking the current gallery tile. */
	currentLayoutPath?: string;
}

export interface SlidesGroup {
	el: HTMLElement;
	update(state: SlidesGroupState): void;
}

/**
 * The ribbon Home tab's Slides group, mirroring React's `SlidesGroup`: a New
 * Slide split button (with a layout dropdown), a Layout dropdown, a Reset
 * button, and a Section button. Duplicate/delete are reached elsewhere (context
 * menu / thumbnail rail), matching React.
 */
export function createSlidesGroup(
	doc: Document,
	t: Translator,
	handlers: SlidesGroupHandlers,
): SlidesGroup {
	const el = createEl(doc, 'div', 'pptxv-rgroup');
	el.dataset.pptxChrome = 'home-group';
	tagRibbonGroup(el, 'home.slides');
	const row = createEl(doc, 'div', 'pptxv-rgroup-row');
	row.dataset.pptxChrome = 'slides-controls';
	el.appendChild(row);
	const label = createEl(doc, 'span', 'pptxv-rgroup-label');
	label.dataset.pptxChrome = 'ribbon-group-label';
	label.textContent = t('pptx.sections.slides');
	el.appendChild(label);

	// -- New Slide split button (main + layout-dropdown caret) ----------------
	const newSlideSplit = createEl(doc, 'div', 'pptxv-slides-split');
	newSlideSplit.dataset.pptxChrome = 'split-button';
	const add = makeButton(doc, {
		label: t('pptx.home.newSlide'),
		icon: 'plus',
		textLabel: t('pptx.home.newSlide'),
		onClick: handlers.addSlide,
	});
	const caret = createEl(doc, 'button', 'pptxv-slides-caret');
	add.btn.dataset.pptxChrome = 'split-main';
	caret.dataset.pptxChrome = 'split-caret';
	caret.type = 'button';
	caret.title = t('pptx.home.chooseLayout');
	caret.setAttribute('aria-label', t('pptx.home.chooseLayout'));
	caret.setAttribute('aria-haspopup', 'menu');
	caret.appendChild(createIcon(doc, 'chevron-down'));
	const newSlideMenu = createLayoutMenu(doc, t('pptx.home.chooseLayout'), (layout) =>
		handlers.insertSlideFromLayout(layout.path, layout.name),
	);
	caret.addEventListener('click', (event) => {
		event.stopPropagation();
		newSlideMenu.toggle();
	});
	newSlideSplit.append(add.btn, caret, newSlideMenu.el);

	// -- Slide Templates gallery (React's LuLayoutTemplate pill) ---------------
	const templateDialog = createSlideTemplateDialog(doc, t, {
		onInsert: (templateId) => handlers.insertSlideFromTemplate(templateId),
		getScheme: () => handlers.getTemplateScheme?.(),
	});
	const templates = makeButton(doc, {
		label: t('pptx.home.slideTemplates'),
		icon: 'slide-templates',
		textLabel: t('pptx.home.slideTemplates'),
		onClick: () => {
			const host = templates.btn.closest<HTMLElement>('.pptxv') ?? doc.body;
			templateDialog.open(host);
		},
	});

	// -- Layout dropdown -------------------------------------------------------
	const layoutHost = createEl(doc, 'div', 'pptxv-slides-menu-host');
	const layout = makeButton(doc, {
		label: t('pptx.master.layout'),
		icon: 'layout',
		textLabel: t('pptx.master.layout'),
		onClick: () => layoutMenu.toggle(),
	});
	layout.btn.setAttribute('aria-haspopup', 'menu');
	const layoutMenu = createLayoutMenu(doc, t('pptx.master.layout'), (l) =>
		handlers.applyLayout(l.path),
	);
	layoutHost.append(layout.btn, layoutMenu.el);

	// -- Reset + Section pills -------------------------------------------------
	// The accessible name is the visible pill text in every binding; the longer
	// phrasing stays as the hover tooltip.
	const reset = makeButton(doc, {
		label: t('pptx.animations.reset'),
		icon: 'rotate-ccw',
		textLabel: t('pptx.animations.reset'),
		onClick: handlers.resetSlide,
	});
	reset.btn.title = t('pptx.sections.resetSlideTitle');
	const section = makeButton(doc, {
		label: t('pptx.sections.sectionButtonLabel'),
		icon: 'folder-plus',
		textLabel: t('pptx.sections.sectionButtonLabel'),
		onClick: handlers.addSection,
	});
	section.btn.title = t('pptx.sections.addSection');

	tagRibbonControl(newSlideSplit, 'home.slides.newSlide');
	tagRibbonControl(templates.btn, 'home.slides.slideTemplates');
	tagRibbonControl(layoutHost, 'home.slides.layout');
	tagRibbonControl(reset.btn, 'home.slides.reset');
	tagRibbonControl(section.btn, 'home.slides.section');
	row.append(newSlideSplit, templates.btn, layoutHost, reset.btn, section.btn);

	return {
		el,
		update({ editable, slideCount, layouts, layoutPreviews, currentLayoutPath }) {
			const hasLayouts = layouts.length > 0;
			const previews = layoutPreviews ?? new Map<string, PptxLayoutPreview>();
			newSlideMenu.setItems(layouts, { previews, renderPreview: handlers.renderLayoutPreview });
			layoutMenu.setItems(layouts, {
				previews,
				currentLayoutPath,
				renderPreview: handlers.renderLayoutPreview,
			});
			add.setDisabled(!editable);
			// The caret only appears when there are layouts to choose (React parity).
			caret.hidden = !hasLayouts;
			caret.disabled = !editable;
			templates.setDisabled(!editable);
			layout.setDisabled(!editable || !hasLayouts);
			reset.setDisabled(!editable || slideCount === 0);
			section.setDisabled(!editable || slideCount === 0);
			if (!editable) {
				newSlideMenu.close();
				layoutMenu.close();
				templateDialog.close();
			}
		},
	};
}
