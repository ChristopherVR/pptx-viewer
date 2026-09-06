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

import { buildPieChart3DDataForElement } from '../internal/shared';
import type { ChartPartRef, PieChart3DHandle, PieChart3DSceneOptions } from '../internal/shared';
// Type-only import of the shared scene controller; the implementation (which
// pulls the optional `three` peer) is loaded lazily via dynamic import so it
// never lands in the main bundle.
import type {
	mountPieChart3D as MountPieChart3D,
	PieChart3DInteraction,
} from '../internal/shared-src/render/pie-chart-3d-scene';
import { Chart3DSceneMount } from './chart-3d-scene-mount';
import { ChartRendererComponent } from './chart-renderer.component';

type MountFn = typeof MountPieChart3D;

/**
 * PieChart3DRendererComponent: Angular interactive 3D pie3D-chart view.
 *
 * When the chart resolves to a plottable wedge-mesh layout (see
 * {@link buildPieChart3DDataForElement}) and the optional `three` peer
 * dependency is installed, this mounts the shared, framework-agnostic
 * vanilla-three controller ({@link MountPieChart3D} from
 * `pptx-viewer-shared`) into a container `<div>` for a camera-orbitable
 * wedge scene (OrbitControls: drag to rotate, scroll to zoom). The
 * controller's scene runtime (and `three`) is imported lazily via dynamic
 * `import()` so it never lands in the main bundle.
 *
 * Falls back to the plain SVG `<pptx-chart-renderer>` when:
 *  - the chart has no plottable series,
 *  - `three` is not installed (`mountPieChart3D` resolves to the `ok: false`
 *    sentinel),
 *  - or the scene fails to load.
 *
 * Wedges are click-to-select (`partSelect`, mirroring the 2D chart's
 * `ChartPartSelectionService` wiring one level up in
 * `ChartElementViewComponent`) and drag-to-value (`valueDragPreview`/
 * `valueDragCommit`) via the shared `PieChart3DInteraction` wiring: dragging
 * sweeps a wedge's trailing edge around the pie's centre, renormalising every
 * other slice's angle live, exactly like the flat SVG pie/doughnut's own
 * on-canvas editing. The scene draws no axis labels, so unlike
 * bar3D/line3D/area3D/surface3D there is no `textStyle` input. `selectedPart`
 * re-applies the wedge-emissive highlight when the selection changes from
 * outside this scene (inspector, keyboard).
 */
@Component({
	selector: 'pptx-pie-chart-3d-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, ChartRendererComponent],
	template: `
		@if (showScene()) {
			<div #scene class="pptx-ng-pie-chart-3d-scene" [ngStyle]="sceneStyle()"></div>
		} @else {
			<pptx-chart-renderer [element]="element()" />
		}
	`,
	styles: `
		.pptx-ng-pie-chart-3d-scene {
			width: 100%;
			height: 100%;
			display: block;
		}
	`,
})
export class PieChart3DRendererComponent implements OnDestroy {
	readonly element = input.required<PptxElement>();
	/** The part selected elsewhere (inspector, keyboard), or null. Applied to the live scene. */
	readonly selectedPart = input<ChartPartRef | null>(null);

	/** Emitted when a wedge (or empty space, `null`) is clicked. */
	readonly partSelect = output<ChartPartRef | null>();
	/** Emitted continuously while dragging a wedge's value around the pie (live preview). */
	readonly valueDragPreview = output<{ part: ChartPartRef; value: number }>();
	/** Emitted once on release with the final dragged value. */
	readonly valueDragCommit = output<{ part: ChartPartRef; value: number }>();

	private readonly sceneRef = viewChild<ElementRef<HTMLDivElement>>('scene');

	/** Pure wedge-mesh layout for the current element, or `null` when not plottable. */
	private readonly options = computed<PieChart3DSceneOptions | null>(() =>
		buildPieChart3DDataForElement(this.element(), {
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

	/** `true` once a series is mountable and the runtime has not failed. */
	readonly showScene = computed<boolean>(() => this.options() !== null && !this.failed());

	/** Set when `three` is missing or the scene failed to load: forces the SVG fallback. */
	private readonly failed = signal(false);

	/** Mount / supersede / teardown state (see `chart-3d-scene-mount.ts`);
	 * `scene.handle()` is the live handle, `null` while unmounted/loading. */
	private readonly scene = new Chart3DSceneMount<PieChart3DSceneOptions, PieChart3DHandle>({
		onFailed: () => this.failed.set(true),
	});

	constructor() {
		afterNextRender(() => void this.loadScene());

		// Mount when the scene container exists, the runtime has loaded, and we
		// have (new) wedge-mesh data. Re-mounts when the underlying data changes; an
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
	}

	private async loadScene(): Promise<void> {
		if (!this.options()) {
			return; // No plottable series: stay on the SVG fallback.
		}
		try {
			const mod = await import('../internal/shared-src/render/pie-chart-3d-scene');
			this.mountFn.set(mod.mountPieChart3D);
		} catch {
			this.failed.set(true);
		}
	}

	private buildInteraction(): PieChart3DInteraction {
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
