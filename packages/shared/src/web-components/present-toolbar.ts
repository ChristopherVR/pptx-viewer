import type { PresentToolbarIntent, PresentToolbarViewState } from '../render';
import { attachControlStyles } from './control-styles';
import { PRESENT_TOOLBAR_STYLES } from './present-toolbar-styles';
import { createPresentToolbarView } from './present-toolbar-view';

export type PresentToolbarRequestEvent = CustomEvent<PresentToolbarIntent>;
export interface PptxUiPresentToolbarElement extends HTMLElement {
	state: PresentToolbarViewState;
	/** Close an open colour palette, e.g. when the host auto-hides the bar. */
	closePalettes(): void;
}
declare global {
	interface HTMLElementTagNameMap {
		'pptx-ui-present-toolbar': PptxUiPresentToolbarElement;
	}
}

/**
 * The floating slide-show toolbar: previous/next with a counter, the elapsed
 * readout, the annotation tools with their colour palettes, Blackboard, Clear,
 * the optional presenter-view toggle and End. It renders from the shared
 * `PRESENT_TOOLBAR_CONTROLS` inventory and keeps each control's
 * `data-pptx-present-control` id. Hosts keep the auto-hide wrapper, the
 * annotation model and every effect; each activation emits one bubbling,
 * composed `present-toolbar-request` intent. Palettes are element state: they
 * close on a tool choice, a swatch pick, Blackboard, an outside mousedown and
 * `closePalettes()`. The host is the toolbar: it carries `data-pptx-present-toolbar`,
 * `role="toolbar"` and its accessible name.
 */
export function definePptxPresentToolbar(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-present-toolbar')) {
		return;
	}
	class PresentToolbar extends HTMLElement implements PptxUiPresentToolbarElement {
		private model: PresentToolbarViewState = {
			current: 0,
			total: 0,
			tool: 'none',
			penColor: '#ff0000',
			highlighterColor: '#ffff00',
			hasAnnotations: false,
			blackout: 'none',
			startTime: null,
		};
		private readonly view = createPresentToolbarView(this.ownerDocument, (intent) =>
			this.dispatchEvent(
				new CustomEvent('present-toolbar-request', {
					detail: intent,
					bubbles: true,
					composed: true,
				}),
			),
		);
		private tick: number | undefined;
		private readonly onOutside = (event: Event): void => {
			if (!event.composedPath().includes(this.view.bar)) {
				this.view.closePalettes();
			}
		};
		constructor() {
			super();
			const root = this.attachShadow({ mode: 'open' });
			attachControlStyles(root, PRESENT_TOOLBAR_STYLES);
			root.append(this.view.bar);
		}
		get state() {
			return this.model;
		}
		set state(value: PresentToolbarViewState) {
			this.model = value;
			this.render();
		}
		closePalettes(): void {
			this.view.closePalettes();
		}
		connectedCallback(): void {
			this.render();
			this.ownerDocument.addEventListener('mousedown', this.onOutside, true);
			const view = this.ownerDocument.defaultView;
			this.tick = view?.setInterval(() => this.view.renderElapsed(this.model.startTime), 1000);
		}
		disconnectedCallback(): void {
			this.ownerDocument.removeEventListener('mousedown', this.onOutside, true);
			this.ownerDocument.defaultView?.clearInterval(this.tick);
			this.tick = undefined;
		}
		private render(): void {
			const t = this.model.translate ?? ((key: string) => key);
			this.dataset.pptxPresentToolbar = '';
			// The host is the toolbar. Named so a screen reader announces the bar rather
			// than a run of anonymous buttons, and only programmatically focusable: a
			// running show keeps keyboard focus on the stage, where the navigation keys
			// are bound.
			this.setAttribute('role', 'toolbar');
			this.setAttribute('aria-label', t('pptx.toolbar.presentationToolbarAria'));
			this.tabIndex = -1;
			this.view.render(this.model);
		}
	}
	registry.define('pptx-ui-present-toolbar', PresentToolbar);
}
