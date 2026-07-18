import type { PptxSection, PptxSlide, PptxSlideMaster } from 'pptx-viewer-core';
import { computeVirtualRange, SLIDE_VIRTUALIZATION_THRESHOLD } from 'pptx-viewer-shared';
import type { CanvasSize } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import type { ThumbnailSectionActions } from './thumbnail-sections';
import { renderThumbnailSections } from './thumbnail-sections';

export type { ThumbnailSectionActions } from './thumbnail-sections';

/** Rendered thumbnail rail width available for each slide preview, in px. */
const THUMB_STAGE_WIDTH = 128;

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
): ThumbnailRail {
	const el = createEl(doc, 'aside', 'pptxv-thumbs');
	el.setAttribute('role', 'navigation');
	el.setAttribute('aria-label', t('pptx.sections.slides'));
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
		const btn = createEl(doc, 'button', 'pptxv-thumb');
		btn.type = 'button';
		btn.dataset.slideIndex = String(index);
		btn.setAttribute('aria-label', t('pptx.slidesPanel.goToSlide', { n: index + 1 }));
		const num = createEl(doc, 'span', 'pptxv-thumb-num');
		num.textContent = String(index + 1);
		const frame = createEl(doc, 'span', 'pptxv-thumb-frame', {
			display: 'block',
			width: `${THUMB_STAGE_WIDTH}px`,
			height: `${Math.round(sourceCanvasSize.height * scale)}px`,
		});
		frame.appendChild(sourceRenderStage!(slide, scale));
		btn.append(num, frame);
		btn.addEventListener('click', () => onSelect(index));
		buttons.set(index, btn);
		return btn;
	};

	const renderWindow = (): void => {
		if (!sourceRenderStage) {
			return;
		}
		buttons = new Map();
		const scale = THUMB_STAGE_WIDTH / Math.max(sourceCanvasSize.width, 1);
		if (sourceSections.length > 0) {
			el.replaceChildren(
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
			return;
		}
		const range = virtualized
			? computeVirtualRange(sourceSlides.length, itemHeight, el.scrollTop, el.clientHeight || 600)
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
			gap: '8px',
		});
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
		el.replaceChildren(space);
		const active = buttons.get(activeIndex);
		active?.classList.add('is-active');
		active?.setAttribute('aria-current', 'page');
	};

	el.addEventListener('scroll', () => {
		if (virtualized) {
			renderWindow();
		}
	});

	return {
		el,
		render(slides, canvasSize, renderStage, sections, sectionActions) {
			sourceSlides = slides;
			sourceCanvasSize = canvasSize;
			sourceRenderStage = renderStage;
			sourceSections = sections ?? [];
			sourceSectionActions = sectionActions;
			const scale = THUMB_STAGE_WIDTH / Math.max(canvasSize.width, 1);
			itemHeight = Math.round(canvasSize.height * scale) + 8;
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
				const viewport = el.clientHeight || 600;
				if (top < el.scrollTop) {
					el.scrollTop = top;
				} else if (bottom > el.scrollTop + viewport) {
					el.scrollTop = Math.max(0, bottom - viewport);
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
		renderMasters(masters, canvasSize, renderStage, select, active) {
			el.replaceChildren();
			buttons = new Map();
			virtualized = false;
			el.classList.remove('pptxv-thumbs-virtualized');
			const scale = THUMB_STAGE_WIDTH / Math.max(canvasSize.width, 1);
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
					width: `${THUMB_STAGE_WIDTH}px`,
					height: `${Math.round(canvasSize.height * scale)}px`,
				});
				frame.appendChild(renderStage(slide, scale));
				btn.append(name, frame);
				btn.addEventListener('click', () => select(masterIndex, layoutIndex));
				el.appendChild(btn);
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
		},
	};
}
