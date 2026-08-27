import { NgStyle } from '@angular/common';
import {
	afterNextRender,
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	ElementRef,
	input,
	OnDestroy,
	signal,
	viewChild,
} from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';

import { buildBarChart3DDataForElement } from '../internal/shared';
import type { BarChart3DHandle, BarChart3DSceneOptions } from '../internal/shared';
// Type-only import of the shared scene controller; the implementation (which
// pulls the optional `three` peer) is loaded lazily via dynamic import so it
// never lands in the main bundle.
import type { mountBarChart3D as MountBarChart3D } from '../internal/shared-src/render/bar-chart-3d-scene';
import { ChartRendererComponent } from './chart-renderer.component';

type MountFn = typeof MountBarChart3D;

/**
 * BarChart3DRendererComponent: Angular interactive 3D bar3D-chart view.
 *
 * When the chart resolves to a plottable box-mesh layout (see
 * {@link buildBarChart3DDataForElement}) and the optional `three` peer
 * dependency is installed, this mounts the shared, framework-agnostic
 * vanilla-three controller ({@link MountBarChart3D} from
 * `pptx-viewer-shared`) into a container `<div>` for a camera-orbitable box
 * scene (OrbitControls: drag to rotate, scroll to zoom). The controller's
 * scene runtime (and `three`) is imported lazily via dynamic `import()` so it
 * never lands in the main bundle.
 *
 * Falls back to the plain SVG `<pptx-chart-renderer>` when:
 *  - the chart has no plottable grid (or is a horizontal 3-D Bar, not yet
 *    supported by the mesh path),
 *  - `three` is not installed (`mountBarChart3D` resolves to the `ok: false`
 *    sentinel),
 *  - or the scene fails to load.
 *
 * Marks are not selectable/draggable in this mode: a mesh box has no 2D
 * screen geometry to hit-test against, so value-drag editing stays SVG-only
 * (`ChartElementViewComponent` only mounts this component when NOT editing
 * marks would matter, i.e. it swaps in for the plain renderer, not the
 * interactive one). Mirrors `SurfaceChart3DRendererComponent` exactly.
 */
@Component({
	selector: 'pptx-bar-chart-3d-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, ChartRendererComponent],
	template: `
		@if (showScene()) {
			<div #scene class="pptx-ng-bar-chart-3d-scene" [ngStyle]="sceneStyle()"></div>
		} @else {
			<pptx-chart-renderer [element]="element()" />
		}
	`,
	styles: `
		.pptx-ng-bar-chart-3d-scene {
			width: 100%;
			height: 100%;
			display: block;
		}
	`,
})
export class BarChart3DRendererComponent implements OnDestroy {
	readonly element = input.required<PptxElement>();

	private readonly sceneRef = viewChild<ElementRef<HTMLDivElement>>('scene');

	/** Pure box-mesh layout for the current element, or `null` when not plottable. */
	private readonly options = computed<BarChart3DSceneOptions | null>(() =>
		buildBarChart3DDataForElement(this.element(), {
			width: this.element().width,
			height: this.element().height,
		}),
	);

	protected readonly sceneStyle = computed(() => ({
		width: `${this.element().width}px`,
		height: `${this.element().height}px`,
	}));

	/** Lazily-loaded shared mount fn; `null` until the scene runtime resolves. */
	private readonly mountFn = signal<MountFn | null>(null);

	/** `true` once a grid is mountable and the runtime has not failed. */
	readonly showScene = computed<boolean>(() => this.options() !== null && !this.failed());

	/** Set when `three` is missing or the scene failed to load: forces the SVG fallback. */
	private readonly failed = signal(false);

	private handle: BarChart3DHandle | null = null;
	/** The options identity the live handle was mounted with. */
	private mountedOptions: BarChart3DSceneOptions | null = null;

	constructor() {
		afterNextRender(() => void this.loadScene());

		// Mount when the scene container exists, the runtime has loaded, and we
		// have (new) box-mesh data. Re-mounts when the underlying data changes.
		effect(() => {
			const container = this.sceneRef()?.nativeElement;
			const fn = this.mountFn();
			const opts = this.options();
			if (!container || !fn || !opts) {
				return;
			}
			if (this.mountedOptions === opts && this.handle) {
				return;
			}
			this.mount(fn, container, opts);
		});

		// Push size changes to the live handle without re-mounting.
		effect(() => {
			const opts = this.options();
			if (opts) {
				this.handle?.resize(opts.width, opts.height);
			}
		});
	}

	private async loadScene(): Promise<void> {
		if (!this.options()) {
			return; // No plottable grid: stay on the SVG fallback.
		}
		try {
			const mod = await import('../internal/shared-src/render/bar-chart-3d-scene');
			this.mountFn.set(mod.mountBarChart3D);
		} catch {
			this.failed.set(true);
		}
	}

	private mount(fn: MountFn, container: HTMLElement, options: BarChart3DSceneOptions): void {
		this.teardownHandle();
		this.mountedOptions = options;
		void fn(container, options).then((handle) => {
			// Newer data (or a teardown) superseded this mount while loading.
			if (this.mountedOptions !== options) {
				handle.dispose();
				return undefined;
			}
			if (!handle.ok) {
				handle.dispose();
				this.failed.set(true);
				this.mountedOptions = null;
				return undefined;
			}
			this.handle = handle;
			return undefined;
		});
	}

	private teardownHandle(): void {
		this.handle?.dispose();
		this.handle = null;
	}

	ngOnDestroy(): void {
		this.teardownHandle();
	}
}
