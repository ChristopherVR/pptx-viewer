/**
 * The slides pane's thumbnail right-click menu: New Slide, Duplicate, Delete,
 * Layout, Hide, Add Section. Sibling of `canvas-context-menu.ts` (the
 * empty-canvas menu). The command list is NOT decided here: it comes from
 * `buildSlidePaneContextMenuEntries`, this module is only the view (position,
 * render, dismiss) and the routing from a command id to an editor operation.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import { buildSlidePaneContextMenuEntries, clampFlyoutPosition } from 'pptx-viewer-shared';
import type { SlidePaneContextMenuEntry } from 'pptx-viewer-shared';

import type { EditActions } from '../editor';
import { collectLayoutOptions } from '../editor/editing-chrome-sync';
import type { Translator } from '../i18n';
import { createEl } from '../render';
import type { Store, ViewerState } from '../state';
import type { ThumbnailContextMenuState } from './thumbnail-rail-menu';

export interface ThumbnailContextMenuDeps {
	doc: Document;
	store: Store<ViewerState>;
	getTranslator(): Translator;
	/** For "Layout" (`applyLayout`) and "Add Section" (`sections.addSection`). */
	getEditActions(): EditActions;
	/** Insert a new slide after the right-clicked one. */
	addSlideAfter(index: number): void;
	duplicateSlides(indexes: number[]): void;
	deleteSlides(indexes: number[]): void;
	toggleHideSlides(indexes: number[]): void;
	/** The scrollable rail element the menu is mounted beside. */
	host: HTMLElement;
}

export interface ThumbnailContextMenu {
	/** Open the menu for `state`, given the current slide list. */
	open(state: ThumbnailContextMenuState, slides: readonly PptxSlide[]): void;
	close(): void;
	destroy(): void;
}

/** Keep the menu inside the window; shared two-sided clamp (see `canvas-context-menu.ts`). */
function positionAt(menu: HTMLElement, doc: Document, x: number, y: number): void {
	const view = doc.defaultView;
	const box = menu.getBoundingClientRect();
	const { left, top } = clampFlyoutPosition({
		x,
		y,
		width: box.width,
		height: box.height,
		viewportWidth: view?.innerWidth ?? box.right,
		viewportHeight: view?.innerHeight ?? box.bottom,
		margin: 4,
	});
	menu.style.left = `${left}px`;
	menu.style.top = `${top}px`;
}

export function createThumbnailContextMenu(deps: ThumbnailContextMenuDeps): ThumbnailContextMenu {
	const { doc, store } = deps;
	let menu: HTMLElement | null = null;
	let layoutPopup: HTMLElement | null = null;
	let onDismiss: ((event: Event) => void) | null = null;

	const close = (): void => {
		menu?.remove();
		menu = null;
		layoutPopup?.remove();
		layoutPopup = null;
		if (onDismiss) {
			doc.removeEventListener('pointerdown', onDismiss, true);
			doc.removeEventListener('keydown', onDismiss, true);
			onDismiss = null;
		}
	};

	/** "Layout": a plain named list of the deck's layouts, applied to `index`. */
	const openLayoutList = (index: number, x: number, y: number): void => {
		layoutPopup?.remove();
		const list = createEl(doc, 'div', 'pptxv-context-menu', { left: `${x}px`, top: `${y}px` });
		list.setAttribute('role', 'menu');
		list.setAttribute('aria-label', deps.getTranslator()('pptx.master.layout'));
		for (const option of collectLayoutOptions(store.get())) {
			const btn = createEl(doc, 'button', 'pptxv-context-menu-item');
			btn.type = 'button';
			btn.setAttribute('role', 'menuitem');
			btn.textContent = option.name;
			btn.addEventListener('click', () => {
				store.set({ currentSlide: index });
				deps.getEditActions().applyLayout(option.path);
				close();
			});
			list.appendChild(btn);
		}
		(deps.host.closest<HTMLElement>('.pptxv') ?? doc.body).appendChild(list);
		positionAt(list, doc, x, y);
		layoutPopup = list;
	};

	const buildItem = (
		entry: SlidePaneContextMenuEntry,
		state: ThumbnailContextMenuState,
		selectedCount: number,
	): HTMLElement => {
		const button = createEl(doc, 'button', 'pptxv-context-menu-item');
		button.type = 'button';
		button.setAttribute('role', 'menuitem');
		button.textContent = entry.countLabelKey
			? deps.getTranslator()(entry.labelKey, { count: selectedCount })
			: deps.getTranslator()(entry.labelKey);
		button.disabled = entry.disabled === true;
		button.addEventListener('click', () => {
			switch (entry.id) {
				case 'new-slide':
					close();
					deps.addSlideAfter(state.index);
					break;
				case 'duplicate':
					close();
					deps.duplicateSlides(state.selectedIndexes);
					break;
				case 'delete':
					close();
					deps.deleteSlides(state.selectedIndexes);
					break;
				case 'layout':
					menu?.remove();
					menu = null;
					openLayoutList(state.index, state.x, state.y);
					break;
				case 'hide':
					close();
					deps.toggleHideSlides(state.selectedIndexes);
					break;
				case 'add-section':
					close();
					deps
						.getEditActions()
						.sections.addSection(deps.getTranslator()('pptx.sections.defaultName'), state.index);
					break;
				default:
					close();
			}
		});
		return button;
	};

	return {
		open(state, slides) {
			close();
			const selected = state.selectedIndexes
				.map((i) => slides[i])
				.filter((s): s is PptxSlide => Boolean(s));
			const entries = buildSlidePaneContextMenuEntries({
				selectedCount: selected.length,
				hasHiddenInSelection: selected.some((s) => s.hidden),
				hasVisibleInSelection: selected.some((s) => !s.hidden),
				wouldDeleteAllSlides: selected.length >= slides.length,
			});
			menu = createEl(doc, 'div', 'pptxv-context-menu', {
				left: `${state.x}px`,
				top: `${state.y}px`,
			});
			menu.dataset.pptxContextMenu = 'true';
			menu.dataset.pptxSlidePaneContextMenu = 'true';
			menu.setAttribute('role', 'menu');
			menu.setAttribute('aria-label', deps.getTranslator()('pptx.slidesPane.contextMenu.newSlide'));
			for (const entry of entries) {
				if (entry.separatorBefore) {
					const separator = createEl(doc, 'div', 'pptxv-context-menu-separator');
					separator.setAttribute('role', 'separator');
					menu.appendChild(separator);
				}
				menu.appendChild(buildItem(entry, state, selected.length));
			}
			(deps.host.closest<HTMLElement>('.pptxv') ?? doc.body).appendChild(menu);
			positionAt(menu, doc, state.x, state.y);

			onDismiss = (event: Event): void => {
				if (event instanceof KeyboardEvent && event.key !== 'Escape') {
					return;
				}
				const target = event.target;
				if (target instanceof Node && (menu?.contains(target) || layoutPopup?.contains(target))) {
					return;
				}
				close();
			};
			doc.addEventListener('pointerdown', onDismiss, true);
			doc.addEventListener('keydown', onDismiss, true);
		},
		close,
		destroy: close,
	};
}
