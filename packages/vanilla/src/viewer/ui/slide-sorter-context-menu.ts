/**
 * The slide sorter's tile right-click menu: Copy, Paste (while something is
 * copied), Duplicate, Hide/Show, Delete. Vanilla had no sorter menu at all,
 * only inline per-card buttons. The command list is NOT decided here: it comes
 * from `buildSlideSorterContextMenuEntries`, this module is only the view
 * (position, render, dismiss) and hands the chosen command id back.
 */
import {
	buildSlideSorterContextMenuEntries,
	clampFlyoutPosition,
	slideSorterContextMenuLabel,
} from 'pptx-viewer-shared';
import type {
	SlideSorterContextMenuContext,
	SlideSorterContextMenuCommandId,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';

export interface SlideSorterContextMenuOptions {
	doc: Document;
	t: Translator;
	/** Element the menu is appended to (the sorter overlay). */
	host: HTMLElement;
	x: number;
	y: number;
	context: SlideSorterContextMenuContext;
	onCommand(id: SlideSorterContextMenuCommandId): void;
}

/** Open the menu; returns a function that closes it. */
export function openSlideSorterContextMenu(options: SlideSorterContextMenuOptions): () => void {
	const { doc, t } = options;
	const menu = createEl(doc, 'div', 'pptxv-context-menu', {
		left: `${options.x}px`,
		top: `${options.y}px`,
	});
	menu.dataset.pptxContextMenu = 'true';
	menu.dataset.pptxSorterContextMenu = 'true';
	menu.setAttribute('role', 'menu');
	menu.setAttribute('aria-label', t('pptx.slideSorter.title'));

	let onDismiss: ((event: Event) => void) | null = null;
	const close = (): void => {
		menu.remove();
		if (onDismiss) {
			doc.removeEventListener('pointerdown', onDismiss, true);
			doc.removeEventListener('keydown', onDismiss, true);
			onDismiss = null;
		}
	};

	for (const entry of buildSlideSorterContextMenuEntries(options.context)) {
		if (entry.separatorBefore) {
			const separator = createEl(doc, 'div', 'pptxv-context-menu-separator');
			separator.setAttribute('role', 'separator');
			menu.appendChild(separator);
		}
		const button = createEl(doc, 'button', 'pptxv-context-menu-item');
		button.type = 'button';
		button.setAttribute('role', 'menuitem');
		button.textContent = slideSorterContextMenuLabel(
			t(entry.labelKey),
			entry,
			options.context.selectedCount,
		);
		button.disabled = entry.disabled === true;
		button.addEventListener('click', () => {
			close();
			options.onCommand(entry.id);
		});
		menu.appendChild(button);
	}

	options.host.appendChild(menu);
	const view = doc.defaultView;
	const box = menu.getBoundingClientRect();
	const { left, top } = clampFlyoutPosition({
		x: options.x,
		y: options.y,
		width: box.width,
		height: box.height,
		viewportWidth: view?.innerWidth ?? box.right,
		viewportHeight: view?.innerHeight ?? box.bottom,
		margin: 4,
	});
	menu.style.left = `${left}px`;
	menu.style.top = `${top}px`;

	onDismiss = (event: Event): void => {
		if (event instanceof KeyboardEvent && event.key !== 'Escape') {
			return;
		}
		const target = event.target;
		if (target instanceof Node && menu.contains(target)) {
			return;
		}
		close();
	};
	doc.addEventListener('pointerdown', onDismiss, true);
	doc.addEventListener('keydown', onDismiss, true);
	return close;
}
