import { canRequestAnimations } from '../render';
import type { RibbonAnimationsIntent, RibbonAnimationsViewState } from '../render';
import { attachRibbonAnimationsStyles } from './ribbon-animations-styles';
import { createRibbonAnimationsView } from './ribbon-animations-view';

export type RibbonAnimationsRequestEvent = CustomEvent<RibbonAnimationsIntent>;
export interface PptxUiRibbonAnimationsElement extends HTMLElement {
	state: RibbonAnimationsViewState;
}
declare global {
	interface HTMLElementTagNameMap {
		'pptx-ui-ribbon-animations': PptxUiRibbonAnimationsElement;
	}
}

/** Controlled Animations chrome; slide edits, history and the pane stay with the host. */
export function definePptxRibbonAnimations(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-ribbon-animations')) {
		return;
	}
	class RibbonAnimations extends HTMLElement implements PptxUiRibbonAnimationsElement {
		private model: RibbonAnimationsViewState = { editable: false, hasSelection: false };
		private readonly view = createRibbonAnimationsView(this.ownerDocument, (intent) => {
			if (canRequestAnimations(this.model, intent)) {
				this.dispatchEvent(
					new CustomEvent('animations-request', { detail: intent, bubbles: true, composed: true }),
				);
			}
		});
		get state() {
			return this.model;
		}
		set state(value: RibbonAnimationsViewState) {
			this.model = value;
			this.render();
		}
		connectedCallback(): void {
			attachRibbonAnimationsStyles(this.ownerDocument);
			this.render();
		}
		private render(): void {
			this.view.groups.forEach((el, index) => {
				if (this.children[index] !== el) {
					this.insertBefore(el, this.children[index] ?? null);
				}
			});
			this.view.sync(this.model);
		}
	}
	registry.define('pptx-ui-ribbon-animations', RibbonAnimations);
}
