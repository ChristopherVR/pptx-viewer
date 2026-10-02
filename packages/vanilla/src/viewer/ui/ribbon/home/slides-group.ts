import type { PptxLayoutPreview } from 'pptx-viewer-core';
import { slidesHomeControls } from 'pptx-viewer-shared';
import type { LayoutPreviewGeometry, SlideTemplateId } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import type { LayoutOption } from '../ribbon-types';
import { createSharedHomeStrip } from './shared-strip';
import { createSlideTemplateDialog } from './slide-template-dialog';

/**
 * Renders one layout's artwork into a detached element. Injected so the host
 * owns the element-renderer registry and theme wiring.
 */
export type LayoutPreviewRenderer = (
	preview: PptxLayoutPreview,
	geometry: LayoutPreviewGeometry,
) => HTMLElement | undefined;

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
	/** The shared Slides group element. */
	el: HTMLElement;
	update(state: SlidesGroupState): void;
}

/**
 * The ribbon Home tab's Slides group. The group, its buttons, the layout
 * galleries and their gating are the shared `pptx-ui-ribbon-home-slides`
 * element; this binding draws each tile's artwork, keeps the Slide Templates
 * dialog and runs every document edit.
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
	let last: Parameters<typeof slidesHomeControls>[0] = {
		editable: false,
		hasLayouts: false,
		hasSlides: false,
		showTemplates: true,
		newSlideNeedsLayout: false,
		resetNeedsSlide: true,
	};
	let layouts: readonly LayoutOption[] = [];
	const strip = createSharedHomeStrip(doc, t, 'slides', ({ id, value }) => {
		switch (id) {
			case 'home.slides.newSlide': {
				const layout = layouts.find((entry) => entry.path === value);
				if (layout) {
					handlers.insertSlideFromLayout(layout.path, layout.name);
				} else {
					handlers.addSlide();
				}
				break;
			}
			case 'home.slides.slideTemplates':
				templateDialog.open(strip.el.closest<HTMLElement>('.pptxv') ?? doc.body);
				break;
			case 'home.slides.layout':
				handlers.applyLayout(String(value));
				break;
			case 'home.slides.reset':
				handlers.resetSlide();
				break;
			case 'home.slides.section':
				handlers.addSection();
		}
	});
	strip.el.layoutArtwork = (preview, geometry, container) => {
		const artwork = handlers.renderLayoutPreview?.(preview, geometry);
		if (artwork) {
			container.append(artwork);
		}
		return () => artwork?.remove();
	};
	strip.set(slidesHomeControls(last));

	return {
		el: strip.el,
		update({ editable, slideCount, layouts: next, layoutPreviews, currentLayoutPath }) {
			layouts = next;
			last = {
				...last,
				editable,
				hasLayouts: next.length > 0,
				hasSlides: slideCount > 0,
				layouts: {
					layouts: next.map(({ path, name }) => ({ path, name })),
					current: currentLayoutPath,
					previews: layoutPreviews ?? new Map(),
				},
			};
			if (!editable) {
				templateDialog.close();
			}
			strip.set(slidesHomeControls(last));
		},
	};
}
