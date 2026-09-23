/**
 * `<pptx-three-view>`: the one custom element every binding uses to show a
 * three.js chart or SmartArt scene.
 *
 * Bindings set the `spec` property and slot their 2D SVG rendering inside
 * the element as its fallback. The fallback shows while the scene loads,
 * and again if `three` is not installed, WebGL is unavailable, or the scene
 * throws; the canvas shows once the scene is ready. That replaces the five
 * per-binding copies of "lazy import three, error boundary, SVG fallback,
 * resize, dispose" per chart kind.
 *
 * Properties: `spec` ({@link ThreeViewSpec} | null), `interactive` (also the
 * `interactive` attribute), `selectedPart`, `textStyle`.
 *
 * Events (bubbling, composed):
 *  - `pptx-three-state`  detail `{ state }` on every lifecycle change;
 *  - `pptx-three-select` detail `{ part }` when a chart mark is clicked;
 *  - `pptx-three-drag`   detail `{ part, value, phase }` while a mark is dragged.
 *
 * The current state is also reflected on the `data-state` attribute.
 *
 * @module three-view/element
 */
import type { TextStyleAnimationDescriptor } from '../render/animation-text-style-resolve';
import type { ChartPartRef } from '../render/chart-view-model';
import type { ThreeViewSceneEvent, ThreeViewSpec, ThreeViewState } from './types';
import { ThreeViewController } from './view-controller';
import { measureThreeViewSize } from './view-size';

/** The element's tag name. */
export const THREE_VIEW_TAG = 'pptx-three-view';

/** How often an on-screen view re-checks its on-screen size (catches slide zoom, which fires no resize). */
const ZOOM_POLL_MS = 400;

const SHADOW_CSS = `
:host { display: block; position: relative; width: 100%; height: 100%; contain: layout paint; }
.fallback { position: absolute; inset: 0; }
.stage { position: absolute; inset: 0; visibility: hidden; }
canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.overlay { position: absolute; inset: 0; pointer-events: none; }
:host([data-state='ready']) .fallback { display: none; }
:host([data-state='ready']) .stage { visibility: visible; }
`;

/** Public shape of the element (for binding type declarations). */
export interface PptxThreeViewElement extends HTMLElement {
	spec: ThreeViewSpec | null;
	interactive: boolean;
	selectedPart: ChartPartRef | null;
	textStyle: TextStyleAnimationDescriptor | undefined;
	readonly state: ThreeViewState;
	/** The 2D canvas the scene is drawn onto (for export/snapshot). */
	readonly canvas: HTMLCanvasElement | null;
	/** Draw any pending frame now. */
	flush: () => void;
}

