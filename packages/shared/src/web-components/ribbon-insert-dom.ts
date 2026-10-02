import { RIBBON_ICON_PATHS } from './ribbon-icons';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Trusted shared artwork only; paths are never taken from host input. */
export function insertSvg(doc: Document, path: string, viewBox = '0 0 20 20'): SVGSVGElement {
	const svg = doc.createElementNS(SVG_NS, 'svg');
	svg.setAttribute('viewBox', viewBox);
	svg.setAttribute('aria-hidden', 'true');
	const shape = doc.createElementNS(SVG_NS, 'path');
	shape.setAttribute('d', path);
	svg.append(shape);
	return svg;
}

export function insertIcon(doc: Document, name: string): SVGSVGElement {
	return insertSvg(doc, RIBBON_ICON_PATHS[name] ?? '');
}

export interface InsertMenuItem {
	id: string;
	label: string;
	/** Optional glyph path, 24px grid unless {@link viewBox} says otherwise. */
	glyph?: string;
	viewBox?: string;
	/** CSS transform applied to the glyph (rotated or skewed shape presets). */
	transform?: string;
}

export interface InsertMenuOptions {
	/** Office "large" command: a 32px glyph over the label, chevron below. */
	large?: boolean;
	/** Lay the entries out as an icon gallery instead of a list. */
	grid?: boolean;
}

export interface InsertMenu {
	el: HTMLElement;
	trigger: HTMLButtonElement;
	sync(
		label: string,
		title: string,
		items: readonly InsertMenuItem[],
		disabled: boolean,
		menuLabel: string,
	): void;
	close(): void;
	isOpen(): boolean;
	place(): void;
}

/** Click, Enter/Space and arrow-key menu; replaces the hover-only per-binding popups. */
export function createInsertMenu(
	doc: Document,
	control: string,
	icon: string,
	pick: (id: string) => void,
	options: InsertMenuOptions = {},
): InsertMenu {
	const el = doc.createElement('div');
	el.className = 'menu';
	el.dataset.ribbonControl = control;
	const trigger = doc.createElement('button');
	trigger.type = 'button';
	trigger.className = options.large ? 'trigger large' : 'trigger';
	trigger.dataset.pptxCompact = '';
	trigger.setAttribute('aria-haspopup', 'menu');
	trigger.setAttribute('aria-expanded', 'false');
	const text = doc.createElement('span');
	text.className = 'label';
	trigger.append(insertIcon(doc, icon), text, insertIcon(doc, 'chevronDown'));
	const list = doc.createElement('div');
	list.className = options.grid ? 'list grid' : 'list';
	list.setAttribute('role', 'menu');
	list.hidden = true;
	el.append(trigger, list);
	const items = () => [...list.querySelectorAll<HTMLButtonElement>('button')];
	const close = () => {
		list.hidden = true;
		trigger.setAttribute('aria-expanded', 'false');
	};
	const place = () => {
		if (list.hidden) {
			return;
		}
		const rect = trigger.getBoundingClientRect();
		const view = doc.defaultView;
		const box = list.getBoundingClientRect();
		const width = view?.innerWidth ?? 1024;
		const height = view?.innerHeight ?? 768;
		list.style.left = `${Math.max(8, Math.min(rect.left, width - box.width - 8))}px`;
		list.style.top = `${Math.max(8, Math.min(rect.bottom + 4, height - box.height - 8))}px`;
	};
	const open = (focusFirst: boolean) => {
		if (trigger.disabled) {
			return;
		}
		list.hidden = false;
		trigger.setAttribute('aria-expanded', 'true');
		place();
		if (focusFirst) {
			items()[0]?.focus();
		}
	};
	trigger.addEventListener('click', () => (list.hidden ? open(false) : close()));
	el.addEventListener('keydown', (event) => {
		const entries = items();
		const index = entries.indexOf(doc.activeElement as HTMLButtonElement);
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			event.stopPropagation();
			if (list.hidden) {
				open(true);
			} else if (entries.length) {
				const step = event.key === 'ArrowDown' ? 1 : -1;
				entries[(index + step + entries.length) % entries.length].focus();
			}
		} else if (event.key === 'Tab') {
			close();
		} else if (event.key === ' ' || event.key === 'Enter') {
			// Keep native activation out of the viewer's slide-navigation handlers.
			event.stopPropagation();
		}
	});
	return {
		el,
		trigger,
		close,
		place,
		isOpen: () => !list.hidden,
		sync(label, title, entries, disabled, menuLabel) {
			text.textContent = label;
			trigger.title = title;
			trigger.disabled = disabled;
			list.setAttribute('aria-label', menuLabel);
			if (disabled) {
				close();
			}
			const key = entries.map((item) => `${item.id}:${item.label}`).join('|');
			if (list.dataset.key !== key) {
				list.dataset.key = key;
				list.replaceChildren(
					...entries.map((item) => {
						const button = doc.createElement('button');
						button.type = 'button';
						button.setAttribute('role', 'menuitem');
						button.dataset.pptxCompact = '';
						button.dataset.insertItem = item.id;
						if (item.glyph) {
							const glyph = insertSvg(doc, item.glyph, item.viewBox ?? '0 0 24 24');
							if (item.transform && item.transform !== 'none') {
								glyph.style.transform = item.transform;
							}
							button.append(glyph);
						}
						if (options.grid) {
							button.title = item.label;
							button.setAttribute('aria-label', item.label);
						} else {
							button.append(doc.createTextNode(item.label));
						}
						button.addEventListener('click', () => {
							close();
							trigger.focus();
							pick(item.id);
						});
						return button;
					}),
				);
			}
		},
	};
}
