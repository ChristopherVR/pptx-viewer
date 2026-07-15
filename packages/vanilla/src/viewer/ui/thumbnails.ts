import type { PptxSlide, PptxSlideMaster } from 'pptx-viewer-core';
import type { CanvasSize } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';

/** Rendered thumbnail rail width available for each slide preview, in px. */
const THUMB_STAGE_WIDTH = 128;

export interface ThumbnailRail {
	el: HTMLElement;
	/** Rebuild the rail for a new slide list (uses `renderStage` per slide). */
	render(
		slides: PptxSlide[],
		canvasSize: CanvasSize,
		renderStage: (slide: PptxSlide, scale: number) => HTMLElement,
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
	let buttons: HTMLButtonElement[] = [];
	let activeIndex = 0;

	return {
		el,
		render(slides, canvasSize, renderStage) {
			el.replaceChildren();
			buttons = [];
			const scale = THUMB_STAGE_WIDTH / Math.max(canvasSize.width, 1);
			slides.forEach((slide, index) => {
				const btn = createEl(doc, 'button', 'pptxv-thumb');
				btn.type = 'button';
				btn.setAttribute('aria-label', t('pptx.slidesPanel.goToSlide', { n: index + 1 }));

				const num = createEl(doc, 'span', 'pptxv-thumb-num');
				num.textContent = String(index + 1);
				btn.appendChild(num);

				const frame = createEl(doc, 'span', 'pptxv-thumb-frame', {
					display: 'block',
					width: `${THUMB_STAGE_WIDTH}px`,
					height: `${Math.round(canvasSize.height * scale)}px`,
				});
				frame.appendChild(renderStage(slide, scale));
				btn.appendChild(frame);

				btn.addEventListener('click', () => onSelect(index));
				el.appendChild(btn);
				buttons.push(btn);
			});
			this.setActive(activeIndex);
		},
		setActive(index) {
			activeIndex = index;
			buttons.forEach((btn, i) => {
				btn.classList.toggle('is-active', i === index);
				if (i === index) {
					btn.setAttribute('aria-current', 'page');
				} else {
					btn.removeAttribute('aria-current');
				}
			});
			const active = buttons[index];
			if (active && typeof active.scrollIntoView === 'function') {
				active.scrollIntoView({ block: 'nearest' });
			}
		},
		setVisible(visible) {
			el.hidden = !visible;
		},
		renderMasters(masters, canvasSize, renderStage, select, active) {
			el.replaceChildren();
			buttons = [];
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
