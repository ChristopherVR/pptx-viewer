/** The flattened option data consumed by the select popup. */
export interface SelectChoice {
	value: string;
	label: string;
	disabled: boolean;
	hidden: boolean;
	group: string;
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
		item.textContent = choice.label;
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
	menu.style.maxHeight = '240px';
	const preferredHeight = menu.getBoundingClientRect().height;
	const flip = below < preferredHeight && above > below;
	menu.style.maxHeight = `${Math.min(240, flip ? above : below)}px`;
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
