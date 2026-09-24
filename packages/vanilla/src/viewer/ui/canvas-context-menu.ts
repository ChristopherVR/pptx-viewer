/**
 * The right-click menu for the empty slide canvas (no element under the
 * cursor). Sibling of `element-context-menu.ts`: the command list is NOT
 * decided here, it comes from the shared `buildCanvasContextMenuEntries`, so
 * this module is only the view (position, render, dismiss) and the routing
 * from a command id to an existing editor operation.
 *
 * Vanilla shipped no canvas menu at all until now: a right-click on empty
 * canvas fell through to the browser's own menu.
 */
import {
	buildCanvasContextMenuEntries,
	clampFlyoutPosition,
	isElementIdInteractive,
	resolveContextMenuElementId,
} from 'pptx-viewer-shared';
import type { CanvasContextMenuEntry } from 'pptx-viewer-shared';

import type { EditActions } from '../editor';
import { collectLayoutOptions } from '../editor/editing-chrome-sync';
import { resolveTopLevelElementId } from '../editor/element-hit';
import type { Translator } from '../i18n';
import { createEl } from '../render';
import type { Store, ViewerState } from '../state';

export interface CanvasContextMenuDeps {
	doc: Document;
	store: Store<ViewerState>;
	getTranslator(): Translator;
	/** The scrollable viewport that contains the stage. */
	viewport: HTMLElement;
	/** The live `.pptxv-stage` node, or null (rebuilt on every render). */
	getStageRoot(): HTMLElement | null;
	getEditActions(): EditActions;
}

export interface CanvasContextMenu {
	destroy(): void;
}

/** Keep the menu inside the window; shared two-sided clamp (see `element-context-menu.ts`). */
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

/** Attach the empty-canvas context menu to the editing canvas. */
export function mountCanvasContextMenu(deps: CanvasContextMenuDeps): CanvasContextMenu {
	const { doc, store, viewport } = deps;
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

	/**
	 * "Layout": a plain named list of the deck's layouts, applied to the active
	 * slide. Kept text-only (not the ribbon's thumbnail gallery) so it needs no
	 * artwork fetch and no dependency on the ribbon's own popover positioning.
	 */
	const openLayoutList = (x: number, y: number): void => {
		layoutPopup?.remove();
		const list = createEl(doc, 'div', 'pptxv-context-menu', { left: `${x}px`, top: `${y}px` });
		list.setAttribute('role', 'menu');
		list.setAttribute('aria-label', deps.getTranslator()('pptx.master.layout'));
		const options = collectLayoutOptions(store.get());
		for (const option of options) {
			const btn = createEl(doc, 'button', 'pptxv-context-menu-item');
			btn.type = 'button';
			btn.setAttribute('role', 'menuitem');
			btn.textContent = option.name;
			btn.addEventListener('click', () => {
				deps.getEditActions().applyLayout(option.path);
				close();
			});
			list.appendChild(btn);
		}
		(viewport.closest<HTMLElement>('.pptxv') ?? doc.body).appendChild(list);
		positionAt(list, doc, x, y);
		layoutPopup = list;
	};

	const buildItem = (entry: CanvasContextMenuEntry, x: number, y: number): HTMLElement => {
		const button = createEl(doc, 'button', 'pptxv-context-menu-item');
		button.type = 'button';
		button.setAttribute('role', entry.checked === undefined ? 'menuitem' : 'menuitemcheckbox');
		if (entry.checked !== undefined) {
			button.setAttribute('aria-checked', String(entry.checked));
			const check = createEl(doc, 'span', 'pptxv-context-menu-check');
			check.textContent = entry.checked ? '✓' : '';
			button.appendChild(check);
		}
		button.append(deps.getTranslator()(entry.labelKey));
		button.disabled = entry.disabled === true;
		button.addEventListener('click', () => {
			const actions = deps.getEditActions();
			switch (entry.id) {
				case 'paste':
					close();
					actions.paste();
					break;
				case 'layout':
					// The layout list is a companion popup, not a fresh menu: closing
					// the command menu but leaving the list up.
					menu?.remove();
					menu = null;
					openLayoutList(x, y);
					break;
				case 'reset-slide':
					close();
					actions.resetSlide();
					break;
				case 'format-background':
					close();
					store.set({ selectedElementId: null, selectedElementIds: [], inspectorOpen: true });
					break;
				case 'grid-and-guides':
					close();
					actions.toggleViewOption('showGrid');
					break;
				case 'ruler':
					close();
					actions.toggleViewOption('showRulers');
					break;
				default:
					close();
			}
		});
		return button;
	};

	const open = (entries: CanvasContextMenuEntry[], x: number, y: number): void => {
		menu = createEl(doc, 'div', 'pptxv-context-menu', { left: `${x}px`, top: `${y}px` });
		menu.dataset.pptxContextMenu = 'true';
		menu.dataset.pptxCanvasContextMenu = 'true';
		menu.setAttribute('role', 'menu');
		menu.setAttribute('aria-label', deps.getTranslator()('pptx.canvasContextMenu.ariaLabel'));
		for (const entry of entries) {
			if (entry.separatorBefore) {
				const separator = createEl(doc, 'div', 'pptxv-context-menu-separator');
				separator.setAttribute('role', 'separator');
				menu.appendChild(separator);
			}
			menu.appendChild(buildItem(entry, x, y));
		}
		(viewport.closest<HTMLElement>('.pptxv') ?? doc.body).appendChild(menu);
		positionAt(menu, doc, x, y);

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
	};

	const onContextMenu = (event: MouseEvent): void => {
		const state = store.get();
		if (!state.editable || state.presenting) {
			return;
		}
		// This listener and the element menu's both bind `contextmenu` on the
		// same viewport (neither stops propagation), so this one must repeat the
		// same hit-test and yield when an element WAS hit: the element menu owns
		// that case, and opening both here would stack a second menu on top.
		const id = resolveContextMenuElementId(
			resolveTopLevelElementId(event.target, deps.getStageRoot()),
			event.target,
			state.selectedElementId,
		);
		if (id && isElementIdInteractive(id, state.editTemplateMode)) {
			return;
		}
		event.preventDefault();
		close();
		open(
			buildCanvasContextMenuEntries({
				hasClipboard: state.clipboardPayload !== null,
				showGrid: state.showGrid,
				showRulers: state.showRulers,
			}),
			event.clientX,
			event.clientY,
		);
	};

	viewport.addEventListener('contextmenu', onContextMenu);

	return {
		destroy() {
			viewport.removeEventListener('contextmenu', onContextMenu);
			close();
		},
	};
}
