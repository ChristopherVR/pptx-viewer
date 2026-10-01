import type { PptxLayoutPreview } from 'pptx-viewer-core';
import { slidesHomeControls } from 'pptx-viewer-shared';
import type { SlideTemplateId } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import type { LayoutOption } from '../ribbon-types';
import { createLayoutMenu } from './layout-menu';
import type { LayoutPreviewRenderer } from './layout-menu';
import { createSharedHomeStrip } from './shared-strip';
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
	/** The shared Slides group element; native layout menus mount inside its anchors. */
	el: HTMLElement;
	update(state: SlidesGroupState): void;
}

/**
 * The ribbon Home tab's Slides group. The group, its buttons and their gating
 * are the shared `pptx-ui-ribbon-home-slides` element; this binding keeps the
 * native layout menus (anchored inside the shared New Slide split and Layout
 * wrappers), the Slide Templates dialog and every document edit.
 */
export function createSlidesGroup(
	doc: Document,
	t: Translator,
	handlers: SlidesGroupHandlers,
): SlidesGroup {
	const templateDialog = createSlideTemplateDialog(doc, t, {
		onInsert: (templateId) => handlers.insertSlideFromTemplate(templateId),
		getScheme: () => handlers.getTemplateScheme?.(),
	});
	let last: Omit<Parameters<typeof slidesHomeControls>[0], 'layoutOpen' | 'newSlideOpen'> = {
		editable: false,
		hasLayouts: false,
		hasSlides: false,
		showTemplates: true,
		newSlideNeedsLayout: false,
		resetNeedsSlide: true,
	};
	const open = { newSlide: false, layout: false };
	const sync = () =>
		strip.set(
			slidesHomeControls({ ...last, newSlideOpen: open.newSlide, layoutOpen: open.layout }),
		);
	const newSlideMenu = createLayoutMenu(
		doc,
		t('pptx.home.chooseLayout'),
		(layout) => handlers.insertSlideFromLayout(layout.path, layout.name),
		(next) => {
			open.newSlide = next;
			sync();
		},
	);
	const layoutMenu = createLayoutMenu(
		doc,
		t('pptx.master.layout'),
		(layout) => handlers.applyLayout(layout.path),
		(next) => {
			open.layout = next;
			sync();
		},
	);
	const strip = createSharedHomeStrip(doc, t, 'slides', ({ id, part }) => {
		switch (id) {
			case 'home.slides.newSlide':
				if (part === 'caret') {
					newSlideMenu.toggle();
				} else {
					handlers.addSlide();
				}
				break;
			case 'home.slides.slideTemplates':
				templateDialog.open(strip.el.closest<HTMLElement>('.pptxv') ?? doc.body);
				break;
			case 'home.slides.layout':
				layoutMenu.toggle();
				break;
			case 'home.slides.reset':
				handlers.resetSlide();
				break;
			case 'home.slides.section':
				handlers.addSection();
		}
	});
	const el = strip.el;
	el.anchor('home.slides.newSlide')?.append(newSlideMenu.el);
	el.anchor('home.slides.layout')?.append(layoutMenu.el);
	sync();

	return {
		el,
		update({ editable, slideCount, layouts, layoutPreviews, currentLayoutPath }) {
			const previews = layoutPreviews ?? new Map<string, PptxLayoutPreview>();
			newSlideMenu.setItems(layouts, { previews, renderPreview: handlers.renderLayoutPreview });
			layoutMenu.setItems(layouts, {
				previews,
				currentLayoutPath,
				renderPreview: handlers.renderLayoutPreview,
			});
			last = { ...last, editable, hasLayouts: layouts.length > 0, hasSlides: slideCount > 0 };
			if (!editable) {
				newSlideMenu.close();
				layoutMenu.close();
				templateDialog.close();
			}
			sync();
		},
	};
}
