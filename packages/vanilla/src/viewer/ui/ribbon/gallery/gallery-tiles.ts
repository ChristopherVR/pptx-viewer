import type {
	RibbonGalleryDescriptor,
	RibbonGalleryItem,
	RibbonGallerySection,
} from 'pptx-viewer-shared';
import { galleryItemLabel, RIBBON_GALLERY_ITEM_ATTR } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';

/** `t(key)`, or `fallback` when the dictionary has no entry (the translator echoes the key). */
export function translateOr(t: Translator, key: string | undefined, fallback: string): string {
	if (!key) {
		return fallback;
	}
	const translated = t(key);
	return translated && translated !== key ? translated : fallback;
}

/**
 * One gallery tile. Its content is the descriptor's `previewSvg`, which shared
 * builds only from catalogue data and theme colours (never user text), so it
 * is injected as markup; everything else is set as text / attributes.
 */
export function createGalleryTile(
	doc: Document,
	t: Translator,
	item: RibbonGalleryItem,
	disabled: boolean,
	onPick: (item: RibbonGalleryItem) => void,
): HTMLButtonElement {
	const tile = createEl(doc, 'button', 'pptxv-gallery-tile');
	tile.type = 'button';
	tile.setAttribute(RIBBON_GALLERY_ITEM_ATTR, item.id);
	tile.setAttribute('aria-pressed', String(item.applied));
	tile.classList.toggle('is-applied', item.applied);
	const label = galleryItemLabel(item, t);
	tile.title = label;
	tile.setAttribute('aria-label', label);
	tile.innerHTML = item.previewSvg;
	tile.disabled = disabled;
	// Keep the canvas selection / inline editor focused while picking.
	tile.addEventListener('mousedown', (event) => event.preventDefault());
	tile.addEventListener('click', () => onPick(item));
	return tile;
}

function renderSection(
	doc: Document,
	t: Translator,
	section: RibbonGallerySection,
	disabled: boolean,
	onPick: (item: RibbonGalleryItem) => void,
): HTMLElement {
	const el = createEl(doc, 'div', 'pptxv-gallery-section');
	el.dataset.gallerySection = section.id;
	if (section.titleKey || section.title) {
		const heading = createEl(doc, 'div', 'pptxv-gallery-heading');
		heading.textContent = translateOr(t, section.titleKey, section.title ?? '');
		el.appendChild(heading);
	}
	const grid = createEl(doc, 'div', 'pptxv-gallery-grid');
	grid.style.gridTemplateColumns = `repeat(${Math.max(1, section.columns)}, max-content)`;
	for (const item of section.items) {
		grid.appendChild(createGalleryTile(doc, t, item, disabled, onPick));
	}
	el.appendChild(grid);
	return el;
}

/** Fill the dropped-down panel with every section of `descriptor`. */
export function renderGalleryPopup(
	doc: Document,
	t: Translator,
	popup: HTMLElement,
	descriptor: RibbonGalleryDescriptor,
	disabled: boolean,
	onPick: (item: RibbonGalleryItem) => void,
): void {
	popup.replaceChildren(
		...descriptor.sections
			.filter((section) => section.items.length > 0)
			.map((section) => renderSection(doc, t, section, disabled, onPick)),
	);
}
