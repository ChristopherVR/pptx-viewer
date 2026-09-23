const SEARCH_ICON = `<svg part="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`;

const SEARCH_STYLES = `
:host { display: flex; align-items: center; gap: 8px; box-sizing: border-box; width: 100%; height: 40px; padding: 0 12px; border: 1px solid var(--pptx-input, #374151); background: var(--pptx-card, #111827); color: var(--pptx-muted-foreground, #9ca3af); font: inherit; }
:host(:focus-within) { border-color: var(--pptx-ring, #6366f1); }
:host([variant="titlebar"]) { height: 28px; gap: 7px; padding-inline: 14px; border-color: var(--pptx-border, #374151); border-radius: 6px; background: var(--pptx-background, #030712); }
:host([variant="titlebar"]:focus-within) { border-color: var(--pptx-ring, #6366f1); color: var(--pptx-foreground, #f3f4f6); }
:host([disabled]) { opacity: .5; cursor: not-allowed; }
svg { width: 16px; height: 16px; flex: none; }
:host([variant="titlebar"]) svg { width: 14px; height: 14px; }
input { min-width: 0; width: 100%; height: 100%; flex: 1; padding: 0; border: 0; outline: 0; background: transparent; color: var(--pptx-card-foreground, #f3f4f6); font: inherit; font-size: 13px; }
:host([variant="titlebar"]) input { font-size: 11px; color: var(--pptx-foreground, #f3f4f6); }
input::placeholder { color: var(--pptx-muted-foreground, #9ca3af); opacity: .8; }
input::-webkit-search-cancel-button { display: none; }
@media (forced-colors: active) { :host { border-color: CanvasText; background: Canvas; color: CanvasText; } :host(:focus-within) { outline: 2px solid Highlight; outline-offset: 2px; } input { color: CanvasText; } }
`;

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
			const style = document.createElement('style');
			style.textContent = SEARCH_STYLES;
			root.append(style);
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
