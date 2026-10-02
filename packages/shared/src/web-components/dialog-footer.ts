import type { DialogFooterAction, DialogFooterIntent, DialogFooterViewState } from '../render';
import { createChromeIcon } from './chrome-icons';
import { attachControlStyles } from './control-styles';
import { DIALOG_FOOTER_STYLES } from './dialog-footer-styles';

export type DialogFooterRequestEvent = CustomEvent<DialogFooterIntent>;
export interface PptxUiDialogFooterElement extends HTMLElement {
	state: DialogFooterViewState;
	/** Move keyboard focus to an action, e.g. the primary one when a dialog opens. */
	focusAction(id: string): void;
}
declare global {
	interface HTMLElementTagNameMap {
		'pptx-ui-dialog-footer': PptxUiDialogFooterElement;
	}
}

/**
 * The action row at the bottom of a dialog: Cancel, OK, Apply, Close and the
 * like. It is not a dialog shell. The host keeps the modal, its focus trap,
 * dismissal and backdrop, and maps each `dialog-footer-request` intent to the
 * dialog's own handler. Buttons are plain `button` elements in the open shadow
 * root, so a trap that walks shadow roots (`activateModalFocus`) reaches them.
 * Buttons are keyed by action id and updated in place, so focus and any
 * reference to a button survive a state change such as disabling both actions.
 */
export function definePptxDialogFooter(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-dialog-footer')) {
		return;
	}
	class DialogFooter extends HTMLElement implements PptxUiDialogFooterElement {
		private model: DialogFooterViewState = { actions: [] };
		private readonly row = this.ownerDocument.createElement('div');
		private readonly buttons = new Map<string, HTMLButtonElement>();
		constructor() {
			super();
			const root = this.attachShadow({ mode: 'open' });
			attachControlStyles(root, DIALOG_FOOTER_STYLES);
			this.row.className = 'footer';
			this.row.setAttribute('part', 'footer');
			root.append(this.row);
		}
		get state() {
			return this.model;
		}
		set state(value: DialogFooterViewState) {
			this.model = value;
			this.render();
		}
		connectedCallback(): void {
			this.render();
		}
		focusAction(id: string): void {
			this.render();
			this.buttons.get(id)?.focus();
		}
		private button(id: string): HTMLButtonElement {
			let button = this.buttons.get(id);
			if (!button) {
				button = this.ownerDocument.createElement('button');
				button.type = 'button';
				button.dataset.action = id;
				button.addEventListener('click', () =>
					this.dispatchEvent(
						new CustomEvent<DialogFooterIntent>('dialog-footer-request', {
							detail: { id },
							bubbles: true,
							composed: true,
						}),
					),
				);
				this.buttons.set(id, button);
			}
			return button;
		}
		private patch(button: HTMLButtonElement, action: DialogFooterAction): void {
			button.className = action.variant === 'secondary' ? '' : (action.variant ?? '');
			button.disabled = action.disabled === true || action.busy === true;
			if (action.title) {
				button.title = action.title;
			} else {
				button.removeAttribute('title');
			}
			button.classList.toggle('start', action.align === 'start');
			button.classList.toggle('busy', action.busy === true);
			if (action.busy) {
				button.setAttribute('aria-busy', 'true');
			} else {
				button.removeAttribute('aria-busy');
			}
			if (action.testId) {
				button.dataset.testid = action.testId;
			} else {
				delete button.dataset.testid;
			}
			const icon = action.icon ?? '';
			if (button.dataset.icon !== icon || button.dataset.label !== action.label) {
				button.dataset.icon = icon;
				button.dataset.label = action.label;
				button.replaceChildren(
					...(action.icon ? [createChromeIcon(this.ownerDocument, action.icon)] : []),
					this.ownerDocument.createTextNode(action.label),
				);
			}
		}
		private render(): void {
			const wanted = this.model.actions.map((action) => {
				const button = this.button(action.id);
				this.patch(button, action);
				return button;
			});
			for (const [id, button] of this.buttons) {
				if (!wanted.includes(button)) {
					button.remove();
					this.buttons.delete(id);
				}
			}
			// Touch the DOM only when the order differs, so focus is never dropped.
			const current = Array.from(this.row.children);
			if (current.length !== wanted.length || wanted.some((button, i) => current[i] !== button)) {
				this.row.append(...wanted);
			}
		}
	}
	registry.define('pptx-ui-dialog-footer', DialogFooter);
}
