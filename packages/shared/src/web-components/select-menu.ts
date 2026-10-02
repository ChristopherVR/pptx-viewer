/** Mutations that can change a select's value, labels or font preview. */
export const SELECT_OPTION_ATTRIBUTES = [
	'value',
	'disabled',
	'label',
	'selected',
	'hidden',
	'data-display-label',
	'data-description',
	'style',
];

/** The flattened option data consumed by the select popup. */
export interface SelectChoice {
	value: string;
	label: string;
	disabled: boolean;
	hidden: boolean;
	group: string;
	displayLabel?: string;
	description?: string;
	fontFamily?: string;
}

/** Flatten options while retaining optgroup labels and disabled state. */
export function collectSelectChoices(options: HTMLOptionElement[]): SelectChoice[] {
	return options.map((option) => {
		const group = option.parentElement instanceof HTMLOptGroupElement ? option.parentElement : null;
		return {
			value: option.value,
			label: option.label || option.textContent?.trim() || '',
			disabled: option.disabled || Boolean(group?.disabled),
			hidden: Boolean(option.hidden) || Boolean(group?.hidden),
			group: group?.label ?? '',
			...(option.dataset.displayLabel ? { displayLabel: option.dataset.displayLabel } : {}),
			...(option.dataset.description ? { description: option.dataset.description } : {}),
			...(option.style.fontFamily ? { fontFamily: option.style.fontFamily } : {}),
		};
	});
}

/** Build popup options only when the select first opens. */
export function renderSelectMenu(
	menu: HTMLDivElement,
	choices: SelectChoice[],
	value: string,
): void {
	const menuItems: HTMLElement[] = [];
	let previousGroup = '';
	choices.forEach((choice, index) => {
		if (choice.hidden) {
			return;
		}
		if (choice.group && choice.group !== previousGroup) {
			const heading = document.createElement('div');
			heading.className = 'group';
			heading.setAttribute('role', 'presentation');
			heading.textContent = choice.group;
			menuItems.push(heading);
		}
		previousGroup = choice.group;
		const item = document.createElement('div');
		item.className = 'option';
		item.setAttribute('role', 'option');
		item.setAttribute('aria-selected', String(choice.value === value));
		item.setAttribute('aria-disabled', String(choice.disabled));
		item.id = `${menu.id}-${index}`;
		item.dataset.index = String(index);
		item.textContent = choice.displayLabel ?? choice.label;
		if (choice.fontFamily) {
			item.style.fontFamily = choice.fontFamily;
		}
		if (choice.description) {
			const description = document.createElement('span');
			description.className = 'description';
			description.textContent = choice.description;
			item.append(description);
		}
		menuItems.push(item);
	});
	menu.replaceChildren(...menuItems);
}

/** Prefer below the trigger, flipping above when it offers more room. */
export function positionSelectMenu(menu: HTMLDivElement, trigger: HTMLButtonElement): void {
	const rect = trigger.getBoundingClientRect();
	const margin = 8;
	const gap = 4;
	const width = Math.max(0, window.innerWidth - margin * 2);
	const below = Math.max(0, window.innerHeight - rect.bottom - gap - margin);
	const above = Math.max(0, rect.top - gap - margin);
	menu.style.minWidth = `${Math.min(rect.width, width)}px`;
	menu.style.maxWidth = `${width}px`;
	// Measure at the normal height cap before choosing a side. Reset the cap
	// on every reposition so a previously constrained menu can grow again.
	const heightCap =
		trigger.getRootNode() instanceof ShadowRoot &&
		(trigger.getRootNode() as ShadowRoot).host.getAttribute('data-font-picker') === 'family'
			? 320
			: 240;
	menu.style.maxHeight = `${heightCap}px`;
	const preferredHeight = menu.getBoundingClientRect().height;
	const flip = below < preferredHeight && above > below;
	menu.style.maxHeight = `${Math.min(heightCap, flip ? above : below)}px`;
	const { height, width: menuWidth } = menu.getBoundingClientRect();
	menu.style.top = `${Math.max(margin, flip ? rect.top - gap - height : rect.bottom + gap)}px`;
	menu.style.left = `${Math.max(margin, Math.min(rect.left, window.innerWidth - menuWidth - margin))}px`;
}

/** Expose the keyboard target while keeping the selected state separate. */
export function markSelectActive(
	menu: HTMLDivElement,
	trigger: HTMLButtonElement,
	active: number,
	open: boolean,
): void {
	for (const item of menu.querySelectorAll<HTMLElement>('[data-index]')) {
		item.toggleAttribute('data-active', Number(item.dataset.index) === active && open);
	}
	if (open && active >= 0) {
		trigger.setAttribute('aria-activedescendant', `${menu.id}-${active}`);
	}
	menu.querySelector<HTMLElement>('[data-active]')?.scrollIntoView?.({ block: 'nearest' });
}

/** Find the next enabled option when navigating with the arrow keys. */
export function nextSelectActive(choices: SelectChoice[], active: number, step: number): number {
	for (let index = 0; index < choices.length; index++) {
		active = (active + step + choices.length) % choices.length;
		if (!choices[active].disabled && !choices[active].hidden) {
			return active;
		}
	}
	return active;
}

/** Options a PageUp/PageDown press moves, like the visible rows of a native listbox. */
export const SELECT_PAGE_SIZE = 8;

/** Jump a page of options up (-1) or down (+1), clamped to the nearest enabled option. */
export function pageSelectActive(
	choices: SelectChoice[],
	active: number,
	direction: 1 | -1,
): number {
	const usable = (index: number): boolean => !choices[index]?.disabled && !choices[index]?.hidden;
	const last = choices.length - 1;
	const target = Math.max(0, Math.min(last, Math.max(active, 0) + direction * SELECT_PAGE_SIZE));
	for (let index = target; index >= 0 && index <= last; index -= direction) {
		if (usable(index)) {
			return index;
		}
	}
	return active;
}