function createElementClass(): CustomElementConstructor {
	class PptxThreeView extends HTMLElement implements PptxThreeViewElement {
		static observedAttributes = ['interactive'];

		#spec: ThreeViewSpec | null = null;
		#state: ThreeViewState = 'idle';
		#selectedPart: ChartPartRef | null = null;
		#textStyle: TextStyleAnimationDescriptor | undefined;
		#controller: ThreeViewController | null = null;
		#canvas: HTMLCanvasElement | null = null;
		#visible = true;
		#resize: ResizeObserver | null = null;
		#intersect: IntersectionObserver | null = null;
		#poll: ReturnType<typeof setInterval> | null = null;

		get spec(): ThreeViewSpec | null {
			return this.#spec;
		}
		set spec(value: ThreeViewSpec | null) {
			if (value === this.#spec) {
				return;
			}
			this.#spec = value;
			if (this.isConnected) {
				void this.#controller?.setSpec(value);
			}
		}

		get interactive(): boolean {
			return this.hasAttribute('interactive');
		}
		set interactive(on: boolean) {
			this.toggleAttribute('interactive', Boolean(on));
		}

		get selectedPart(): ChartPartRef | null {
			return this.#selectedPart;
		}
		set selectedPart(part: ChartPartRef | null) {
			this.#selectedPart = part ?? null;
			this.#controller?.setSelectedPart(this.#selectedPart);
		}

		get textStyle(): TextStyleAnimationDescriptor | undefined {
			return this.#textStyle;
		}
		set textStyle(style: TextStyleAnimationDescriptor | undefined) {
			this.#textStyle = style;
			this.#controller?.setTextStyle(style);
		}

		get state(): ThreeViewState {
			return this.#state;
		}

		get canvas(): HTMLCanvasElement | null {
			return this.#canvas;
		}

		flush(): void {
			this.#controller?.flush();
		}

		attributeChangedCallback(name: string): void {
			if (name === 'interactive') {
				this.#controller?.setInteractive(this.interactive);
			}
		}

		connectedCallback(): void {
			const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
			if (!this.#canvas) {
				root.innerHTML = `<style>${SHADOW_CSS}</style><div class="fallback" part="fallback"><slot></slot></div><div class="stage" part="stage"><canvas></canvas><div class="overlay" part="overlay"></div></div>`;
				this.#canvas = root.querySelector('canvas');
			}
			const canvas = this.#canvas as HTMLCanvasElement;
			const overlay = root.querySelector('.overlay') as HTMLElement;
			this.#controller = new ThreeViewController({
				canvas,
				overlay,
				eventTarget: canvas,
				measure: () => measureThreeViewSize(this),
				isVisible: () => this.isConnected && this.#visible,
				onState: (state) => this.#setState(state),
				onSceneEvent: (event) => this.#dispatchSceneEvent(event),
			});
			this.#controller.setInteractive(this.interactive);
			this.#controller.setSelectedPart(this.#selectedPart);
			this.#controller.setTextStyle(this.#textStyle);
			this.#observe();
			void this.#controller.setSpec(this.#spec);
		}

		disconnectedCallback(): void {
			this.#resize?.disconnect();
			this.#intersect?.disconnect();
			if (this.#poll !== null) {
				clearInterval(this.#poll);
			}
			this.#resize = null;
			this.#intersect = null;
			this.#poll = null;
			this.#controller?.dispose();
			this.#controller = null;
		}

		#observe(): void {
			const win = this.ownerDocument.defaultView;
			if (win && 'ResizeObserver' in win) {
				this.#resize = new win.ResizeObserver(() => this.#controller?.remeasure());
				this.#resize.observe(this);
			}
			if (win && 'IntersectionObserver' in win) {
				this.#intersect = new win.IntersectionObserver((entries) => {
					const entry = entries[entries.length - 1];
					this.#visible = entry ? entry.isIntersecting : true;
					if (this.#visible) {
						this.#controller?.remeasure(true);
					}
				});
				this.#intersect.observe(this);
			}
			this.#poll = setInterval(() => {
				if (this.#visible && this.#state === 'ready') {
					this.#controller?.remeasure();
				}
			}, ZOOM_POLL_MS);
		}

		#setState(state: ThreeViewState): void {
			this.#state = state;
			this.setAttribute('data-state', state);
			this.dispatchEvent(
				new CustomEvent('pptx-three-state', { detail: { state }, bubbles: true, composed: true }),
			);
		}

		#dispatchSceneEvent(event: ThreeViewSceneEvent): void {
			if (event.type === 'select') {
				this.dispatchEvent(
					new CustomEvent('pptx-three-select', {
						detail: { part: event.part },
						bubbles: true,
						composed: true,
					}),
				);
				return;
			}
			this.dispatchEvent(
				new CustomEvent('pptx-three-drag', { detail: event.detail, bubbles: true, composed: true }),
			);
		}
	}
	return PptxThreeView;
}

/**
 * Register `<pptx-three-view>` (idempotent; a no-op outside the browser).
 * Every binding calls this once before rendering the element.
 */
export function defineThreeViewElement(registry?: CustomElementRegistry): void {
	const target = registry ?? (typeof customElements === 'undefined' ? undefined : customElements);
	if (!target || target.get(THREE_VIEW_TAG)) {
		return;
	}
	target.define(THREE_VIEW_TAG, createElementClass());
}
