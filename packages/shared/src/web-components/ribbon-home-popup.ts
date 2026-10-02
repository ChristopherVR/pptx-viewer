/** A fixed-position popover hanging below a Home trigger; all open/close behaviour lives here. */
export interface HomePopup {
	readonly el: HTMLElement;
	readonly isOpen: boolean;
	/** The last activation inside the popup came from the keyboard (so focus should return). */
	readonly viaKeyboard: boolean;
	open(): void;
	close(focusTrigger?: boolean): void;
	toggle(): void;
	/** Re-measure after the content changed. */
	reposition(): void;
}

const FOCUSABLE = 'button:not(:disabled), [role="menuitem"]:not([aria-disabled="true"]), input';

/**
 * `slot` wraps the trigger and owns the popup (so the popup stays inside the
 * customization-id wrapper); a press outside it, Escape, scrolling or a resize
 * closes or re-places the popup.
 */
export function createHomePopup(
	doc: Document,
	slot: HTMLElement,
	trigger: HTMLButtonElement,
	role: 'menu' | 'dialog',
	label: () => string,
	onChange: (open: boolean) => void,
): HomePopup {
	const el = doc.createElement('div');
	el.className = 'popup';
	el.hidden = true;
	el.setAttribute('role', role);
	let opened = false;
	let keyboard = false;
	el.addEventListener('click', (event) => (keyboard = event.detail === 0), true);

	const reposition = () => {
		const view = doc.defaultView;
		if (!view || !opened) {
			return;
		}
		const anchor = slot.getBoundingClientRect();
		const { width, height } = el.getBoundingClientRect();
		const left = Math.min(anchor.left, view.innerWidth - width - 8);
		const top =
			anchor.bottom + 4 + height > view.innerHeight - 8 && anchor.top - 4 - height >= 8
				? anchor.top - 4 - height
				: anchor.bottom + 4;
		el.style.left = `${Math.max(8, left)}px`;
		el.style.top = `${Math.max(8, top)}px`;
	};
	const outside = (event: Event) => {
		if (!event.composedPath().includes(slot)) {
			close(false);
		}
	};
	const key = (event: KeyboardEvent) => {
		if (event.key === 'Escape') {
			event.stopPropagation();
			close(true);
		} else if (event.key === 'Tab') {
			close(false);
		}
	};
	const listen = (on: boolean) => {
		const view = doc.defaultView;
		const method = on ? 'addEventListener' : 'removeEventListener';
		doc[method]('pointerdown', outside, true);
		doc[method]('keydown', key as EventListener);
		view?.[method]('resize', reposition);
		doc[method]('scroll', reposition, true);
	};
	function close(focusTrigger = false): void {
		if (!opened) {
			return;
		}
		opened = false;
		el.hidden = true;
		trigger.setAttribute('aria-expanded', 'false');
		listen(false);
		if (focusTrigger) {
			trigger.focus();
		}
		onChange(false);
	}
	function open(): void {
		if (opened) {
			return;
		}
		opened = true;
		el.hidden = false;
		el.setAttribute('aria-label', label());
		trigger.setAttribute('aria-expanded', 'true');
		listen(true);
		onChange(true);
		reposition();
	}
	// Roving focus inside the popup for the keyboard.
	el.addEventListener('keydown', (event) => {
		const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
		const index = items.indexOf(doc.activeElement as HTMLElement);
		const move = (next: number) => {
			event.preventDefault();
			items[(next + items.length) % items.length]?.focus();
		};
		if (event.key === 'ArrowDown') {
			move(index + 1);
		} else if (event.key === 'ArrowUp') {
			move(index < 0 ? -1 : index - 1);
		} else if (event.key === 'Home') {
			move(0);
		} else if (event.key === 'End') {
			move(-1);
		}
		if (event.key === ' ' || event.key === 'Enter') {
			event.stopPropagation();
		}
	});
	trigger.addEventListener('keydown', (event) => {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			event.stopPropagation();
			open();
			el.querySelector<HTMLElement>(FOCUSABLE)?.focus();
		}
	});
	slot.append(el);
	return {
		el,
		get isOpen() {
			return opened;
		},
		get viaKeyboard() {
			return keyboard;
		},
		open,
		close,
		toggle: () => (opened ? close(false) : open()),
		reposition,
	};
}
