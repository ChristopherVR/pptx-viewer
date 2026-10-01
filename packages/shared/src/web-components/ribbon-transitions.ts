import { EMPTY_RIBBON_TRANSITION_DRAFT, canRequestTransitions } from '../render';
import type { RibbonTransitionsIntent, RibbonTransitionsViewState } from '../render';
import { attachRibbonTransitionsStyles } from './ribbon-transitions-styles';
import { createRibbonTransitionsView } from './ribbon-transitions-view';

export type RibbonTransitionsRequestEvent = CustomEvent<RibbonTransitionsIntent>;
export interface PptxUiRibbonTransitionsElement extends HTMLElement {
	state: RibbonTransitionsViewState;
}
declare global {
	interface HTMLElementTagNameMap {
		'pptx-ui-ribbon-transitions': PptxUiRibbonTransitionsElement;
	}
}

const TYPED_FIELDS = 'input[type=text],input[type=number],select';

/** Controlled Transitions chrome; slide edits, history and preview timing stay with the host. */
export function definePptxRibbonTransitions(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-ribbon-transitions')) {
		return;
	}
	class RibbonTransitions extends HTMLElement implements PptxUiRibbonTransitionsElement {
		private model: RibbonTransitionsViewState = {
			draft: { ...EMPTY_RIBBON_TRANSITION_DRAFT },
			editable: false,
		};
		private readonly view = createRibbonTransitionsView(this.ownerDocument, (intent) => {
			if (canRequestTransitions(this.model, intent)) {
				this.dispatchEvent(
					new CustomEvent('transitions-request', {
						detail: intent,
						bubbles: true,
						composed: true,
					}),
				);
			}
			// The host stays the source of truth: restore controlled control state.
			// A macrotask, not a microtask: async hosts (change detection) update first.
			setTimeout(() => this.view.sync(this.model));
		});
		constructor() {
			super();
			this.addEventListener('keydown', (event) => {
				const typed = (event.target as Element | null)?.matches?.(TYPED_FIELDS);
				if (
					typed ||
					[' ', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
				) {
					event.stopPropagation();
				}
			});
			// A half-typed value never outlives the field: blur snaps back to the model.
			this.addEventListener('focusout', () => setTimeout(() => this.view.sync(this.model)));
		}
		get state() {
			return this.model;
		}
		set state(value: RibbonTransitionsViewState) {
			this.model = value;
			this.render();
		}
		connectedCallback(): void {
			attachRibbonTransitionsStyles(this.ownerDocument);
			this.render();
		}
		private render(): void {
			this.view.layout.forEach((el, index) => {
				if (this.children[index] !== el) {
					this.insertBefore(el, this.children[index] ?? null);
				}
			});
			this.view.sync(this.model);
		}
	}
	registry.define('pptx-ui-ribbon-transitions', RibbonTransitions);
}
