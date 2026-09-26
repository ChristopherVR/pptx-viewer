import { attachControlStyles } from './control-styles';
import {
	collectSelectChoices,
	markSelectActive,
	nextSelectActive,
	positionSelectMenu,
	renderSelectMenu,
} from './select-menu';
import type { SelectChoice } from './select-menu';
import { SELECT_STYLES } from './select-styles';
import { createSelectValueElement } from './select-value';

let nextSelectId = 0;

/** A select-only combobox with one popup and event contract in every binding. */
export function definePptxSelect(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-select')) {
		return;
	}

	class PptxSelect extends createSelectValueElement() {
		static formAssociated = true;
		static observedAttributes = ['value', 'disabled', 'aria-label'];
		private readonly internals: ElementInternals | undefined;
		private readonly trigger: HTMLButtonElement;
		private readonly text: HTMLSpanElement;
		private readonly menu: HTMLDivElement;
		private readonly observer: MutationObserver;
		private refreshFrame = 0;
		private choices: SelectChoice[] = [];
		private active = -1;
		private open = false;
		private search = '';
		private searchTimer = 0;
		private defaultValue = '';

		constructor() {
			super();
			try {
				this.internals = this.attachInternals();
			} catch {
				this.internals = undefined;
			}
			const root = this.attachShadow({ mode: 'open', delegatesFocus: true });
			attachControlStyles(root, SELECT_STYLES);
			this.trigger = document.createElement('button');
			this.trigger.type = 'button';
			this.trigger.setAttribute('role', 'combobox');
			this.trigger.setAttribute('aria-haspopup', 'listbox');
			this.trigger.setAttribute('aria-expanded', 'false');
			this.text = document.createElement('span');
			this.text.className = 'value';
			this.text.setAttribute('part', 'value');
			const chevron = document.createElement('span');
			chevron.className = 'chevron';
			chevron.setAttribute('aria-hidden', 'true');
			this.trigger.append(this.text, chevron);
			this.menu = document.createElement('div');
			this.menu.className = 'menu';
			this.menu.id = `pptx-ui-select-options-${++nextSelectId}`;
			this.menu.setAttribute('role', 'listbox');
			this.menu.setAttribute('popover', 'manual');
			this.menu.setAttribute('part', 'popup');
			this.trigger.setAttribute('aria-controls', this.menu.id);
			root.append(this.trigger, this.menu);
			this.trigger.addEventListener('click', () => (this.open ? this.close() : this.show()));
			this.trigger.addEventListener('keydown', (event) => this.onKeyDown(event));
			this.menu.addEventListener('pointerdown', (event) => event.preventDefault());
			this.menu.addEventListener('click', (event) => {
				const target = (event.target as Element).closest<HTMLElement>('[data-index]');
				if (target) {
					this.commit(Number(target.dataset.index));
				}
			});
			this.observer = new MutationObserver(() => {
				// Let bindings finish updating their option nodes before touching the shadow DOM.
				if (!this.refreshFrame) {
					this.refreshFrame = requestAnimationFrame(() => {
						this.refreshFrame = 0;
						this.refresh();
					});
				}
			});
		}

		connectedCallback(): void {
			this.defaultValue = this.getAttribute('value') ?? '';
			this.observer.observe(this, {
				childList: true,
				subtree: true,
				attributes: true,
				characterData: true,
				attributeFilter: ['value', 'disabled', 'label', 'selected', 'hidden'],
			});
			this.refresh();
		}
		disconnectedCallback(): void {
			this.close();
			this.observer.disconnect();
			cancelAnimationFrame(this.refreshFrame);
			this.refreshFrame = 0;
		}
		attributeChangedCallback(): void {
			this.refresh();
		}

		get disabled(): boolean {
			return this.hasAttribute('disabled');
		}
		set disabled(next: boolean) {
			this.toggleAttribute('disabled', Boolean(next));
		}
		override focus(options?: FocusOptions): void {
			this.trigger.focus(options);
		}
		formResetCallback(): void {
			this.value = this.defaultValue;
		}
		formDisabledCallback(disabled: boolean): void {
			this.disabled = disabled;
		}

		private refresh(): void {
			if (!this.trigger) {
				return;
			}
			const options = [...this.querySelectorAll('option')];
			this.choices = collectSelectChoices(options);
			if (!this.hasAttribute('value') && this.choices.length) {
				this.value =
					options.find((option) => option.selected)?.value ??
					this.choices.find((choice) => !choice.disabled && !choice.hidden)?.value ??
					this.choices[0].value;
			}
			this.text.textContent =
				this.choices.find((choice) => choice.value === this.value)?.label ?? '';
			this.trigger.disabled = this.disabled;
			if (this.disabled) {
				this.close();
			}
			this.trigger.setAttribute('aria-label', this.getAttribute('aria-label') ?? '');
			this.internals?.setFormValue?.(this.disabled ? null : this.value);
			if (this.open || this.menu.childElementCount) {
				this.renderMenu();
			}
		}

		private renderMenu(): void {
			renderSelectMenu(this.menu, this.choices, this.value);
			markSelectActive(this.menu, this.trigger, this.active, this.open);
		}

		private show(): void {
			if (
				this.disabled ||
				!this.choices.some((choice) => !choice.disabled && !choice.hidden) ||
				this.open
			) {
				return;
			}
			this.open = true;
			this.setAttribute('open', '');
			const selected = this.choices.findIndex(
				(choice) => choice.value === this.value && !choice.disabled && !choice.hidden,
			);
			this.active =
				selected >= 0
					? selected
					: this.choices.findIndex((choice) => !choice.disabled && !choice.hidden);
			this.renderMenu();
			if (typeof this.menu.showPopover === 'function') {
				this.menu.showPopover();
			} else {
				this.menu.dataset.fallbackOpen = '';
			}
			this.trigger.setAttribute('aria-expanded', 'true');
			this.position();
			markSelectActive(this.menu, this.trigger, this.active, this.open);
			document.addEventListener('pointerdown', this.onOutside, true);
			window.addEventListener('resize', this.position);
			window.addEventListener('scroll', this.position, true);
		}

		private close(): void {
			if (!this.open) {
				return;
			}
			this.open = false;
			window.clearTimeout(this.searchTimer);
			this.search = '';
			this.removeAttribute('open');
			if (this.menu.matches(':popover-open')) {
				this.menu.hidePopover();
			}
			delete this.menu.dataset.fallbackOpen;
			this.trigger.setAttribute('aria-expanded', 'false');
			this.trigger.removeAttribute('aria-activedescendant');
			document.removeEventListener('pointerdown', this.onOutside, true);
			window.removeEventListener('resize', this.position);
			window.removeEventListener('scroll', this.position, true);
		}

		private readonly onOutside = (event: PointerEvent): void => {
			if (!event.composedPath().includes(this)) {
				this.close();
			}
		};

		private readonly position = (): void => {
			if (!this.open) {
				return;
			}
			positionSelectMenu(this.menu, this.trigger);
		};

		private move(step: number): void {
			if (!this.open) {
				this.show();
			}
			if (!this.open) {
				return;
			}
			this.active = nextSelectActive(this.choices, this.active, step);
			markSelectActive(this.menu, this.trigger, this.active, this.open);
		}

		private commit(index: number): void {
			const choice = this.choices[index];
			if (!choice || choice.disabled || choice.hidden) {
				return;
			}
			const changed = this.value !== choice.value;
			this.value = choice.value;
			this.close();
			this.trigger.focus();
			if (changed) {
				this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
				this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
			}
		}

		private onKeyDown(event: KeyboardEvent): void {
			if (this.disabled) {
				return;
			}
			if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
				event.preventDefault();
				event.stopPropagation();
				this.move(event.key === 'ArrowDown' ? 1 : -1);
			} else if (event.key === 'Home' || event.key === 'End') {
				event.preventDefault();
				event.stopPropagation();
				this.show();
				this.active =
					event.key === 'Home'
						? nextSelectActive(this.choices, -1, 1)
						: nextSelectActive(this.choices, 0, -1);
				markSelectActive(this.menu, this.trigger, this.active, this.open);
			} else if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				event.stopPropagation();
				if (this.open) {
					this.commit(this.active);
				} else {
					this.show();
				}
			} else if (event.key === 'Escape' && this.open) {
				event.preventDefault();
				event.stopPropagation();
				this.close();
				this.trigger.focus();
			} else if (event.key === 'Tab') {
				this.close();
			} else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
				event.stopPropagation();
				this.search += event.key.toLocaleLowerCase();
				window.clearTimeout(this.searchTimer);
				this.searchTimer = window.setTimeout(() => {
					this.search = '';
				}, 700);
				this.show();
				const index = this.choices.findIndex(
					(choice) =>
						!choice.disabled &&
						!choice.hidden &&
						choice.label.toLocaleLowerCase().startsWith(this.search),
				);
				if (index >= 0) {
					this.active = index;
					markSelectActive(this.menu, this.trigger, this.active, this.open);
				}
			}
		}
	}

	registry.define('pptx-ui-select', PptxSelect);
}
