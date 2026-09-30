import type { PptxSection, PptxSlide, PptxSlideMaster } from 'pptx-viewer-core';
import {
	computeVirtualRange,
	EDITOR_THUMBNAIL_WIDTH,
	EDITOR_SLIDE_RAIL_WIDTH,
	editorThumbnailStep,
	SLIDE_VIRTUALIZATION_THRESHOLD,
} from 'pptx-viewer-shared';
import type { CanvasSize } from 'pptx-viewer-shared';

import type { EditActions } from '../editor';
import type { Translator } from '../i18n';
import { collectThreeViews, createEl, withReusableThreeViews } from '../render';
import type { Store, ViewerState } from '../state';
import { createThumbnailContextMenu } from './thumbnail-context-menu';
import { wireThumbnailRowEvents } from './thumbnail-events';
import { createThumbnailRailMenu } from './thumbnail-rail-menu';
import type { ThumbnailSectionActions } from './thumbnail-sections';
import { renderThumbnailSections } from './thumbnail-sections';
import {
	createThumbnailFooter,
	createThumbnailMasterRows,
	createThumbnailRow,
} from './thumbnail-views';

export type { ThumbnailSectionActions } from './thumbnail-sections';

/** The item-2 multi-select/context-menu deps; all optional so existing callers keep working. */
export interface ThumbnailRailMenuDeps {
	store: Store<ViewerState>;
	getEditActions(): EditActions;
	addSlideAfter(index: number): void;
	duplicateSlides(indexes: number[]): void;
	deleteSlides(indexes: number[]): void;
	toggleHideSlides(indexes: number[]): void;
}

const THUMB_STAGE_WIDTH = EDITOR_THUMBNAIL_WIDTH;

export interface ThumbnailRail {
	el: HTMLElement;
	/** Rebuild the rail for a new slide list (uses `renderStage` per slide). */
	render(
		slides: PptxSlide[],
		canvasSize: CanvasSize,
		renderStage: (slide: PptxSlide, scale: number) => HTMLElement,
		sections?: readonly PptxSection[],
		sectionActions?: ThumbnailSectionActions,
	): void;
	/** Highlight the active slide and scroll it into view. */
	setActive(index: number): void;
	/** Show or hide the rail. */
	setVisible(visible: boolean): void;
	/** Show or hide the pinned Add Slide footer (editing enabled only). */
	setAddSlideVisible(visible: boolean): void;
	renderMasters(
		masters: readonly PptxSlideMaster[],
		canvasSize: CanvasSize,
		renderStage: (slide: PptxSlide, scale: number) => HTMLElement,
		onSelect: (masterIndex: number, layoutIndex: number | null) => void,
		active: { masterIndex: number; layoutIndex: number | null },
	): void;
}

/**
 * The thumbnail sidebar: a scaled-down live render of every slide; clicking a
 * thumbnail navigates to it. Rebuilt only when the slide list changes.
 */
