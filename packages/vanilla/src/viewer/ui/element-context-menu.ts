/**
 * The canvas right-click menu: cut/copy/paste, z-order, comments, hyperlink,
 * the table row/column/merge commands, group/ungroup and delete.
 *
 * Vanilla shipped no element menu at all until now, only the two-item AI menu
 * (`ai/ai-context-menu.ts`), so a right-click on a shape fell through to the
 * browser's own menu. The command set is NOT decided here: it comes from the
 * shared `buildContextMenuEntries`, which is the one definition all five
 * bindings render, so a command added there appears here for free and cannot
 * drift.
 *
 * Only the view is local: mount at the pointer, clamp into the viewport,
 * dismiss on Escape or an outside press. Routing lives in
 * `element-context-menu-commands.ts`.
 */
import {
	buildContextMenuEntries,
	isElementIdInteractive,
	resolveContextMenuElementId,
} from 'pptx-viewer-shared';
import type { ContextMenuEntry } from 'pptx-viewer-shared';

import { findActiveElement } from '../editor/editor-active-elements';
import { resolveTopLevelElementId } from '../editor/element-hit';
import type { Translator } from '../i18n';
import { createEl } from '../render';
import type {
	ContextMenuCommandDeps,
	ContextMenuTableTarget,
} from './element-context-menu-commands';
import {
	readTableCellTarget,
	resolveTableTarget,
	runContextMenuCommand,
} from './element-context-menu-commands';

export interface ElementContextMenuDeps extends ContextMenuCommandDeps {
	doc: Document;
	/**
	 * Live translator getter, not a value: `setLocale` swaps the viewer's
	 * translator, and a captured copy would keep labelling the menu in the old
	 * language for the rest of the session.
	 */
	getTranslator(): Translator;
	/** The scrollable viewport that contains the stage. */
	viewport: HTMLElement;
	/** The live `.pptxv-stage` node, or null (rebuilt on every render). */
	getStageRoot(): HTMLElement | null;
	/** Make `id` the selection before a command acts on it. */
	selectElement(id: string): void;
}

export interface ElementContextMenu {
	destroy(): void;
}

/** Keep the menu inside the window: at the right/bottom edge it flips back inwards. */
function positionMenu(menu: HTMLElement, doc: Document, x: number, y: number): void {
	const view = doc.defaultView;
	const box = menu.getBoundingClientRect();
	const width = view?.innerWidth ?? box.right;
	const height = view?.innerHeight ?? box.bottom;
	menu.style.left = `${Math.max(4, Math.min(x, width - box.width - 4))}px`;
	menu.style.top = `${Math.max(4, Math.min(y, height - box.height - 4))}px`;
}

/** Attach the element context menu to the editing canvas. */
export function mountElementContextMenu(deps: ElementContextMenuDeps): ElementContextMenu {
	const { doc, store, viewport } = deps;
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

	const buildItem = (
		entry: ContextMenuEntry,
		table: ContextMenuTableTarget | null,
	): HTMLElement => {
		const button = createEl(
			doc,
			'button',
			`pptxv-context-menu-item${entry.danger ? ' is-danger' : ''}`,
		);
		button.type = 'button';
		button.setAttribute('role', 'menuitem');
		button.textContent = deps.getTranslator()(entry.labelKey);
		button.disabled = entry.disabled === true;
		button.addEventListener('click', () => {
			close();
			runContextMenuCommand(entry.id, deps, table);
		});
		return button;
	};

	const open = (
		entries: ContextMenuEntry[],
		table: ContextMenuTableTarget | null,
		x: number,
		y: number,
	): void => {
		menu = createEl(doc, 'div', 'pptxv-context-menu', { left: `${x}px`, top: `${y}px` });
		menu.dataset.pptxContextMenu = 'true';
		menu.setAttribute('role', 'menu');
		menu.setAttribute('aria-label', deps.getTranslator()('pptx.contextMenu.ariaLabel'));
		for (const entry of entries) {
			if (entry.separatorBefore) {
				const separator = createEl(doc, 'div', 'pptxv-context-menu-separator');
				separator.setAttribute('role', 'separator');
				menu.appendChild(separator);
			}
			menu.appendChild(buildItem(entry, table));
		}
		// Mounted into the viewer root rather than the body: a host `ViewerTheme`
		// is applied as inline `--pptx-*` variables on `.pptxv`, and a body-level
		// menu would inherit none of them. `position: fixed` still escapes the
		// root's `overflow: hidden` because the root sets no transform/filter.
		(viewport.closest<HTMLElement>('.pptxv') ?? doc.body).appendChild(menu);
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
		const state = store.get();
		if (!state.editable || state.presenting) {
			return;
		}
		// A right-click inside an open inline text editor still belongs to the
		// element being edited: the editor is an overlay sibling of the stage, so
		// the plain hit-test finds no element id above the caret.
		const id = resolveContextMenuElementId(
			resolveTopLevelElementId(event.target, deps.getStageRoot()),
			event.target,
			state.selectedElementId,
		);
		if (!id || !isElementIdInteractive(id, state.editTemplateMode)) {
			return;
		}
		event.preventDefault();
		close();
		if (!state.selectedElementIds.includes(id)) {
			deps.selectElement(id);
		}
		// Aim the table commands at the cell under the cursor, unless it is
		// already part of a multi-cell selection the user built by shift-clicking.
		const cell = readTableCellTarget(event.target);
		if (
			cell &&
			!store
				.get()
				.selectedTableCells.some(({ row, column }) => row === cell.row && column === cell.column)
		) {
			store.set({ selectedTableCell: cell, selectedTableCells: [cell] });
		}

		const next = store.get();
		const element = findActiveElement(next, id) ?? null;
		const table = resolveTableTarget(next, element, event.target);
		open(
			buildContextMenuEntries({
				elementType: element?.type ?? null,
				table: table?.context ?? null,
				hasMultiSelection: next.selectedElementIds.length > 1,
				aiEnabled: deps.getAi() !== null,
				hasClipboard: next.clipboardPayload !== null,
			}),
			table,
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
