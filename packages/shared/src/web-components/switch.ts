import { attachControlStyles } from './control-styles';
import { SWITCH_STYLES } from './switch-styles';

/** On/off switch (`role="switch"`): Space or Enter toggles, a disabled switch is inert. */
export function definePptxSwitch(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-switch')) {
		return;
	}

	class PptxSwitch extends HTMLElement {
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
			attachControlStyles(root, SWITCH_STYLES);
			const hit = document.createElement('span');
			hit.className = 'hit';
			const knob = document.createElement('span');
			knob.className = 'knob';
			root.append(hit, knob);
			this.addEventListener('click', (event) => {
				if (this.disabled) {
					event.preventDefault();
					event.stopImmediatePropagation();
					return;
				}
				this.toggle();
			});
			this.addEventListener('keydown', (event) => {
				if ((event.key !== ' ' && event.key !== 'Enter') || this.disabled) {
					return;
				}
				event.preventDefault();
				event.stopPropagation();
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
			this.setAttribute('role', 'switch');
			this.setAttribute('aria-checked', String(this.checked));
			this.setAttribute('aria-disabled', String(this.disabled));
			this.tabIndex = this.disabled ? -1 : 0;
			this.internals?.setFormValue?.(this.checked && !this.disabled ? this.value : null);
		}
	}

	registry.define('pptx-ui-switch', PptxSwitch);
}
