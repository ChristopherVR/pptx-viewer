import type { PptxLayoutPreview } from 'pptx-viewer-core';
import { buildLayoutPreviewGeometry, isCurrentLayout } from 'pptx-viewer-shared';
import type { LayoutPreviewGeometry, SlideTemplateId } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import { createIcon } from '../../icons';
import type { LayoutOption } from '../ribbon-types';
import { createSlideTemplateDialog } from './slide-template-dialog';

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

/**
 * Renders one layout's artwork into a detached element.
 *
 * Injected rather than imported so this module keeps to DOM assembly and the
 * host owns the element-renderer registry and theme wiring.
 */
export type LayoutPreviewRenderer = (
	preview: PptxLayoutPreview,
	geometry: LayoutPreviewGeometry,
) => HTMLElement | undefined;

/** Thumbnail box size, matching PowerPoint's gallery tiles. */
const THUMB_WIDTH = 128;
const THUMB_HEIGHT = 72;

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

/** A layout picker popover: repopulated on every `setItems`, closes on select/outside. */
interface LayoutMenu {
	el: HTMLElement;
	setItems(layouts: readonly LayoutOption[], context: LayoutMenuContext): void;
	toggle(): void;
	close(): void;
}

/** What the tiles need beyond the layout list itself. */
interface LayoutMenuContext {
	previews: ReadonlyMap<string, PptxLayoutPreview>;
	/** Marks the active tile. Omitted by New Slide, which has no "current". */
	currentLayoutPath?: string;
	/** Renders one layout's artwork; supplied by the host so this file stays DOM-only. */
	renderPreview?: LayoutPreviewRenderer;
}

function createLayoutMenu(
	doc: Document,
	ariaLabel: string,
	onPick: (layout: LayoutOption) => void,
): LayoutMenu {
	const el = createEl(doc, 'div', 'pptxv-primary-menu pptxv-layout-menu');
	// Shared cross-binding hook the framework-neutral e2e specs select on.
	el.dataset.testid = 'layout-gallery-menu';
	el.setAttribute('role', 'menu');
	el.setAttribute('aria-label', ariaLabel);
	el.hidden = true;

	let open = false;
	const setOpen = (next: boolean): void => {
		open = next;
		el.hidden = !next;
	};

	doc.addEventListener('pointerdown', (event) => {
		if (open && !el.parentElement?.contains(event.target as Node)) {
			setOpen(false);
		}
	});

	return {
		el,
		setItems(layouts, context) {
			el.replaceChildren();
			for (const layout of layouts) {
				const btn = createEl(doc, 'button', 'pptxv-layout-tile');
				btn.type = 'button';
				btn.setAttribute('role', 'menuitem');
				if (isCurrentLayout(layout, context.currentLayoutPath)) {
					btn.classList.add('pptxv-layout-tile-current');
					btn.setAttribute('aria-current', 'true');
				}
				btn.appendChild(
					buildLayoutThumbnail(doc, context.previews.get(layout.path), context.renderPreview),
				);
				const name = createEl(doc, 'span', 'pptxv-layout-tile-name');
				name.textContent = layout.name;
				btn.appendChild(name);
				btn.title = layout.name;
				btn.addEventListener('click', () => {
					setOpen(false);
					onPick(layout);
				});
				el.appendChild(btn);
			}
		},
		toggle: () => setOpen(!open),
		close: () => setOpen(false),
	};
}

/**
 * Build one thumbnail: the layout's artwork drawn at slide scale, with the
 * placeholder frames outlined on top.
 *
 * The artwork is rendered full size on an inner surface and the whole surface
 * is scaled, so element positions need no conversion. The shared geometry
 * helper decides the scale and pre-divides the outline width so it does not
 * shrink to an invisible hairline.
 */
function buildLayoutThumbnail(
	doc: Document,
	preview: PptxLayoutPreview | undefined,
	renderPreview: LayoutPreviewRenderer | undefined,
): HTMLElement {
	const geometry = buildLayoutPreviewGeometry(preview, THUMB_WIDTH, THUMB_HEIGHT);

	const box = createEl(doc, 'div', 'pptxv-layout-tile-thumb');
	box.style.width = `${geometry.boxWidth}px`;
	box.style.height = `${geometry.boxHeight}px`;
	box.style.backgroundColor = geometry.backgroundColor;

	const surface = createEl(doc, 'div', 'pptxv-layout-tile-surface');
	surface.style.width = `${geometry.surfaceWidth}px`;
	surface.style.height = `${geometry.surfaceHeight}px`;
	surface.style.transform = `scale(${geometry.scale})`;

	const artwork = preview && renderPreview ? renderPreview(preview, geometry) : undefined;
	if (artwork) {
		surface.appendChild(artwork);
	}

	for (const frame of geometry.frames) {
		const outline = createEl(doc, 'div', 'pptxv-layout-tile-frame');
		outline.style.left = `${frame.left}px`;
		outline.style.top = `${frame.top}px`;
		outline.style.width = `${frame.width}px`;
		outline.style.height = `${frame.height}px`;
		outline.style.borderWidth = `${geometry.frameBorderWidth}px`;
		surface.appendChild(outline);
	}

	box.appendChild(surface);
	return box;
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
	const row = createEl(doc, 'div', 'pptxv-rgroup-row');
	el.appendChild(row);
	const label = createEl(doc, 'span', 'pptxv-rgroup-label');
	label.textContent = t('pptx.sections.slides');
	el.appendChild(label);

	// -- New Slide split button (main + layout-dropdown caret) ----------------
	const newSlideSplit = createEl(doc, 'div', 'pptxv-slides-split');
	const add = makeButton(doc, {
		label: t('pptx.home.newSlide'),
		icon: 'new-slide',
		textLabel: t('pptx.home.newSlide'),
		onClick: handlers.addSlide,
	});
	const caret = createEl(doc, 'button', 'pptxv-slides-caret');
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
		icon: 'undo',
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
