import { PASTE_SPECIAL_OPTIONS } from '../render';
import type { PasteOptionsIntent, PasteOptionsViewState } from '../render';
import { attachControlStyles } from './control-styles';
import { PASTE_OPTIONS_STYLES } from './paste-options-styles';

export type PasteOptionsRequestEvent = CustomEvent<PasteOptionsIntent>;
export interface PptxUiPasteOptionsElement extends HTMLElement {
	state: PasteOptionsViewState;
}
declare global {
	interface HTMLElementTagNameMap {
		'pptx-ui-paste-options': PptxUiPasteOptionsElement;
	}
}

const identity = (key: string): string => key;

/**
 * The Paste Options strip PowerPoint anchors to a just-pasted element. Hosts
 * measure the element and pass its bottom-right corner; the strip is fixed at
 * a 4px offset from it. It emits `paste-options-request` for a choice and
 * `paste-options-dismiss` for the first pointerdown or keydown outside it
 * (Escape inside it too), armed one task after connecting so the paste's own
 * gesture does not dismiss it. The host carries `data-pptx-paste-options`.
 */
export function definePptxPasteOptions(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-paste-options')) {
		return;
	}
	class PasteOptions extends HTMLElement implements PptxUiPasteOptionsElement {
		private model: PasteOptionsViewState = { left: 0, top: 0 };
		private readonly toolbar = this.ownerDocument.createElement('div');
		private readonly buttons = PASTE_SPECIAL_OPTIONS.map((option) => {
			const button = this.ownerDocument.createElement('button');
			button.type = 'button';
			button.addEventListener('click', () =>
				this.dispatchEvent(
					new CustomEvent<PasteOptionsIntent>('paste-options-request', {
						detail: { format: option.id },
						bubbles: true,
						composed: true,
					}),
				),
			);
			return button;
		});
		private disarm: (() => void) | undefined;
		constructor() {
			super();
			const root = this.attachShadow({ mode: 'open' });
			attachControlStyles(root, PASTE_OPTIONS_STYLES);
			this.toolbar.className = 'toolbar';
			this.toolbar.setAttribute('role', 'toolbar');
			this.toolbar.tabIndex = -1;
			this.toolbar.append(...this.buttons);
			// Keep a press on the strip from reaching the slide canvas underneath.
			this.toolbar.addEventListener('mousedown', (event) => event.stopPropagation());
			root.append(this.toolbar);
		}
		get state() {
			return this.model;
		}
		set state(value: PasteOptionsViewState) {
			this.model = value;
			this.render();
		}
		connectedCallback(): void {
			this.render();
			const view = this.ownerDocument.defaultView;
			if (!view) {
				return;
			}
			const dismiss = (event: Event) => {
				if (event.composedPath().includes(this.toolbar)) {
					if (!(event instanceof KeyboardEvent) || event.key !== 'Escape') {
						return;
					}
				}
				this.dispatchEvent(
					new CustomEvent('paste-options-dismiss', { bubbles: true, composed: true }),
				);
			};
			const timer = view.setTimeout(() => {
				view.addEventListener('pointerdown', dismiss, true);
				view.addEventListener('keydown', dismiss, true);
			}, 0);
			this.disarm = () => {
				view.clearTimeout(timer);
				view.removeEventListener('pointerdown', dismiss, true);
				view.removeEventListener('keydown', dismiss, true);
			};
		}
		disconnectedCallback(): void {
			this.disarm?.();
			this.disarm = undefined;
		}
		private render(): void {
			const s = this.model;
			const t = s.translate ?? identity;
			this.dataset.pptxPasteOptions = '';
			this.toolbar.setAttribute('aria-label', t('pptx.pasteSpecial.optionsLabel'));
			this.toolbar.style.left = `${s.left + 4}px`;
			this.toolbar.style.top = `${s.top + 4}px`;
			PASTE_SPECIAL_OPTIONS.forEach((option, index) => {
				const text = t(option.labelKey);
				this.buttons[index].textContent = text;
				this.buttons[index].title = text;
			});
		}
	}
	registry.define('pptx-ui-paste-options', PasteOptions);
}
