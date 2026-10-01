import { canRequestView } from '../render';
import type { RibbonViewIntent, RibbonViewState } from '../render';
import { attachRibbonViewStyles } from './ribbon-view-styles';
import { createRibbonViewView } from './ribbon-view-view';

export type RibbonViewRequestEvent = CustomEvent<RibbonViewIntent>;
export interface PptxUiRibbonViewElement extends HTMLElement {
	state: RibbonViewState;
}
declare global {
	interface HTMLElementTagNameMap {
		'pptx-ui-ribbon-view': PptxUiRibbonViewElement;
	}
}

/** Controlled View chrome; viewer options, history and navigation stay with the host. */
export function definePptxRibbonView(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-ribbon-view')) {
		return;
	}
	class RibbonView extends HTMLElement implements PptxUiRibbonViewElement {
		private model: RibbonViewState = {
			editable: false,
			showRulers: false,
			showGrid: false,
			showGuides: false,
			snapToGrid: false,
			snapToShape: false,
			templateEditing: false,
		};
		private readonly view = createRibbonViewView(this.ownerDocument, (intent) => {
			if (canRequestView(this.model, intent)) {
				this.dispatchEvent(
					new CustomEvent('view-request', { detail: intent, bubbles: true, composed: true }),
				);
			}
			// The host stays the source of truth: restore controlled checkbox state.
			queueMicrotask(() => this.view.sync(this.model));
		});
		get state() {
			return this.model;
		}
		set state(value: RibbonViewState) {
			this.model = value;
			this.render();
		}
		connectedCallback(): void {
			attachRibbonViewStyles(this.ownerDocument);
			this.render();
		}
		private render(): void {
			const wanted = this.view.layout(this.model);
			wanted.forEach((el, index) => {
				if (this.children[index] !== el) {
					this.insertBefore(el, this.children[index] ?? null);
				}
			});
			while (this.children.length > wanted.length) {
				this.lastElementChild?.remove();
			}
			this.view.sync(this.model);
		}
	}
	registry.define('pptx-ui-ribbon-view', RibbonView);
}
