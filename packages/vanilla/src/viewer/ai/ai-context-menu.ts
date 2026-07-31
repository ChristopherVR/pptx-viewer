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
import { createEl } from '../render';
import type { Store, ViewerState } from '../state';
import { createIcon } from '../ui/icons';
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
	let menu: HTMLElement | null = null;

	const close = (): void => {
		menu?.remove();
		menu = null;
	};

	const selectAndScope = (elementId: string): PptxElement | null => {
		const slideIndex = store.get().currentSlide;
		const el = store.get().slides[slideIndex]?.elements.find((e) => e.id === elementId) ?? null;
		// Reflect the target as the live selection so pin captures exactly it.
		store.set({ selectedElementId: elementId, selectedElementIds: [elementId] });
		return el;
	};

	const item = (icon: Parameters<typeof createIcon>[1], label: string, onClick: () => void) => {
		const btn = createEl(doc, 'button', 'pptxv-ai-menu-item');
		btn.type = 'button';
		btn.append(createIcon(doc, icon), doc.createTextNode(label));
		btn.addEventListener('click', () => {
			onClick();
			close();
		});
		return btn;
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

		menu = createEl(doc, 'div', 'pptxv-ai-menu', {
			left: `${event.clientX}px`,
			top: `${event.clientY}px`,
		});
		menu.setAttribute('role', 'menu');
		menu.append(
			item('sparkles', t('pptx.ai.askAboutElement'), () => controller.askAboutSelection()),
			item('wrench', t('pptx.ai.fixElement'), () => controller.fixElement(el, slideIndex)),
		);
		doc.body.appendChild(menu);

		// Dismiss on the next pointer down / escape anywhere outside the menu.
		const onDismiss = (dismissEvent: Event): void => {
			if (dismissEvent instanceof KeyboardEvent && dismissEvent.key !== 'Escape') {
				return;
			}
			if (dismissEvent.target instanceof Node && menu?.contains(dismissEvent.target)) {
				return;
			}
			close();
			doc.removeEventListener('pointerdown', onDismiss, true);
			doc.removeEventListener('keydown', onDismiss, true);
		};
		doc.addEventListener('pointerdown', onDismiss, true);
		doc.addEventListener('keydown', onDismiss, true);
	};

	viewport.addEventListener('contextmenu', onContextMenu);

	return {
		destroy() {
			viewport.removeEventListener('contextmenu', onContextMenu);
			close();
		},
	};
}
