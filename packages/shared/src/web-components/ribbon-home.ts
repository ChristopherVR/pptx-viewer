import { canRequestHome } from '../render';
import type { RibbonHomeFamily, RibbonHomeIntent, RibbonHomeViewState } from '../render';
import { attachRibbonHomeStyles } from './ribbon-home-styles';
import { createRibbonHomeView } from './ribbon-home-view';

export type RibbonHomeRequestEvent = CustomEvent<RibbonHomeIntent>;
export interface PptxUiRibbonHomeElement extends HTMLElement {
	state: RibbonHomeViewState;
	/** Wrapper (or button) of a control id, where a host mounts or anchors its native popover. */
	anchor(id: string): HTMLElement | undefined;
}
declare global {
	interface HTMLElementTagNameMap {
		'pptx-ui-ribbon-home-clipboard': PptxUiRibbonHomeElement;
		'pptx-ui-ribbon-home-font': PptxUiRibbonHomeElement;
		'pptx-ui-ribbon-home-paragraph': PptxUiRibbonHomeElement;
		'pptx-ui-ribbon-home-editing': PptxUiRibbonHomeElement;
		'pptx-ui-ribbon-home-slides': PptxUiRibbonHomeElement;
		'pptx-ui-ribbon-home-drawing': PptxUiRibbonHomeElement;
		'pptx-ui-ribbon-home-arrange-align': PptxUiRibbonHomeElement;
		'pptx-ui-ribbon-home-arrange-flip': PptxUiRibbonHomeElement;
		'pptx-ui-ribbon-home-arrange-order': PptxUiRibbonHomeElement;
		'pptx-ui-ribbon-home-arrange-edit': PptxUiRibbonHomeElement;
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
		anchor(id: string): HTMLElement | undefined {
			return this.view.anchor(id);
		}
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
export const definePptxRibbonHomeSlides = (registry: CustomElementRegistry) =>
	definePptxRibbonHome(registry, 'slides');
export const definePptxRibbonHomeDrawing = (registry: CustomElementRegistry) =>
	definePptxRibbonHome(registry, 'drawing');
export const definePptxRibbonHomeArrangeAlign = (registry: CustomElementRegistry) =>
	definePptxRibbonHome(registry, 'arrange-align');
export const definePptxRibbonHomeArrangeFlip = (registry: CustomElementRegistry) =>
	definePptxRibbonHome(registry, 'arrange-flip');
export const definePptxRibbonHomeArrangeOrder = (registry: CustomElementRegistry) =>
	definePptxRibbonHome(registry, 'arrange-order');
export const definePptxRibbonHomeArrangeEdit = (registry: CustomElementRegistry) =>
	definePptxRibbonHome(registry, 'arrange-edit');
