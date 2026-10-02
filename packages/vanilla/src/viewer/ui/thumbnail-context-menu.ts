/**
 * The slides pane's thumbnail right-click menu: New Slide, Duplicate, Delete,
 * Layout, Hide, Add Section. Sibling of `canvas-context-menu.ts` (the
 * empty-canvas menu). The command list is NOT decided here: it comes from
 * `buildSlidePaneContextMenuEntries`, this module is only the view (position,
 * render, dismiss) and the routing from a command id to an editor operation.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import { buildSlidePaneContextMenuEntries, slidePaneViewItems } from 'pptx-viewer-shared';
import type { SlidePaneContextMenuCommandId } from 'pptx-viewer-shared';

import type { EditActions } from '../editor';
import { collectLayoutOptions } from '../editor/editing-chrome-sync';
import type { Translator } from '../i18n';
import type { Store, ViewerState } from '../state';
import { mountContextMenuSurface } from './context-menu-surface';
import type { ContextMenuSurface } from './context-menu-surface';
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

export function createThumbnailContextMenu(deps: ThumbnailContextMenuDeps): ThumbnailContextMenu {
	const { doc, store } = deps;
	let menu: ContextMenuSurface | null = null;
	let layoutPopup: ContextMenuSurface | null = null;
	const parent = (): HTMLElement => deps.host.closest<HTMLElement>('.pptxv') ?? doc.body;

	const close = (): void => {
		menu?.close();
		menu = null;
		layoutPopup?.close();
		layoutPopup = null;
	};

	/** "Layout": a plain named list of the deck's layouts, applied to `index`. */
	const openLayoutList = (index: number, x: number, y: number): void => {
		layoutPopup?.close();
		layoutPopup = mountContextMenuSurface({
			doc,
			parent: parent(),
			state: {
				x,
				y,
				label: deps.getTranslator()('pptx.master.layout'),
				items: collectLayoutOptions(store.get()).map((option) => ({
					id: option.path,
					label: option.name,
				})),
			},
			onRequest: (path) => {
				close();
				store.set({ currentSlide: index });
				deps.getEditActions().applyLayout(path);
			},
			onClose: close,
		});
	};

	const run = (id: SlidePaneContextMenuCommandId, state: ThumbnailContextMenuState): void => {
		switch (id) {
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
				menu?.close();
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
			const t = deps.getTranslator();
			menu = mountContextMenuSurface({
				doc,
				parent: parent(),
				state: {
					x: state.x,
					y: state.y,
					label: t('pptx.slidesPane.contextMenu.newSlide'),
					markers: ['data-pptx-context-menu', 'data-pptx-slide-pane-context-menu'],
					items: slidePaneViewItems(entries, t, selected.length),
				},
				onRequest: (id) => run(id as SlidePaneContextMenuCommandId, state),
				onClose: close,
			});
		},
		close,
		destroy: close,
	};
}
