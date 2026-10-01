import { canRequestHome } from '../render';
import type { RibbonHomeFamily, RibbonHomeIntent, RibbonHomeViewState } from '../render';
import { attachRibbonHomeStyles } from './ribbon-home-styles';
import { createRibbonHomeView } from './ribbon-home-view';

export type RibbonHomeRequestEvent = CustomEvent<RibbonHomeIntent>;
export interface PptxUiRibbonHomeElement extends HTMLElement {
	state: RibbonHomeViewState;
}
declare global {
	interface HTMLElementTagNameMap {
		'pptx-ui-ribbon-home-clipboard': PptxUiRibbonHomeElement;
		'pptx-ui-ribbon-home-font': PptxUiRibbonHomeElement;
		'pptx-ui-ribbon-home-paragraph': PptxUiRibbonHomeElement;
		'pptx-ui-ribbon-home-editing': PptxUiRibbonHomeElement;
	}
}

/** Controlled Home command strips; document edits stay with the host that listens. */
export function definePptxRibbonHome(
	registry: CustomElementRegistry,
	family: RibbonHomeFamily,
): void {
	const tag = `pptx-ui-ribbon-home-${family}`;
	if (registry.get(tag)) {
		return;
	}
	class RibbonHome extends HTMLElement implements PptxUiRibbonHomeElement {
		private model: RibbonHomeViewState = { controls: {} };
		private readonly view = createRibbonHomeView(this.ownerDocument, family, (intent) => {
			if (canRequestHome(family, this.model, intent)) {
				this.dispatchEvent(
					new CustomEvent('home-request', { detail: intent, bubbles: true, composed: true }),
				);
			}
		});
		get state() {
			return this.model;
		}
		set state(value: RibbonHomeViewState) {
			this.model = value;
			this.render();
		}
		connectedCallback(): void {
			attachRibbonHomeStyles(this.ownerDocument);
			this.render();
		}
		private render(): void {
			if (!this.contains(this.view.root)) {
				this.append(this.view.root);
			}
			this.view.sync(this.model);
		}
	}
	registry.define(tag, RibbonHome);
}

export const definePptxRibbonHomeClipboard = (registry: CustomElementRegistry) =>
	definePptxRibbonHome(registry, 'clipboard');
export const definePptxRibbonHomeFont = (registry: CustomElementRegistry) =>
	definePptxRibbonHome(registry, 'font');
export const definePptxRibbonHomeParagraph = (registry: CustomElementRegistry) =>
	definePptxRibbonHome(registry, 'paragraph');
export const definePptxRibbonHomeEditing = (registry: CustomElementRegistry) =>
	definePptxRibbonHome(registry, 'editing');
