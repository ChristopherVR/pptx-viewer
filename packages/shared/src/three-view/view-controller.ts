/**
 * Mount lifecycle for one hosted 3D view: load `three` and the scene module,
 * mount the scene against a canvas + overlay, register it with the shared
 * renderer host, and tear it down. The `<pptx-three-view>` element is a thin
 * shell around this; keeping the logic here keeps it testable without
 * custom-element registration.
 *
 * Swapping specs never flashes: the previous scene keeps drawing until the
 * replacement has mounted, then the two are exchanged in one step.
 *
 * @module three-view/view-controller
 */
import type { TextStyleAnimationDescriptor } from '../render/animation-text-style-resolve';
import { loadChart3DOrbitControls, loadChart3DThree } from '../render/chart-3d-three-loader';
import type { ChartPartRef } from '../render/chart-view-model';
import { getThreeRendererHost } from './renderer-host';
import type { HostedView, ThreeRendererHost } from './renderer-host';
import { loadThreeViewScene } from './scene-registry';
import type {
	ThreeViewScene,
	ThreeViewSceneEvent,
	ThreeViewSize,
	ThreeViewSpec,
	ThreeViewState,
} from './types';

/** What the controller needs from its host element. */
export interface ThreeViewControllerOptions {
	canvas: HTMLCanvasElement;
	overlay: HTMLElement;
	eventTarget: HTMLElement;
	measure: () => ThreeViewSize;
	isVisible: () => boolean;
	onState: (state: ThreeViewState) => void;
	onSceneEvent: (event: ThreeViewSceneEvent) => void;
}

interface Mounted {
	scene: ThreeViewScene;
	view: HostedView;
	overlay: HTMLElement;
}

/** Drives one view. */
export class ThreeViewController {
	private readonly opts: ThreeViewControllerOptions;
	private host: ThreeRendererHost | null = null;
	private mounted: Mounted | null = null;
	private token = 0;
	private size: ThreeViewSize;
	private interactive = false;
	private selectedPart: ChartPartRef | null = null;
	private textStyle: TextStyleAnimationDescriptor | undefined;

	constructor(opts: ThreeViewControllerOptions) {
		this.opts = opts;
		this.size = opts.measure();
	}

	/** Mount `spec` (or clear the view for `null`). */
	async setSpec(spec: ThreeViewSpec | null): Promise<void> {
		const token = ++this.token;
		if (!spec) {
			this.unmount();
			this.opts.onState('idle');
			return;
		}
		if (!this.mounted) {
			this.opts.onState('loading');
		}
		try {
			const three = await loadChart3DThree();
			if (token !== this.token) {
				return;
			}
			const host = three ? getThreeRendererHost(three) : null;
			if (!three || !host || !host.available) {
				this.unmount();
				this.opts.onState('unavailable');
				return;
			}
			this.host = host;
			const [OrbitControls, factory] = await Promise.all([
				loadChart3DOrbitControls(),
				loadThreeViewScene(spec.kind),
			]);
			if (token !== this.token) {
				return;
			}
			// Each scene gets its own overlay layer, so a replacement scene's
			// chrome never mixes with the outgoing scene's while it mounts.
			const doc = this.opts.overlay.ownerDocument;
			const overlay = doc.createElement('div');
			overlay.style.cssText = 'position:absolute;inset:0;';
			let view: HostedView | null = null;
			const scene = await (factory as (s: unknown, c: unknown) => Promise<ThreeViewScene>)(
				spec.spec,
				{
					three,
					OrbitControls,
					size: this.size,
					eventTarget: this.opts.eventTarget,
					overlay,
					document: doc,
					interactive: this.interactive,
					requestRender: () => {
						if (view) {
							host.requestRender(view);
						}
					},
					emit: (event: ThreeViewSceneEvent) => {
						if (token === this.token) {
							this.opts.onSceneEvent(event);
						}
					},
				},
			);
			if (token !== this.token) {
				scene.dispose();
				return;
			}
			view = {
				canvas: this.opts.canvas,
				pixelSize: () => ({ width: this.size.pixelWidth, height: this.size.pixelHeight }),
				isVisible: this.opts.isVisible,
				draw: (renderer) => scene.render(renderer),
				isAnimating: () => scene.isAnimating?.() ?? false,
			};
			this.unmount();
			this.opts.overlay.appendChild(overlay);
			this.mounted = { scene, view, overlay };
			scene.setSelectedPart?.(this.selectedPart);
			if (this.textStyle) {
				scene.setTextStyle?.(this.textStyle);
			}
			host.register(view);
			this.opts.onState('ready');
		} catch (error) {
			if (token !== this.token) {
				return;
			}
			console.warn('[pptx-three-view] scene failed to mount; showing the 2D fallback', error);
			this.unmount();
			this.opts.onState('error');
		}
	}

	/** Re-measure; resizes the scene and redraws when anything changed. */
	remeasure(force = false): void {
		const next = this.opts.measure();
		const changed =
			force ||
			next.width !== this.size.width ||
			next.height !== this.size.height ||
			next.pixelWidth !== this.size.pixelWidth ||
			next.pixelHeight !== this.size.pixelHeight;
		if (!changed) {
			return;
		}
		this.size = next;
		this.mounted?.scene.resize(next);
		this.requestRender();
	}

	requestRender(): void {
		if (this.mounted && this.host) {
			this.host.requestRender(this.mounted.view);
		}
	}

	setInteractive(on: boolean): void {
		this.interactive = on;
		this.mounted?.scene.setInteractive?.(on);
		this.requestRender();
	}

	setSelectedPart(part: ChartPartRef | null): void {
		this.selectedPart = part;
		this.mounted?.scene.setSelectedPart?.(part);
		this.requestRender();
	}

	setTextStyle(style: TextStyleAnimationDescriptor | undefined): void {
		this.textStyle = style;
		this.mounted?.scene.setTextStyle?.(style);
		this.requestRender();
	}

	/** Draw any pending frame synchronously (export / snapshot). */
	flush(): void {
		this.host?.flushNow();
	}

	dispose(): void {
		this.token++;
		this.unmount();
	}

	private unmount(): void {
		const current = this.mounted;
		if (!current) {
			return;
		}
		this.mounted = null;
		this.host?.unregister(current.view);
		current.overlay.remove();
		try {
			current.scene.dispose();
		} catch (error) {
			console.warn('[pptx-three-view] scene dispose failed', error);
		}
	}
}
