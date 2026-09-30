import type { RibbonControlId } from '../render';
import { attachControlStyles } from './control-styles';

export type RibbonToggleRequestEvent = CustomEvent<{ id: RibbonControlId; checked: boolean }>;

/** Controlled checkbox row sharing the existing checkbox's keyboard and focus behavior. */
export function definePptxRibbonToggle(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-ribbon-toggle')) {
		return;
	}
	class RibbonToggle extends HTMLElement {
		static observedAttributes = ['label', 'checked', 'disabled', 'title'];
		private readonly checkbox: HTMLElement & { checked: boolean; disabled: boolean };
		private readonly text: Text;
		constructor() {
			super();
			const root = this.attachShadow({ mode: 'open' });
			attachControlStyles(
				root,
				`
:host { display: block; }
label { display: flex; align-items: center; gap: 4px; min-height: 22px; padding: 0 4px;
	color: var(--pptx-foreground, #f9fafb); font: inherit; font-size: 10px; white-space: nowrap; cursor: pointer; }
:host([disabled]) label { color: var(--pptx-muted-foreground, #9ca3af); cursor: not-allowed; }
@media (pointer: coarse), (max-width: 767px) { label { min-height: 44px; font-size: 12px; } }
`,
			);
			const label = document.createElement('label');
			this.checkbox = document.createElement('pptx-ui-checkbox') as typeof this.checkbox;
			this.text = document.createTextNode('');
			label.append(this.checkbox, this.text);
			label.addEventListener('click', (event) => {
				event.preventDefault();
				if (event.target !== this.checkbox) {
					this.checkbox.click();
				}
			});
			this.checkbox.addEventListener('input', (event) => event.stopPropagation());
			this.checkbox.addEventListener('change', (event) => {
				event.stopPropagation();
				const checked = this.checkbox.checked;
				this.sync();
				const id = this.getAttribute('data-ribbon-control');
				if (!this.hasAttribute('disabled') && id) {
					this.dispatchEvent(
						new CustomEvent('toggle-request', {
							detail: { id, checked },
							bubbles: true,
							composed: true,
						}),
					);
				}
			});
			root.append(label);
		}
		connectedCallback(): void {
			this.sync();
		}
		attributeChangedCallback(): void {
			this.sync();
		}
		private sync(): void {
			const label = this.getAttribute('label') ?? '';
			this.text.textContent = label;
			this.checkbox.setAttribute('aria-label', label);
			this.checkbox.title = this.getAttribute('title') ?? label;
			this.checkbox.checked = this.hasAttribute('checked');
			this.checkbox.disabled = this.hasAttribute('disabled');
		}
	}
	registry.define('pptx-ui-ribbon-toggle', RibbonToggle);
}
