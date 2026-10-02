/**
 * Click-to-ask: a lightweight right-click menu on a canvas element offering
 * "Ask AI about this" and "Fix with AI". Both PIN the assistant to the clicked
 * element, open the panel, and PRE-FILL the composer (never auto-send) via the
 * {@link AiFocusController}. Gated by the caller on the `ai` option. Vanilla
 * counterpart of React's ContextMenu "Ask AI" / "Fix with AI" items.
 */
import type { PptxElement } from 'pptx-viewer-core';

import { resolveTopLevelElementId } from '../editor/element-hit';
import type { Translator } from '../i18n';
import type { Store, ViewerState } from '../state';
import { mountContextMenuSurface } from '../ui/context-menu-surface';
import type { ContextMenuSurface } from '../ui/context-menu-surface';
import type { AiFocusController } from './ai-panel-controller';

export interface AiContextMenuDeps {
	doc: Document;
	t: Translator;
	store: Store<ViewerState>;
	controller: AiFocusController;
	/** The scrollable viewport that contains the stage. */
	viewport: HTMLElement;
	/** The live `.pptxv-stage` node, or null. */
	getStageRoot(): HTMLElement | null;
}

export interface AiContextMenu {
	destroy(): void;
}

/** Attach the right-click "Ask AI" / "Fix with AI" menu to the canvas. */
export function mountAiContextMenu(deps: AiContextMenuDeps): AiContextMenu {
	const { doc, t, store, controller, viewport } = deps;
	let menu: ContextMenuSurface | null = null;

	const close = (): void => {
		menu?.close();
		menu = null;
	};

	const selectAndScope = (elementId: string): PptxElement | null => {
		const slideIndex = store.get().currentSlide;
		const el = store.get().slides[slideIndex]?.elements.find((e) => e.id === elementId) ?? null;
		// Reflect the target as the live selection so pin captures exactly it.
		store.set({ selectedElementId: elementId, selectedElementIds: [elementId] });
		return el;
	};

	const onContextMenu = (event: MouseEvent): void => {
		const state = store.get();
		// While editing, the full element context menu owns the canvas right-click
		// and already carries "Ask AI" / "Fix with AI" as two of its entries. Both
		// menus opening on one click would leave two floating menus on screen, so
		// this one is the read-only-mode fallback and steps aside when editing.
		if (state.editable && !state.presenting) {
			return;
		}
		const id = resolveTopLevelElementId(event.target, deps.getStageRoot());
		if (!id) {
			return;
		}
		event.preventDefault();
		close();
		const el = selectAndScope(id);
		const slideIndex = store.get().currentSlide;
		const commands: Record<string, () => void> = {
			ask: () => controller.askAboutSelection(),
			fix: () => controller.fixElement(el, slideIndex),
		};
		// The rows, clamping, keyboard navigation and dismissal belong to the shared
		// `pptx-ui-context-menu`; only the two commands are local.
		menu = mountContextMenuSurface({
			doc,
			parent: doc.body,
			state: {
				x: event.clientX,
				y: event.clientY,
				label: t('pptx.contextMenu.ariaLabel'),
				markers: ['data-pptx-ai-context-menu'],
				items: [
					{ id: 'ask', label: t('pptx.ai.askAboutElement') },
					{ id: 'fix', label: t('pptx.ai.fixElement') },
				],
			},
			onRequest: (command) => {
				close();
				commands[command]?.();
			},
			onClose: close,
		});
	};

	viewport.addEventListener('contextmenu', onContextMenu);

	return {
		destroy() {
			viewport.removeEventListener('contextmenu', onContextMenu);
			close();
		},
	};
}
