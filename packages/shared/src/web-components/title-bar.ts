import type {
	TitleBarEventDetails,
	TitleBarPlacement,
	TitleBarSearchDetail,
	TitleBarViewState,
} from '../render';
import { attachControlStyles } from './control-styles';
import { TITLE_BAR_STYLES } from './title-bar-styles';
import { createTitleBarView } from './title-bar-view';

export type TitleBarEvent<K extends keyof TitleBarEventDetails> = CustomEvent<
	TitleBarEventDetails[K]
>;
export type TitleBarCommandSearchEvent = CustomEvent<TitleBarSearchDetail>;
export interface PptxUiTitleBarElement extends HTMLElement {
	state: TitleBarViewState | undefined;
	placement: TitleBarPlacement;
}
declare global {
	interface HTMLElementTagNameMap {
		'pptx-ui-title-bar': PptxUiTitleBarElement;
	}
}

/** Neutral state until the host supplies one: nothing editable, no strip. */
const EMPTY_STATE: TitleBarViewState = {
	editing: false,
	searchVisible: false,
	autosave: { enabled: false, statusKey: '' },
	history: { canUndo: false, canRedo: false },
	quickAccess: { visible: false, position: 'above', showCommandLabels: false, commandIds: [] },
};

/**
 * Controlled title bar and quick-access strip. Hosts supply translated state and
 * own every effect; user activation emits one bubbling, composed event
 * (`toggle-autosave`, `save`, `undo`, `redo`, `quick-command`, `command-search`).
 * Named slots `collaboration` and `account` hold host-owned parts.
 * `placement="belowRibbon"` renders only the options-driven extras row.
 */
export function definePptxTitleBar(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-title-bar')) {
		return;
	}
	class TitleBar extends HTMLElement implements PptxUiTitleBarElement {
		static observedAttributes = ['placement'];
		private model: TitleBarViewState = EMPTY_STATE;
		private readonly view = createTitleBarView(this.ownerDocument, (name, detail) => {
			this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
		});
		constructor() {
			super();
			const root = this.attachShadow({ mode: 'open' });
			attachControlStyles(root, TITLE_BAR_STYLES);
			root.append(this.view.bar);
		}
		get state() {
			return this.model;
		}
		set state(value: TitleBarViewState | undefined) {
			this.model = value ?? EMPTY_STATE;
			this.paint();
		}
		get placement(): TitleBarPlacement {
			return this.getAttribute('placement') === 'belowRibbon' ? 'belowRibbon' : 'titleBar';
		}
		set placement(value: TitleBarPlacement) {
			this.setAttribute('placement', value);
		}
		connectedCallback(): void {
			this.paint();
		}
		attributeChangedCallback(): void {
			this.paint();
		}
		private paint(): void {
			const below = this.placement === 'belowRibbon';
			// Stable hooks for tests and host CSS; the row is `[data-pptx-title-bar]`.
			this.toggleAttribute('data-pptx-title-bar', !below);
			if (below) {
				this.setAttribute('data-pptx-quick-access', 'below');
			} else {
				this.removeAttribute('data-pptx-quick-access');
			}
			this.view.render(this.model, this.placement);
			this.toggleAttribute('data-empty', this.view.flags.empty);
		}
	}
	registry.define('pptx-ui-title-bar', TitleBar);
}
