/**
 * Generic floating pill-button picker, the plain-DOM equivalent of the Vue
 * demo's ThemePicker/LanguagePicker pattern: a fixed-position pill opens a
 * menu of options; colors track the active theme preset; a resize listener
 * swaps between the desktop (bottom-right) and mobile (top-right) anchors.
 */

export interface PickerColors {
	bg: string;
	border: string;
	fg: string;
	primary: string;
}

export interface PickerItem {
	key: string;
	label: string;
	/** Optional round color swatch rendered before the label. */
	swatch?: { background: string; border: string };
}

/** One SVG child element of a pill icon (e.g. a path or circle). */
export interface IconPart {
	tag: 'path' | 'circle';
	attrs: Record<string, string>;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Build a 14x14 stroke-styled icon from parts (no HTML parsing involved). */
export function buildIcon(parts: IconPart[]): SVGElement {
	const svg = document.createElementNS(SVG_NS, 'svg');
	svg.setAttribute('width', '14');
	svg.setAttribute('height', '14');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('fill', 'none');
	svg.setAttribute('stroke', 'currentColor');
	svg.setAttribute('stroke-width', '2');
	svg.setAttribute('stroke-linecap', 'round');
	svg.setAttribute('stroke-linejoin', 'round');
	for (const part of parts) {
		const el = document.createElementNS(SVG_NS, part.tag);
		for (const [name, value] of Object.entries(part.attrs)) {
			el.setAttribute(name, value);
		}
		svg.append(el);
	}
	return svg;
}

export interface FloatingPickerOptions {
	/** BEM block name: 'theme-picker' or 'language-picker'. */
	className: string;
	/** Parts of the pill icon, rendered via {@link buildIcon}. */
	icon: IconPart[];
	title: () => string;
	buttonLabel: () => string;
	items: () => PickerItem[];
	activeKey: () => string;
	colors: () => PickerColors;
	onPick: (key: string) => void;
}

export interface FloatingPicker {
	el: HTMLElement;
	/** Re-render labels/colors after a theme or language change. */
	refresh: () => void;
	destroy: () => void;
}

export function createFloatingPicker(options: FloatingPickerOptions): FloatingPicker {
	const block = options.className;
	let open = false;

	const root = document.createElement('div');
	root.className = block;

	const button = document.createElement('button');
	button.type = 'button';
	button.className = `${block}__btn`;

	const menu = document.createElement('div');
	menu.className = `${block}__menu`;

	function makePickHandler(key: string): () => void {
		return () => {
			open = false;
			render();
			options.onPick(key);
		};
	}

	function renderMenu(): void {
		const { fg, primary } = options.colors();
		const active = options.activeKey();
		menu.replaceChildren();
		for (const item of options.items()) {
			const entry = document.createElement('button');
			entry.type = 'button';
			entry.className = `${block}__item`;
			entry.style.background = item.key === active ? `${primary}22` : 'transparent';
			entry.style.color = item.key === active ? primary : fg;
			entry.style.fontWeight = item.key === active ? '600' : '400';
			if (item.swatch) {
				const swatch = document.createElement('span');
				swatch.className = `${block}__swatch`;
				swatch.style.background = item.swatch.background;
				swatch.style.border = `2px solid ${item.swatch.border}`;
				entry.append(swatch);
			}
			entry.append(document.createTextNode(item.label));
			entry.addEventListener('click', makePickHandler(item.key));
			menu.append(entry);
		}
	}

	function render(): void {
		const { bg, border, fg } = options.colors();
		root.classList.toggle(`${block}--small`, window.innerWidth < 768);
		root.style.zIndex = open ? '100000' : '99999';
		button.title = options.title();
		button.style.border = `1px solid ${border}`;
		button.style.background = bg;
		button.style.color = fg;
		button.replaceChildren(buildIcon(options.icon), document.createTextNode(options.buttonLabel()));
		if (open) {
			menu.style.background = bg;
			menu.style.border = `1px solid ${border}`;
			renderMenu();
			if (!menu.isConnected) {
				root.append(menu);
			}
		} else {
			menu.remove();
		}
	}

	button.addEventListener('click', () => {
		open = !open;
		render();
	});
	const onResize = (): void => {
		render();
	};
	window.addEventListener('resize', onResize);

	root.append(button);
	render();

	return {
		el: root,
		refresh: render,
		destroy: () => {
			window.removeEventListener('resize', onResize);
			root.remove();
		},
	};
}
