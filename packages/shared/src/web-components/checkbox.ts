import { CHECKBOX_STYLES } from './checkbox-styles';
import { attachControlStyles } from './control-styles';

/** Native-form-compatible checkbox glyph with one event contract in every binding. */
export function definePptxCheckbox(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-checkbox')) {
		return;
	}

	class PptxCheckbox extends HTMLElement {
		static formAssociated = true;
		static observedAttributes = ['checked', 'disabled', 'value'];
		private readonly internals: ElementInternals | undefined;
		private defaultChecked = false;

		constructor() {
			super();
			try {
				this.internals = this.attachInternals();
			} catch {
				this.internals = undefined;
			}
			const root = this.attachShadow({ mode: 'open' });
			attachControlStyles(root, CHECKBOX_STYLES);
			const icon = document.createElement('template');
			icon.innerHTML =
				'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 8 3.2 3.2L13 4.5"/></svg>';
			root.append(icon.content.cloneNode(true));
			this.addEventListener('click', (event) => {
				if (this.disabled) {
					event.preventDefault();
					return;
				}
				this.toggle();
			});
			this.addEventListener('keydown', (event) => {
				if (event.key !== ' ' || this.disabled) {
					return;
				}
				event.preventDefault();
				this.toggle();
			});
		}

		connectedCallback(): void {
			this.defaultChecked = this.checked;
			this.sync();
		}

		attributeChangedCallback(): void {
			this.sync();
		}

		get checked(): boolean {
			return this.hasAttribute('checked');
		}
		set checked(next: boolean) {
			this.toggleAttribute('checked', Boolean(next));
		}
		get disabled(): boolean {
			return this.hasAttribute('disabled');
		}
		set disabled(next: boolean) {
			this.toggleAttribute('disabled', Boolean(next));
		}
		get value(): string {
			return this.getAttribute('value') ?? 'on';
		}
		set value(next: string) {
			this.setAttribute('value', String(next));
		}

		formResetCallback(): void {
			this.checked = this.defaultChecked;
		}
		formDisabledCallback(disabled: boolean): void {
			this.disabled = disabled;
		}

		private toggle(): void {
			this.checked = !this.checked;
			this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
			this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
		}

		private sync(): void {
			this.setAttribute('role', 'checkbox');
			this.setAttribute('aria-checked', String(this.checked));
			this.setAttribute('aria-disabled', String(this.disabled));
			this.tabIndex = this.disabled ? -1 : 0;
			this.internals?.setFormValue?.(this.checked && !this.disabled ? this.value : null);
		}
	}

	registry.define('pptx-ui-checkbox', PptxCheckbox);
}
