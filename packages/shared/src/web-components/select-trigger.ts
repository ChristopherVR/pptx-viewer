/** Slots let ribbon controls retain their canonical icon and optional custom entry. */
export function createSelectTrigger() {
	const trigger = document.createElement('button');
	trigger.type = 'button';
	trigger.setAttribute('part', 'trigger');
	trigger.setAttribute('role', 'combobox');
	trigger.setAttribute('aria-haspopup', 'listbox');
	trigger.setAttribute('aria-expanded', 'false');
	const icon = document.createElement('slot');
	icon.name = 'icon';
	const text = document.createElement('span');
	text.className = 'value';
	text.setAttribute('part', 'value');
	const chevron = document.createElement('span');
	chevron.className = 'chevron';
	chevron.setAttribute('part', 'indicator');
	chevron.setAttribute('aria-hidden', 'true');
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('fill', 'none');
	svg.setAttribute('stroke', 'currentColor');
	svg.setAttribute('stroke-width', '2');
	svg.setAttribute('stroke-linecap', 'round');
	svg.setAttribute('stroke-linejoin', 'round');
	const path = document.createElementNS(svg.namespaceURI, 'path');
	path.setAttribute('d', 'm6 9 6 6 6-6');
	svg.append(path);
	chevron.append(svg);
	trigger.append(icon, text, chevron);
	return { trigger, text };
}

/** Optional editable content stays in the light DOM so bindings own its events. */
export function prependSelectCustomSlot(host: HTMLElement, menu: HTMLElement): void {
	if (host.querySelector('[slot="custom"]')) {
		const custom = document.createElement('slot');
		custom.name = 'custom';
		menu.prepend(custom);
	}
}
