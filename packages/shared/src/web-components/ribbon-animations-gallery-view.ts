import { animationsGated, animationsLabel } from '../render';
import type { RibbonAnimationsViewState } from '../render';

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

/**
 * An always-visible captioned button strip. Every effect is a real button in
 * the accessibility tree (never behind a hover menu), and the strip scrolls
 * rather than growing so the ribbon keeps its single-row height.
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
	const captions: HTMLElement[] = [];
	const buttons: { el: HTMLButtonElement; item: AnimationsGalleryItem }[] = [];
	columns.forEach((column) => {
		const el = doc.createElement('div');
		el.className = 'column';
		const caption = doc.createElement('span');
		caption.className = 'caption';
		captions.push(caption);
		const items = doc.createElement('div');
		items.className = 'items';
		for (const item of column.items) {
			const button = doc.createElement('button');
			button.type = 'button';
			button.className = 'preset';
			// Opts out of a native binding's generic button size reset.
			button.dataset.pptxCompact = '';
			button.dataset.tone = column.tone;
			button.dataset.animationPreset = item.value;
			button.addEventListener('click', () => pick(column.key, item.value));
			// Native Space/Enter activation must not reach slide-navigation handlers.
			button.addEventListener('keydown', (event) => {
				if (event.key === ' ' || event.key === 'Enter') {
					event.stopPropagation();
				}
			});
			items.append(button);
			buttons.push({ el: button, item });
		}
		el.append(caption, items);
		root.append(el);
	});
	const sync = (state: RibbonAnimationsViewState) => {
		root.setAttribute('aria-label', animationsLabel(state, aria[0], aria[1]));
		columns.forEach((column, index) => {
			captions[index].textContent = animationsLabel(state, column.labelKey, column.fallback);
		});
		const gated = animationsGated(state);
		for (const { el, item } of buttons) {
			const label = animationsLabel(state, item.labelKey, item.fallback);
			el.textContent = label;
			el.title = label;
			el.disabled = gated;
		}
	};
	return { el: root, sync };
}
