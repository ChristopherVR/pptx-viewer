/**
 * The slide-show right-click menu, shown while presenting when Options >
 * Advanced > "Show menu on right mouse click" is on.
 *
 * Item order/grouping/i18n keys come from the shared
 * `getPresentationContextMenuSections` (`pptx-viewer-shared`), the same
 * source React's `PresentationContextMenu` and Vue/Angular/Svelte's own
 * ports render from, so this menu cannot drift from theirs. The rows,
 * clamping, keyboard navigation and dismissal belong to the shared
 * `pptx-ui-context-menu` (see `context-menu-surface.ts`).
 */
import {
	CONTEXT_MENU_PRESENTATION_LAYER,
	getPresentationContextMenuSections,
	presentationViewItems,
} from 'pptx-viewer-shared';
import type { PresentationContextMenuActionId } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import type { Store, ViewerState } from '../state';
import { mountContextMenuSurface } from './context-menu-surface';
import type { ContextMenuSurface } from './context-menu-surface';

export interface PresentationContextMenuDeps {
	doc: Document;
	store: Store<ViewerState>;
	/** The element the menu is mounted under (the `.pptxv` root). */
	root: HTMLElement;
	getTranslator(): Translator;
	/** File > Options > Advanced > "Show menu on right mouse click". */
	shouldShow(): boolean;
	next(): void;
	prev(): void;
	exitPresentation(): void;
	showAllSlides(): void;
	togglePresenterView(): void;
	setPointerTool(tool: 'none' | 'pen' | 'highlighter' | 'laser'): void;
	eraseAnnotations(): void;
	toggleBlank(value: 'black' | 'white'): void;
}

export interface PresentationContextMenu {
	destroy(): void;
}

/** Attach the slide-show right-click menu to the presentation root. */
export function mountPresentationContextMenu(
	deps: PresentationContextMenuDeps,
): PresentationContextMenu {
	const { doc, store, root } = deps;
	let menu: ContextMenuSurface | null = null;

	const close = (): void => {
		menu?.close();
		menu = null;
	};

	const run = (id: PresentationContextMenuActionId): void => {
		switch (id) {
			case 'next':
				deps.next();
				break;
			case 'previous':
				deps.prev();
				break;
			case 'seeAllSlides':
				deps.showAllSlides();
				break;
			case 'presenterView':
				deps.togglePresenterView();
				break;
			case 'pointerArrow':
				deps.setPointerTool('none');
				break;
			case 'pointerPen':
				deps.setPointerTool('pen');
				break;
			case 'pointerHighlighter':
				deps.setPointerTool('highlighter');
				break;
			case 'pointerLaser':
				deps.setPointerTool('laser');
				break;
			case 'eraseInk':
				deps.eraseAnnotations();
				break;
			case 'blankBlack':
				deps.toggleBlank('black');
				break;
			case 'blankWhite':
				deps.toggleBlank('white');
				break;
			case 'endShow':
				deps.exitPresentation();
				break;
		}
	};

	const open = (x: number, y: number): void => {
		const t = deps.getTranslator();
		const sections = getPresentationContextMenuSections({
			seeAllSlides: true,
			presenterView: true,
			pointerTools: true,
			eraseInk: true,
			blankBlack: true,
			blankWhite: true,
		});
		menu = mountContextMenuSurface({
			doc,
			parent: root,
			state: {
				x,
				y,
				label: t('pptx.presentation.menuLabel'),
				markers: ['data-pptx-presentation-menu'],
				zIndex: CONTEXT_MENU_PRESENTATION_LAYER,
				items: presentationViewItems(sections, t),
			},
			onRequest: (id) => {
				close();
				run(id as PresentationContextMenuActionId);
			},
			onClose: close,
		});
	};

	const onContextMenu = (event: MouseEvent): void => {
		if (!store.get().presenting) {
			return;
		}
		event.preventDefault();
		close();
		if (!deps.shouldShow()) {
			return;
		}
		open(event.clientX, event.clientY);
	};

	root.addEventListener('contextmenu', onContextMenu);

	return {
		destroy() {
			root.removeEventListener('contextmenu', onContextMenu);
			close();
		},
	};
}
