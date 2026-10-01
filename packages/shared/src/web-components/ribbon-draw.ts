import { canRequestDraw } from '../render';
import type { RibbonDrawIntent, RibbonDrawViewState } from '../render';
import { attachRibbonDrawStyles } from './ribbon-draw-styles';
import { createRibbonDrawView } from './ribbon-draw-view';

export type RibbonDrawRequestEvent = CustomEvent<RibbonDrawIntent>;
export interface PptxUiRibbonDrawElement extends HTMLElement {
	state: RibbonDrawViewState;
}
declare global {
	interface HTMLElementTagNameMap {
		'pptx-ui-ribbon-draw': PptxUiRibbonDrawElement;
	}
}

/** Controlled inking chrome, distinct from document gestures and history. */
export function definePptxRibbonDraw(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-ribbon-draw')) {
		return;
	}
	class RibbonDraw extends HTMLElement implements PptxUiRibbonDrawElement {
		private model: RibbonDrawViewState = {
			tool: 'select',
			color: '#000000',
			width: 3,
			editable: false,
		};
		private readonly view = createRibbonDrawView(this.ownerDocument, (intent) => {
			if (canRequestDraw(this.model, intent)) {
				this.dispatchEvent(
					new CustomEvent('draw-request', { detail: intent, bubbles: true, composed: true }),
				);
			}
		});
		private readonly outside = (event: PointerEvent) => {
			if (!this.contains(event.target as Node)) {
				this.view.colors.open = false;
			}
		};
		private readonly position = () => this.view.placePalette();
		private readonly escape = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && this.view.colors.open) {
				event.preventDefault();
				event.stopPropagation();
				this.view.colors.open = false;
				this.view.trigger.focus();
			}
		};
		constructor() {
			super();
			this.view.trigger.addEventListener('click', (event) => {
				if (!this.model.editable) {
					event.preventDefault();
				}
			});
			this.view.group.addEventListener('keydown', (event) => {
				if (event.key === 'Escape') {
					this.escape(event);
				}
				if ([' ', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
					event.stopPropagation();
				}
			});
		}
		get state() {
			return this.model;
		}
		set state(value: RibbonDrawViewState) {
			this.model = value;
			this.render();
		}
		connectedCallback(): void {
			attachRibbonDrawStyles(this.ownerDocument);
			this.render();
			this.ownerDocument.addEventListener('pointerdown', this.outside);
			this.ownerDocument.addEventListener('keydown', this.escape);
			this.ownerDocument.defaultView?.addEventListener('resize', this.position);
			this.ownerDocument.addEventListener('scroll', this.position, true);
		}
		disconnectedCallback(): void {
			this.view.colors.open = false;
			this.ownerDocument.removeEventListener('pointerdown', this.outside);
			this.ownerDocument.removeEventListener('keydown', this.escape);
			this.ownerDocument.defaultView?.removeEventListener('resize', this.position);
			this.ownerDocument.removeEventListener('scroll', this.position, true);
		}
		private render(): void {
			if (!this.contains(this.view.group)) {
				this.append(this.view.group);
			}
			this.view.sync(this.model);
		}
	}
	registry.define('pptx-ui-ribbon-draw', RibbonDraw);
}
