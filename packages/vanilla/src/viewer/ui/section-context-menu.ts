/**
 * The slides rail's section-header right-click menu: Rename, Delete, Move Up,
 * Move Down, Add Section After. Sibling of `thumbnail-context-menu.ts`. The
 * command list is NOT decided here: it comes from
 * `buildSectionContextMenuEntries`, this module is only the view (position,
 * render, dismiss) and hands the chosen command id back to the caller.
 */
import { buildSectionContextMenuEntries, clampFlyoutPosition } from 'pptx-viewer-shared';
import type { SectionContextMenuCommandId } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';

export interface SectionContextMenuOptions {
	doc: Document;
	t: Translator;
	/** Element the menu is mounted beside (used to find the viewer root). */
	host: HTMLElement;
	x: number;
	y: number;
	/** Position of the section among the declared sections. */
	sectionIndex: number;
	totalSections: number;
	onCommand(id: SectionContextMenuCommandId): void;
}

/** Open the menu; returns a function that closes it. */
export function openSectionContextMenu(options: SectionContextMenuOptions): () => void {
	const { doc, t } = options;
	const menu = createEl(doc, 'div', 'pptxv-context-menu', {
		left: `${options.x}px`,
		top: `${options.y}px`,
	});
	menu.dataset.pptxContextMenu = 'true';
	menu.dataset.pptxSectionContextMenu = 'true';
	menu.setAttribute('role', 'menu');
	menu.setAttribute('aria-label', t('pptx.sections.sectionButtonLabel'));

	let onDismiss: ((event: Event) => void) | null = null;
	const close = (): void => {
		menu.remove();
		if (onDismiss) {
			doc.removeEventListener('pointerdown', onDismiss, true);
			doc.removeEventListener('keydown', onDismiss, true);
			onDismiss = null;
		}
	};

	for (const entry of buildSectionContextMenuEntries({
		sectionIndex: options.sectionIndex,
		totalSections: options.totalSections,
	})) {
		if (entry.separatorBefore) {
			const separator = createEl(doc, 'div', 'pptxv-context-menu-separator');
			separator.setAttribute('role', 'separator');
			menu.appendChild(separator);
		}
		const button = createEl(doc, 'button', 'pptxv-context-menu-item');
		button.type = 'button';
		button.setAttribute('role', 'menuitem');
		button.textContent = t(entry.labelKey);
		button.disabled = entry.disabled === true;
		button.addEventListener('click', () => {
			close();
			options.onCommand(entry.id);
		});
		menu.appendChild(button);
	}

	(options.host.closest<HTMLElement>('.pptxv') ?? doc.body).appendChild(menu);
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
