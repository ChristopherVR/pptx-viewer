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
	output,
	signal,
	viewChild,
} from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';

import { buildLineChart3DDataForElement } from '../internal/shared';
import type {
	ChartPartRef,
	LineChart3DHandle,
	LineChart3DSceneOptions,
	TextStyleAnimationDescriptor,
} from '../internal/shared';
// Type-only import of the shared scene controller; the implementation (which
// pulls the optional `three` peer) is loaded lazily via dynamic import so it
// never lands in the main bundle.
import type {
	CartesianChart3DInteraction,
	mountLineChart3D as MountLineChart3D,
} from '../internal/shared-src/render/line-chart-3d-scene';
import { Chart3DSceneMount } from './chart-3d-scene-mount';
import { ChartRendererComponent } from './chart-renderer.component';

type MountFn = typeof MountLineChart3D;

/**
 * LineChart3DRendererComponent: Angular interactive 3D line3D-chart view.
 *
 * When the chart resolves to a plottable per-series path layout (see
 * {@link buildLineChart3DDataForElement}) and the optional `three` peer
 * dependency is installed, this mounts the shared, framework-agnostic
 * vanilla-three controller ({@link MountLineChart3D} from
 * `pptx-viewer-shared`) into a container `<div>` for a camera-orbitable
 * tube-path scene (OrbitControls: drag to rotate, scroll to zoom). The
 * controller's scene runtime (and `three`) is imported lazily via dynamic
 * `import()` so it never lands in the main bundle.
 *
 * Falls back to the plain SVG `<pptx-chart-renderer>` when:
 *  - the chart has no plottable grid,
 *  - `three` is not installed (`mountLineChart3D` resolves to the `ok: false`
 *    sentinel),
 *  - or the scene fails to load.
 *
 * Point markers are click-to-select (`partSelect`) and drag-to-value
 * (`valueDragPreview`/`valueDragCommit`) via the shared
 * `CartesianChart3DInteraction` wiring, mirroring `BarChart3DRendererComponent`.
 * `selectedPart` re-applies the marker highlight when the selection changes
 * from outside this scene; `textStyle` applies/clears the axis-label
 * bold/italic/underline/size/colour override driven by native-animation
 * playback.
 */
@Component({
	selector: 'pptx-line-chart-3d-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, ChartRendererComponent],
	template: `
		@if (showScene()) {
			<div #scene class="pptx-ng-line-chart-3d-scene" [ngStyle]="sceneStyle()"></div>
		} @else {
			<pptx-chart-renderer [element]="element()" />
		}
	`,
	styles: `
		.pptx-ng-line-chart-3d-scene {
			width: 100%;
			height: 100%;
			display: block;
		}
	`,
})
export class LineChart3DRendererComponent implements OnDestroy {
	readonly element = input.required<PptxElement>();
	/** The part selected elsewhere (inspector, keyboard), or null. Applied to the live scene. */
	readonly selectedPart = input<ChartPartRef | null>(null);
	/** Active font-style emphasis override for the scene's own axis labels. */
	readonly textStyle = input<TextStyleAnimationDescriptor | undefined>(undefined);

	/** Emitted when a point marker (or empty space, `null`) is clicked. */
	readonly partSelect = output<ChartPartRef | null>();
	/** Emitted continuously while dragging a point's value (live preview). */
	readonly valueDragPreview = output<{ part: ChartPartRef; value: number }>();
	/** Emitted once on release with the final dragged value. */
	readonly valueDragCommit = output<{ part: ChartPartRef; value: number }>();

	private readonly sceneRef = viewChild<ElementRef<HTMLDivElement>>('scene');

	/** Pure per-series path layout for the current element, or `null` when not plottable. */
	private readonly options = computed<LineChart3DSceneOptions | null>(() =>
		buildLineChart3DDataForElement(this.element(), {
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

	/** `true` once a path is mountable and the runtime has not failed. */
	readonly showScene = computed<boolean>(() => this.options() !== null && !this.failed());

	/** Set when `three` is missing or the scene failed to load: forces the SVG fallback. */
	private readonly failed = signal(false);

	/** Mount / supersede / teardown state (see `chart-3d-scene-mount.ts`);
	 * `scene.handle()` is the live handle, `null` while unmounted/loading. */
	private readonly scene = new Chart3DSceneMount<LineChart3DSceneOptions, LineChart3DHandle>({
		onFailed: () => this.failed.set(true),
	});

	constructor() {
		afterNextRender(() => void this.loadScene());

		// Mount when the scene container exists, the runtime has loaded, and we
		// have (new) path data. Re-mounts when the underlying data changes; an
		// in-flight mount for the same data is left alone (`ensure`).
		effect(() => {
			const container = this.sceneRef()?.nativeElement;
			const fn = this.mountFn();
			const opts = this.options();
			if (!container || !fn || !opts) {
				return;
			}
			this.scene.ensure(
				opts,
				() => fn(container, opts, this.buildInteraction()),
				(handle) => {
					handle.setSelectedPart(this.selectedPart());
					handle.setTextStyle(this.textStyle());
				},
			);
		});

		// Push size changes to the live handle without re-mounting.
		effect(() => {
			const opts = this.options();
			if (opts) {
				this.scene.handle()?.resize(opts.width, opts.height);
			}
		});

		// Re-apply the selected-part highlight when the external selection (or
		// the live handle) changes.
		effect(() => {
			this.scene.handle()?.setSelectedPart(this.selectedPart());
		});

		// Apply/clear the axis-label text-style override when it (or the live
		// handle) changes.
		effect(() => {
			this.scene.handle()?.setTextStyle(this.textStyle());
		});
	}

	private async loadScene(): Promise<void> {
		if (!this.options()) {
			return; // No plottable grid: stay on the SVG fallback.
		}
		try {
			const mod = await import('../internal/shared-src/render/line-chart-3d-scene');
			this.mountFn.set(mod.mountLineChart3D);
		} catch {
			this.failed.set(true);
		}
	}

	private buildInteraction(): CartesianChart3DInteraction {
		return {
			onSelect: (part) => this.partSelect.emit(part),
			onValueDragPreview: (part, value) => this.valueDragPreview.emit({ part, value }),
			onValueDragCommit: (part, value) => this.valueDragCommit.emit({ part, value }),
		};
	}

	ngOnDestroy(): void {
		this.scene.teardown();
	}
}