export function createThumbnailRail(
	doc: Document,
	t: Translator,
	onSelect: (index: number) => void,
	onAddSlide?: () => void,
	menuDeps?: ThumbnailRailMenuDeps,
): ThumbnailRail {
	const el = createEl(doc, 'aside', 'pptxv-thumbs');
	el.setAttribute('role', 'navigation');
	el.dataset.pptxChrome = 'slides';
	el.style.width = `${EDITOR_SLIDE_RAIL_WIDTH}px`;
	el.setAttribute('aria-label', t('pptx.sections.slides'));

	// ── Ctrl/Shift multi-select + thumbnail right-click menu ────────────────
	const railMenu = createThumbnailRailMenu();
	const contextMenu = menuDeps
		? createThumbnailContextMenu({
				doc,
				store: menuDeps.store,
				getTranslator: () => t,
				getEditActions: menuDeps.getEditActions,
				addSlideAfter: menuDeps.addSlideAfter,
				duplicateSlides: menuDeps.duplicateSlides,
				deleteSlides: menuDeps.deleteSlides,
				toggleHideSlides: menuDeps.toggleHideSlides,
				host: el,
			})
		: null;
	// PowerPoint's Enter on a focused thumbnail inserts a new slide after it.
	el.addEventListener('keydown', (event) => {
		if (event.key !== 'Enter' || !menuDeps) {
			return;
		}
		const target = event.target;
		if (target instanceof HTMLElement && target.dataset.slideIndex !== undefined) {
			event.preventDefault();
			menuDeps.addSlideAfter(activeIndex);
		}
	});
	// Scrollable slide list; the Add Slide footer stays pinned below it
	// (mirrors React's SlidesPaneSidebar bottom button).
	const list = createEl(doc, 'div', 'pptxv-thumbs-list');
	list.dataset.pptxChrome = 'slide-list';
	el.appendChild(list);
	let footer: HTMLElement | null = null;
	let addSlideVisible = false;
	let masterMode = false;
	const applyFooterVisibility = (): void => {
		if (footer) {
			footer.hidden = !addSlideVisible || masterMode;
		}
	};
	if (onAddSlide) {
		footer = createThumbnailFooter(doc, t, onAddSlide);
		el.appendChild(footer);
	}
	let buttons = new Map<number, HTMLButtonElement>();
	let activeIndex = 0;
	let sourceSlides: PptxSlide[] = [];
	let sourceCanvasSize: CanvasSize = { width: 1, height: 1 };
	let sourceRenderStage: ((slide: PptxSlide, scale: number) => HTMLElement) | null = null;
	let sourceSections: readonly PptxSection[] = [];
	let sourceSectionActions: ThumbnailSectionActions | undefined;
	let itemHeight = 1;
	let virtualized = false;

	const buildButton = (slide: PptxSlide, index: number, scale: number): HTMLButtonElement => {
		const btn = createThumbnailRow(
			doc,
			t,
			slide,
			index,
			sourceCanvasSize,
			sourceRenderStage!,
			scale,
		);
		wireThumbnailRowEvents(btn, slide, index, {
			selection: railMenu,
			menu: contextMenu,
			getSlides: () => sourceSlides,
			getActive: () => activeIndex,
			onSelect,
		});
		buttons.set(index, btn);
		return btn;
	};

	// Keep live 3D thumbnail scenes across selection, edits and scrolling.
	const renderWindow = (): void => withReusableThreeViews(collectThreeViews(list), renderWindowNow);

	const renderWindowNow = (): void => {
		if (!sourceRenderStage) {
			return;
		}
		buttons = new Map();
		const scale = THUMB_STAGE_WIDTH / Math.max(sourceCanvasSize.width, 1);
		if (sourceSections.length > 0) {
			list.replaceChildren(
				...renderThumbnailSections({
					doc,
					t,
					sections: sourceSections,
					slides: sourceSlides,
					actions: sourceSectionActions,
					buildSlide: (slide, index) => buildButton(slide, index, scale),
				}),
			);
			buttons.get(activeIndex)?.classList.add('is-active');
			buttons.get(activeIndex)?.setAttribute('aria-current', 'page');
			return;
		}
		const range = virtualized
			? computeVirtualRange(
					sourceSlides.length,
					itemHeight,
					list.scrollTop,
					list.clientHeight || 600,
				)
			: computeVirtualRange(
					sourceSlides.length,
					itemHeight,
					0,
					sourceSlides.length * itemHeight,
					0,
				);
		const window = createEl(doc, 'div', 'pptxv-thumbs-window', {
			display: 'flex',
			flexDirection: 'column',
		});
		window.dataset.pptxChrome = 'slide-window';
		if (virtualized) {
			window.style.position = 'absolute';
			window.style.insetInline = '0';
			window.style.top = `${range.offsetY}px`;
		}
		for (let index = range.startIndex; index <= range.endIndex; index += 1) {
			const slide = sourceSlides[index];
			if (slide) {
				window.appendChild(buildButton(slide, index, scale));
			}
		}
		const space = createEl(doc, 'div', 'pptxv-thumbs-space', {
			position: 'relative',
			height: virtualized ? `${range.totalHeight}px` : 'auto',
		});
		if (virtualized) {
			space.dataset.virtualized = 'true';
		}
		space.appendChild(window);
		list.replaceChildren(space);
		const active = buttons.get(activeIndex);
		active?.classList.add('is-active');
		active?.setAttribute('aria-current', 'page');
	};

	list.addEventListener('scroll', () => {
		if (virtualized) {
			renderWindow();
		}
	});

	return {
		el,
		render(slides, canvasSize, renderStage, sections, sectionActions) {
			masterMode = false;
			applyFooterVisibility();
			sourceSlides = slides;
			sourceCanvasSize = canvasSize;
			sourceRenderStage = renderStage;
			sourceSections = sections ?? [];
			sourceSectionActions = sectionActions;
			itemHeight = editorThumbnailStep(canvasSize.width, canvasSize.height);
			virtualized = !sections?.length && slides.length >= SLIDE_VIRTUALIZATION_THRESHOLD;
			// Class toggle (not an inline display) so the presenting-mode and
			// mobile-layout `display: none` stylesheet rules can still hide the
			// rail; an inline style would override them and leak thumbnail text
			// into presentation mode.
			el.classList.toggle('pptxv-thumbs-virtualized', virtualized);
			renderWindow();
			this.setActive(activeIndex);
		},
		setActive(index) {
			activeIndex = index;
			if (virtualized) {
				const top = index * itemHeight;
				const bottom = top + itemHeight;
				const viewport = list.clientHeight || 600;
				if (top < list.scrollTop) {
					list.scrollTop = top;
				} else if (bottom > list.scrollTop + viewport) {
					list.scrollTop = Math.max(0, bottom - viewport);
				}
				renderWindow();
			}
			buttons.forEach((btn, buttonIndex) => {
				btn.classList.toggle('is-active', buttonIndex === index);
				if (buttonIndex === index) {
					btn.setAttribute('aria-current', 'page');
				} else {
					btn.removeAttribute('aria-current');
				}
			});
			const active = buttons.get(index);
			if (active && typeof active.scrollIntoView === 'function') {
				active.scrollIntoView({ block: 'nearest' });
			}
		},
		setVisible(visible) {
			el.hidden = !visible;
		},
		setAddSlideVisible(visible) {
			addSlideVisible = visible;
			applyFooterVisibility();
		},
		renderMasters(masters, canvasSize, renderStage, select, active) {
			masterMode = true;
			applyFooterVisibility();
			list.replaceChildren();
			buttons = new Map();
			virtualized = false;
			el.classList.remove('pptxv-thumbs-virtualized');
			list.append(
				...createThumbnailMasterRows(doc, t, masters, canvasSize, renderStage, select, active),
			);
		},
	};
}
