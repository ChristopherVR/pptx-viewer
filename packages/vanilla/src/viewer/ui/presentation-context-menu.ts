/**
 * The slide-show right-click menu, shown while presenting when Options >
 * Advanced > "Show menu on right mouse click" is on.
 *
 * Item order/grouping/i18n keys come from the shared
 * `getPresentationContextMenuSections` (`pptx-viewer-shared`), the same
 * source React's `PresentationContextMenu` and Vue/Angular/Svelte's own
 * ports render from, so this menu cannot drift from theirs. Only the view is
 * local: mount at the pointer, clamp into the viewport, dismiss on Escape or
 * an outside press, matching `element-context-menu.ts`'s own menu.
 */
import { clampFlyoutPosition, getPresentationContextMenuSections } from 'pptx-viewer-shared';
import type { PresentationContextMenuActionId } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import type { Store, ViewerState } from '../state';

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

function positionMenu(menu: HTMLElement, doc: Document, x: number, y: number): void {
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

/** Attach the slide-show right-click menu to the presentation root. */
export function mountPresentationContextMenu(
	deps: PresentationContextMenuDeps,
): PresentationContextMenu {
	const { doc, store, root } = deps;
	let menu: HTMLElement | null = null;
	let onDismiss: ((event: Event) => void) | null = null;

	const close = (): void => {
		menu?.remove();
		menu = null;
		if (onDismiss) {
			doc.removeEventListener('pointerdown', onDismiss, true);
			doc.removeEventListener('keydown', onDismiss, true);
			onDismiss = null;
		}
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
		menu = createEl(doc, 'div', 'pptxv-showmenu', { left: `${x}px`, top: `${y}px` });
		menu.dataset.pptxPresentationMenu = 'true';
		menu.setAttribute('role', 'menu');
		const sections = getPresentationContextMenuSections({
			seeAllSlides: true,
			presenterView: true,
			pointerTools: true,
			eraseInk: true,
			blankBlack: true,
			blankWhite: true,
		});
		sections.forEach((section, sectionIndex) => {
			if (sectionIndex > 0) {
				const separator = createEl(doc, 'hr', 'pptxv-showmenu-separator');
				separator.setAttribute('role', 'separator');
				menu?.appendChild(separator);
			}
			for (const item of section.items) {
				const button = createEl(doc, 'button');
				button.type = 'button';
				button.setAttribute('role', 'menuitem');
				button.dataset.itemId = item.id;
				button.textContent = deps.getTranslator()(item.labelKey);
				button.addEventListener('click', () => {
					close();
					run(item.id);
				});
				menu?.appendChild(button);
			}
		});
		root.appendChild(menu);
		positionMenu(menu, doc, x, y);

		onDismiss = (event: Event): void => {
			if (event instanceof KeyboardEvent && event.key !== 'Escape') {
				return;
			}
			if (event.target instanceof Node && menu?.contains(event.target)) {
				return;
			}
			close();
		};
		doc.addEventListener('pointerdown', onDismiss, true);
		doc.addEventListener('keydown', onDismiss, true);
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
