import { animationsGated, animationsLabel } from '../render';
import type { RibbonAnimationsViewState } from '../render';
import { RIBBON_ANIMATION_ICON_PATHS } from './ribbon-animations-icons';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CHEVRON_PATH = 'M5 7.5 10 12.5 15 7.5';

export interface AnimationsGalleryItem {
	value: string;
	labelKey: string;
	fallback: string;
}

export interface AnimationsGalleryColumn {
	key: string;
	labelKey: string;
	fallback: string;
	tone: string;
	items: readonly AnimationsGalleryItem[];
}

function icon(doc: Document, d: string, className: string): SVGSVGElement {
	const svg = doc.createElementNS(SVG_NS, 'svg');
	svg.setAttribute('viewBox', '0 0 20 20');
	svg.setAttribute('aria-hidden', 'true');
	svg.setAttribute('class', className);
	const path = doc.createElementNS(SVG_NS, 'path');
	path.setAttribute('d', d);
	svg.append(path);
	return svg;
}

/**
 * PowerPoint's in-ribbon gallery: one row of icon-over-label tiles that scrolls
 * sideways, closed by a chevron that pages the strip (the ribbon keeps its
 * single-row height). Every effect stays a real button in the accessibility
 * tree (never behind a hover menu); effect families are separated by a rule and
 * named by an accessible group.
 */
export function createAnimationsGalleryView(
	doc: Document,
	controlId: string,
	aria: readonly [key: string, fallback: string],
	columns: readonly AnimationsGalleryColumn[],
	pick: (columnKey: string, value: string) => void,
) {
	const root = doc.createElement('div');
	root.className = 'gallery';
	root.dataset.ribbonControl = controlId;
	root.setAttribute('role', 'group');
	const strip = doc.createElement('div');
	strip.className = 'strip';
	const columnEls: HTMLElement[] = [];
	const buttons: { el: HTMLButtonElement; item: AnimationsGalleryItem }[] = [];
	columns.forEach((column) => {
		const el = doc.createElement('div');
		el.className = 'column';
		el.setAttribute('role', 'group');
		columnEls.push(el);
		for (const item of column.items) {
			const button = doc.createElement('button');
			button.type = 'button';
			button.className = 'preset';
			// Opts out of a native binding's generic button size reset.
			button.dataset.pptxCompact = '';
			button.dataset.tone = column.tone;
			button.dataset.animationPreset = item.value;
			const name = doc.createElement('span');
			name.className = 'name';
			button.append(
				icon(
					doc,
					column.tone === 'path'
						? RIBBON_ANIMATION_ICON_PATHS.moveRight
						: RIBBON_ANIMATION_ICON_PATHS.star,
					'tile-icon',
				),
				name,
			);
			button.addEventListener('click', () => pick(column.key, item.value));
			// Native Space/Enter activation must not reach slide-navigation handlers.
			button.addEventListener('keydown', (event) => {
				if (event.key === ' ' || event.key === 'Enter') {
					event.stopPropagation();
				}
			});
			el.append(button);
			buttons.push({ el: button, item });
		}
		strip.append(el);
	});
	const more = doc.createElement('button');
	more.type = 'button';
	more.className = 'more';
	more.dataset.pptxCompact = '';
	more.append(icon(doc, CHEVRON_PATH, 'more-icon'));
	more.addEventListener('click', () => {
		const atEnd = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 2;
		strip.scrollTo({ left: atEnd ? 0 : strip.scrollLeft + strip.clientWidth * 0.8 });
	});
	root.append(strip, more);
	const sync = (state: RibbonAnimationsViewState) => {
		root.setAttribute('aria-label', animationsLabel(state, aria[0], aria[1]));
		const moreLabel = animationsLabel(state, 'pptx.animations.moreEffects', 'More Effects');
		more.setAttribute('aria-label', moreLabel);
		more.title = moreLabel;
		columns.forEach((column, index) => {
			columnEls[index].setAttribute(
				'aria-label',
				animationsLabel(state, column.labelKey, column.fallback),
			);
		});
		const gated = animationsGated(state);
		for (const { el, item } of buttons) {
			const label = animationsLabel(state, item.labelKey, item.fallback);
			el.querySelector('.name')!.textContent = label;
			el.title = label;
			el.disabled = gated;
		}
	};
	return { el: root, sync };
}
