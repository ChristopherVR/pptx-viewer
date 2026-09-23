import { attachControlStyles } from './control-styles';
import { SEARCH_STYLES } from './search-field-styles';

const SEARCH_ICON = `<svg part="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`;

/** A single styled search input for the title bar and recent-files surface. */
export function definePptxSearchField(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-search')) {
		return;
	}

	class PptxSearchField extends HTMLElement {
		static observedAttributes = ['placeholder', 'aria-label', 'disabled', 'value'];
		private readonly input: HTMLInputElement;
		private currentValue = '';

		constructor() {
			super();
			const root = this.attachShadow({ mode: 'open', delegatesFocus: true });
			attachControlStyles(root, SEARCH_STYLES);
			const icon = document.createElement('template');
			icon.innerHTML = SEARCH_ICON;
			root.append(icon.content.cloneNode(true));
			this.input = document.createElement('input');
			this.input.type = 'search';
			this.input.setAttribute('part', 'input');
			this.input.addEventListener('input', (event) => {
				event.stopPropagation();
				this.currentValue = this.input.value;
				this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
			});
			this.input.addEventListener('change', (event) => {
				event.stopPropagation();
				this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
			});
			root.append(this.input);
		}

		connectedCallback(): void {
			this.sync();
			if (this.hasAttribute('value')) {
				this.value = this.getAttribute('value') ?? '';
			}
		}

		attributeChangedCallback(name: string): void {
			if (name === 'value') {
				this.value = this.getAttribute('value') ?? '';
			} else {
				this.sync();
			}
		}

		get value(): string {
			return this.currentValue;
		}
		set value(next: string) {
			this.currentValue = String(next ?? '');
			if (this.input.value !== this.currentValue) {
				this.input.value = this.currentValue;
			}
		}
		get disabled(): boolean {
			return this.hasAttribute('disabled');
		}
		set disabled(next: boolean) {
			this.toggleAttribute('disabled', Boolean(next));
		}

		override focus(options?: FocusOptions): void {
			this.input.focus(options);
		}
		select(): void {
			this.input.select();
		}

		private sync(): void {
			this.input.placeholder = this.getAttribute('placeholder') ?? '';
			this.input.setAttribute(
				'aria-label',
				this.getAttribute('aria-label') ?? this.input.placeholder,
			);
			this.input.disabled = this.hasAttribute('disabled');
		}
	}

	registry.define('pptx-ui-search', PptxSearchField);
}
