import type { ContextMenuViewState } from './context-menu-model';

export interface ContextMenuView {
	menu: HTMLElement;
	/** One button per `state.items` entry, in order. */
	buttons: HTMLButtonElement[];
	render(state: ContextMenuViewState, tabStopIndex: number, onPick: (id: string) => void): void;
}

/** Builds the `role="menu"` surface: rows, rules and headings. Pure view, no listeners but click. */
export function createContextMenuView(doc: Document): ContextMenuView {
	const menu = doc.createElement('div');
	menu.className = 'menu';
	menu.setAttribute('role', 'menu');
	menu.setAttribute('aria-orientation', 'vertical');
	menu.tabIndex = -1;
	const view: ContextMenuView = {
		menu,
		buttons: [],
		render(state, tabStopIndex, onPick) {
			menu.setAttribute('aria-label', state.label);
			view.buttons = [];
			let container: HTMLElement = menu;
			const nodes: HTMLElement[] = [];
			const place = (node: HTMLElement): void => {
				if (container === menu) {
					nodes.push(node);
				} else {
					container.append(node);
				}
			};
			state.items.forEach((item, index) => {
				if (item.separatorBefore || item.heading) {
					container = menu;
				}
				if (item.separatorBefore) {
					const rule = doc.createElement('div');
					rule.className = 'separator';
					rule.setAttribute('role', 'separator');
					place(rule);
				}
				if (item.heading) {
					const group = doc.createElement('div');
					group.setAttribute('role', 'group');
					group.setAttribute('aria-label', item.heading);
					const title = doc.createElement('div');
					title.className = 'heading';
					title.setAttribute('aria-hidden', 'true');
					title.textContent = item.heading;
					group.append(title);
					place(group);
					container = group;
				}
				const button = doc.createElement('button');
				button.type = 'button';
				button.className = item.danger ? 'item danger' : 'item';
				button.dataset.itemId = item.id;
				button.setAttribute('role', item.checked === undefined ? 'menuitem' : 'menuitemcheckbox');
				if (item.checked !== undefined) {
					button.setAttribute('aria-checked', String(item.checked));
					const check = doc.createElement('span');
					check.className = 'check';
					check.setAttribute('aria-hidden', 'true');
					check.textContent = item.checked ? '✓' : '';
					button.append(check);
				}
				button.append(doc.createTextNode(item.label));
				button.tabIndex = index === tabStopIndex ? 0 : -1;
				if (item.disabled) {
					button.disabled = true;
					button.setAttribute('aria-disabled', 'true');
				}
				button.addEventListener('click', () => onPick(item.id));
				view.buttons.push(button);
				place(button);
			});
			menu.replaceChildren(...nodes);
		},
	};
	return view;
}
