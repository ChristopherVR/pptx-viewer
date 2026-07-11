import type { InsertKind } from '../editor/editor-insert';
import type { Translator } from '../i18n';
import { createEl } from '../render';
import { createIcon } from './icons';

/** The insert actions the menu dispatches (a subset of the editor edit actions). */
export interface InsertMenuHandlers {
	insert(kind: InsertKind): void;
	insertImage(): void;
}

export interface InsertMenu {
	el: HTMLElement;
	setDisabled(disabled: boolean): void;
}

interface MenuItem {
	label: string;
	run(): void;
}

/**
 * The Insert dropdown: a single toolbar button that opens a small popover of
 * insertable elements (text box, rectangle, ellipse, line, image, table).
 * Vanilla stand-in for the React/Vue ribbon Insert tab, scoped to the
 * high-value primitives. All labels come from the shared `pptx.ribbon.*` /
 * `pptx.common.insert` dictionary.
 */
export function createInsertMenu(
	doc: Document,
	t: Translator,
	handlers: InsertMenuHandlers,
): InsertMenu {
	const el = createEl(doc, 'div', 'pptxv-insert');

	const trigger = createEl(doc, 'button', 'pptxv-btn pptxv-insert-trigger');
	trigger.type = 'button';
	trigger.title = t('pptx.common.insert');
	trigger.setAttribute('aria-label', t('pptx.common.insert'));
	trigger.setAttribute('aria-haspopup', 'true');
	trigger.setAttribute('aria-expanded', 'false');
	trigger.appendChild(createIcon(doc, 'shapes'));
	el.appendChild(trigger);

	const menu = createEl(doc, 'div', 'pptxv-insert-menu');
	menu.setAttribute('role', 'menu');
	menu.hidden = true;
	el.appendChild(menu);

	const items: MenuItem[] = [
		{ label: t('pptx.ribbon.textBox'), run: () => handlers.insert('text') },
		{ label: t('pptx.ribbon.rectangle'), run: () => handlers.insert('rect') },
		{ label: t('pptx.ribbon.ellipse'), run: () => handlers.insert('ellipse') },
		{ label: t('pptx.ribbon.line'), run: () => handlers.insert('line') },
		{ label: t('pptx.ribbon.image'), run: () => handlers.insertImage() },
		{ label: t('pptx.ribbon.table'), run: () => handlers.insert('table') },
	];

	let isOpen = false;
	const setOpen = (open: boolean): void => {
		isOpen = open;
		menu.hidden = !open;
		trigger.setAttribute('aria-expanded', String(open));
		trigger.classList.toggle('is-active', open);
	};

	for (const item of items) {
		const entry = createEl(doc, 'button', 'pptxv-insert-item');
		entry.type = 'button';
		entry.setAttribute('role', 'menuitem');
		entry.textContent = item.label;
		entry.addEventListener('click', () => {
			setOpen(false);
			item.run();
		});
		menu.appendChild(entry);
	}

	trigger.addEventListener('click', (event) => {
		event.stopPropagation();
		setOpen(!isOpen);
	});
	// Close on any outside pointerdown.
	doc.addEventListener('pointerdown', (event) => {
		if (isOpen && !el.contains(event.target as Node)) {
			setOpen(false);
		}
	});

	return {
		el,
		setDisabled(disabled) {
			trigger.disabled = disabled;
			if (disabled) {
				setOpen(false);
			}
		},
	};
}
