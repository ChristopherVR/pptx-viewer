import { canRequestInsert } from '../render';
import type { RibbonInsertIntent, RibbonInsertState } from '../render';
import { attachRibbonInsertStyles } from './ribbon-insert-styles';
import { createRibbonInsertView } from './ribbon-insert-view';

export type RibbonInsertRequestEvent = CustomEvent<RibbonInsertIntent>;
export interface PptxUiRibbonInsertElement extends HTMLElement {
	state: RibbonInsertState;
	/** Return focus to a control by its public id, e.g. after a native dialog closes. */
	focusControl(id: string): void;
}
declare global {
	interface HTMLElementTagNameMap {
		'pptx-ui-ribbon-insert': PptxUiRibbonInsertElement;
	}
}

/** Controlled Insert chrome; document mutation, dialogs and history stay with the host. */
export function definePptxRibbonInsert(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-ribbon-insert')) {
		return;
	}
	class RibbonInsert extends HTMLElement implements PptxUiRibbonInsertElement {
		private model: RibbonInsertState = {
			editable: false,
			hasSelection: false,
			shapeType: 'rect',
			chartKind: 'column',
		};
		private readonly view = createRibbonInsertView(this.ownerDocument, (intent) => {
			if (canRequestInsert(this.model, intent)) {
				this.dispatchEvent(
					new CustomEvent('insert-request', { detail: intent, bubbles: true, composed: true }),
				);
			}
			// The host stays the source of truth: restore controlled select values.
			queueMicrotask(() => this.view.sync(this.model));
		});
		private readonly outside = (event: PointerEvent) => {
			if (!this.contains(event.target as Node)) {
				this.closeMenus();
			}
		};
		private readonly escape = (event: KeyboardEvent) => {
			const open = this.view.menus.find((menu) => menu.isOpen());
			if (event.key === 'Escape' && open) {
				event.preventDefault();
				event.stopPropagation();
				open.close();
				open.trigger.focus();
			}
		};
		private readonly position = () => this.view.menus.forEach((menu) => menu.place());
		get state() {
			return this.model;
		}
		set state(value: RibbonInsertState) {
			this.model = value;
			this.render();
		}
		connectedCallback(): void {
			attachRibbonInsertStyles(this.ownerDocument);
			this.render();
			this.ownerDocument.addEventListener('pointerdown', this.outside);
			this.ownerDocument.addEventListener('keydown', this.escape, true);
			this.ownerDocument.defaultView?.addEventListener('resize', this.position);
			this.ownerDocument.addEventListener('scroll', this.position, true);
		}
		disconnectedCallback(): void {
			this.closeMenus();
			this.ownerDocument.removeEventListener('pointerdown', this.outside);
			this.ownerDocument.removeEventListener('keydown', this.escape, true);
			this.ownerDocument.defaultView?.removeEventListener('resize', this.position);
			this.ownerDocument.removeEventListener('scroll', this.position, true);
		}
		focusControl(id: string): void {
			const control = this.querySelector(`[data-ribbon-control="${id}"]`);
			(control?.shadowRoot ?? control)?.querySelector('button')?.focus();
		}
		private closeMenus(): void {
			this.view.menus.forEach((menu) => menu.close());
		}
		private render(): void {
			this.view.root.forEach((el, index) => {
				if (this.children[index] !== el) {
					this.insertBefore(el, this.children[index] ?? null);
				}
			});
			this.view.sync(this.model);
		}
	}
	registry.define('pptx-ui-ribbon-insert', RibbonInsert);
}
