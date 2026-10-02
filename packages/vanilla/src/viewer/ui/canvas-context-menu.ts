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
	contextMenuViewItems,
	customizeCanvasContextMenuEntries,
	EMPTY_RESOLVED_CUSTOMIZATION,
	isElementIdInteractive,
	resolveContextMenuElementId,
} from 'pptx-viewer-shared';
import type { CustomizedCanvasContextMenuEntry, ResolvedCustomization } from 'pptx-viewer-shared';

import type { EditActions } from '../editor';
import { collectLayoutOptions } from '../editor/editing-chrome-sync';
import { resolveTopLevelElementId } from '../editor/element-hit';
import type { Translator } from '../i18n';
import type { Store, ViewerState } from '../state';
import { mountContextMenuSurface } from './context-menu-surface';
import type { ContextMenuSurface } from './context-menu-surface';

export interface CanvasContextMenuDeps {
	doc: Document;
	store: Store<ViewerState>;
	getTranslator(): Translator;
	/** The scrollable viewport that contains the stage. */
	viewport: HTMLElement;
	/** The live `.pptxv-stage` node, or null (rebuilt on every render). */
	getStageRoot(): HTMLElement | null;
	getEditActions(): EditActions;
	/** The host's resolved UI customisation, read at open time (omitted: none). */
	getCustomization?(): ResolvedCustomization;
}

export interface CanvasContextMenu {
	destroy(): void;
}

/** Attach the empty-canvas context menu to the editing canvas. */
export function mountCanvasContextMenu(deps: CanvasContextMenuDeps): CanvasContextMenu {
	const { doc, store, viewport } = deps;
	let menu: ContextMenuSurface | null = null;
	let layoutPopup: ContextMenuSurface | null = null;
	const parent = (): HTMLElement => viewport.closest<HTMLElement>('.pptxv') ?? doc.body;

	const close = (): void => {
		menu?.close();
		menu = null;
		layoutPopup?.close();
		layoutPopup = null;
	};

	/**
	 * "Layout": a plain named list of the deck's layouts, applied to the active
	 * slide. Kept text-only (not the ribbon's thumbnail gallery) so it needs no
	 * artwork fetch and no dependency on the ribbon's own popover positioning. It is
	 * a second shared menu, so it clamps, navigates and dismisses like the first.
	 */
	const openLayoutList = (x: number, y: number): void => {
		layoutPopup?.close();
		const options = collectLayoutOptions(store.get());
		layoutPopup = mountContextMenuSurface({
			doc,
			parent: parent(),
			state: {
				x,
				y,
				label: deps.getTranslator()('pptx.master.layout'),
				items: options.map((option) => ({ id: option.path, label: option.name })),
			},
			onRequest: (path) => {
				close();
				deps.getEditActions().applyLayout(path);
			},
			onClose: close,
		});
	};

	const run = (entry: CustomizedCanvasContextMenuEntry, x: number, y: number): void => {
		if ('host' in entry) {
			close();
			entry.onSelect();
			return;
		}
		const actions = deps.getEditActions();
		switch (entry.id) {
			case 'paste':
				close();
				actions.paste();
				break;
			case 'layout':
				// The layout list is a companion menu, not a fresh command menu:
				// the command menu closes and the list takes its place.
				menu?.close();
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
	};

	const open = (entries: CustomizedCanvasContextMenuEntry[], x: number, y: number): void => {
		const t = deps.getTranslator();
		menu = mountContextMenuSurface({
			doc,
			parent: parent(),
			state: {
				x,
				y,
				label: t('pptx.canvasContextMenu.ariaLabel'),
				markers: ['data-pptx-context-menu', 'data-pptx-canvas-context-menu'],
				items: contextMenuViewItems(entries, t),
			},
			onRequest: (id) => {
				const entry = entries.find((candidate) => candidate.id === id);
				if (entry) {
					run(entry, x, y);
				}
			},
			onClose: close,
		});
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
		const entries = customizeCanvasContextMenuEntries(
			buildCanvasContextMenuEntries({
				hasClipboard: state.clipboardPayload !== null,
				showGrid: state.showGrid,
				showRulers: state.showRulers,
			}),
			deps.getCustomization?.() ?? EMPTY_RESOLVED_CUSTOMIZATION,
			{ slideIndex: state.currentSlide },
		);
		// An emptied (or host-disabled) menu behaves like no menu: the native one shows.
		if (entries.length === 0) {
			return;
		}
		event.preventDefault();
		close();
		open(entries, event.clientX, event.clientY);
	};

	viewport.addEventListener('contextmenu', onContextMenu);

	return {
		destroy() {
			viewport.removeEventListener('contextmenu', onContextMenu);
			close();
		},
	};
}
