import type { StatusBarIntent, StatusBarViewState } from '../render';
import { attachControlStyles } from './control-styles';
import { STATUS_BAR_STYLES } from './status-bar-styles';
import { createStatusBarView } from './status-bar-view';

export type StatusBarRequestEvent = CustomEvent<StatusBarIntent>;
export interface PptxUiStatusBarElement extends HTMLElement {
	state: StatusBarViewState;
}
declare global {
	interface HTMLElementTagNameMap {
		'pptx-ui-status-bar': PptxUiStatusBarElement;
	}
}

/**
 * Controlled bottom status bar. Hosts supply translated state and own every
 * effect; user activation emits one bubbling, composed `status-request` event.
 * The named `collaboration` slot holds the host's connection indicator.
 */
export function definePptxStatusBar(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-status-bar')) {
		return;
	}
	class StatusBar extends HTMLElement implements PptxUiStatusBarElement {
		private model: StatusBarViewState = { slideCount: 0, activeSlideIndex: 0, saveText: '' };
		private readonly view = createStatusBarView(this.ownerDocument, (id) => {
			this.dispatchEvent(
				new CustomEvent('status-request', { detail: { id }, bubbles: true, composed: true }),
			);
		});
		constructor() {
			super();
			const root = this.attachShadow({ mode: 'open' });
			attachControlStyles(root, STATUS_BAR_STYLES);
			root.append(this.view.bar);
			this.view.render(this.model);
		}
		get state() {
			return this.model;
		}
		set state(value: StatusBarViewState) {
			this.model = value;
			this.view.render(value);
		}
		connectedCallback(): void {
			this.view.render(this.model);
		}
	}
	registry.define('pptx-ui-status-bar', StatusBar);
}
