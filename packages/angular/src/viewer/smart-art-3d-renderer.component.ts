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
import type { PptxElement, SmartArtColorScheme, SmartArtStyle } from 'pptx-viewer-core';

import { buildSmartArt3DModel, computeSmartArtLayout } from '../internal/shared';
import type { SmartArt3DModel } from '../internal/shared';
// Type-only import of the scene runtime; the implementation (which pulls the
// optional `three` peer) is loaded lazily via dynamic import so it never lands
// in the main bundle.
import type { mountSmartArt3D as MountSmartArt3D } from '../internal/shared-src/smartart-3d/index';
import { getContainerStyle } from './element-style';
import type { StyleMap } from './element-style';
import { SmartArtRendererComponent } from './smart-art-renderer.component';

type MountFn = typeof MountSmartArt3D;
type SceneHandle = ReturnType<MountFn>;

const PALETTES: Record<SmartArtColorScheme, string[]> = {
	colorful1: ['#3b82f6', '#22c55e', '#f97316', '#eab308', '#a855f7', '#ec4899'],
	colorful2: ['#6366f1', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
	colorful3: ['#0ea5e9', '#84cc16', '#f43e5e', '#a855f7', '#f97316', '#10b981'],
	monochromatic1: ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#2563eb', '#1d4ed8'],
	monochromatic2: ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#4f46e5', '#4338ca'],
};

/**
 * SmartArt3DRendererComponent: Angular Three.js SmartArt renderer.
 *
 * Builds the pure 3D model from the shared layout engine (no `three` import),
 * then lazily imports the vanilla scene runtime from the vendored
 * `pptx-viewer-shared/smartart-3d` and mounts it on a canvas. `three` is an
 * optional peer dependency: when it is missing, the diagram has no geometry, or
 * the scene errors, the component falls back to the SVG SmartArt renderer.
 */
@Component({
	selector: 'pptx-smart-art-3d-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, SmartArtRendererComponent],
	template: `
		@if (useFallback()) {
			<pptx-smart-art-renderer [element]="element()" [zIndex]="zIndex()" />
		} @else {
			<div
				class="pptx-ng-element pptx-ng-smartart-3d"
				[ngStyle]="containerStyle()"
				[attr.data-element-id]="element().id"
			>
				<canvas #canvas class="pptx-ng-smartart-3d-canvas"></canvas>
			</div>
		}
	`,
	styles: `
		.pptx-ng-smartart-3d-canvas {
			width: 100%;
			height: 100%;
			display: block;
		}
	`,
})
export class SmartArt3DRendererComponent implements OnDestroy {
	readonly element = input.required<PptxElement>();
	readonly zIndex = input<number>(0);

	private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

	/** `true` until the 3D scene is known to be mountable; renders the SVG fallback. */
	readonly useFallback = signal(true);

	private readonly mountFn = signal<MountFn | null>(null);
	private handle: SceneHandle | null = null;

	readonly containerStyle = computed<StyleMap>(() =>
		getContainerStyle(this.element(), this.zIndex()),
	);

	private readonly smartArtData = computed(() => {
		const el = this.element();
		return el.type === 'smartArt' ? el.smartArtData : undefined;
	});

	private readonly model = computed<SmartArt3DModel | null>(() => {
		const data = this.smartArtData();
		if (!data || data.nodes.length === 0) {
			return null;
		}
		const el = this.element();
		const ctFills = data.colorTransform?.fillColors;
		const palette =
			ctFills && ctFills.length > 0
				? ctFills
				: (PALETTES[data.colorScheme ?? 'colorful1'] ?? PALETTES.colorful1);
		const style: SmartArtStyle = data.style ?? 'flat';
		const layout = computeSmartArtLayout(
			data.nodes,
			{ width: Math.max(el.width, 1), height: Math.max(el.height, 1) },
			palette,
			style,
			el.id,
			data.resolvedLayoutType,
			data.layout,
		);
		return buildSmartArt3DModel(layout, { background: data.chrome?.backgroundColor });
	});

	constructor() {
		afterNextRender(() => void this.loadScene());

		// Mount once the canvas exists and the scene runtime has loaded.
		effect(() => {
			const canvasEl = this.canvas()?.nativeElement;
			const fn = this.mountFn();
			const m = this.model();
			if (!canvasEl || !fn || !m || this.handle) {
				return;
			}
			try {
				const el = this.element();
				this.handle = fn(canvasEl, m, el.width, el.height, {});
			} catch {
				this.useFallback.set(true);
			}
		});

		// Resize without re-mounting.
		effect(() => {
			const el = this.element();
			this.handle?.resize(el.width, el.height);
		});
	}

	private async loadScene(): Promise<void> {
		const m = this.model();
		if (!m || m.meshes.length === 0) {
			return; // No geometry: stay on the SVG fallback.
		}
		try {
			const mod = await import('../internal/shared-src/smartart-3d/index');
			this.mountFn.set(mod.mountSmartArt3D);
			this.useFallback.set(false);
		} catch {
			this.useFallback.set(true);
		}
	}

	ngOnDestroy(): void {
		this.handle?.dispose();
		this.handle = null;
	}
}
