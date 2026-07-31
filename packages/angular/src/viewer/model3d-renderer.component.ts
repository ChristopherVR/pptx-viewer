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
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement } from 'pptx-viewer-core';

// Type-only import of the shared scene controller; the implementation (which
// pulls the optional `three` peer) is loaded lazily via dynamic import so it
// never lands in the main bundle.
import type { Model3DHandle, mountModel3D as MountModel3D } from '../internal/shared';
import type { StyleMap } from './element-style';
import {
	buildModel3DContainerStyle,
	buildModel3DViewModel,
	deriveModel3DBlobUrl,
} from './model3d-renderer-helpers';
import type { Model3DViewModel } from './model3d-renderer-helpers';

type MountFn = typeof MountModel3D;

/**
 * Model3DRendererComponent: Angular Model3D renderer with interactive 3D.
 *
 * When the element carries `modelData` and the optional `three` peer dependency
 * is installed, this mounts the shared, framework-agnostic vanilla-three
 * controller ({@link MountModel3D} from `pptx-viewer-shared`) into a container
 * `<div>` for interactive GLB/GLTF rendering (orbit + zoom). The controller's
 * scene runtime (and `three`) is imported lazily via dynamic `import()` so it
 * never lands in the main bundle.
 *
 * It falls back to the poster/preview image (`posterImage`, then `imageData`)
 * when:
 *  - the element has no `modelData`,
 *  - `three` is not installed (`mountModel3D` resolves to `THREE_UNAVAILABLE`),
 *  - or the model fails to load.
 * When no poster exists either, it draws a labelled "3D Model" placeholder,
 * exactly like the React poster fallback.
 *
 * All non-trivial pure computation (poster selection, blob-url derivation)
 * lives in `model3d-renderer-helpers.ts` (no Angular dependency) so it can be
 * unit-tested without TestBed.
 */
@Component({
	selector: 'pptx-model3d-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, TranslatePipe],
	template: `
		<div
			class="pptx-ng-element pptx-ng-model3d"
			[ngStyle]="containerStyle()"
			[attr.data-element-id]="element().id"
			[attr.data-pptx-element]="markElement() ? 'true' : null"
		>
			@if (showScene()) {
				<div #scene class="pptx-ng-model3d-scene"></div>
			} @else if (vm().posterSrc) {
				<img
					[src]="vm().posterSrc"
					[alt]="'pptx.model3d.label' | translate"
					draggable="false"
					style="width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none;display:block"
				/>
			} @else {
				<div
					style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:11px;color:#9ca3af;background-color:#f9fafb;border:1px dashed #e5e7eb;border-radius:4px;box-sizing:border-box"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
						style="margin-bottom:4px;color:#d1d5db"
					>
						<path
							d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
						/>
						<polyline points="3.27 6.96 12 12.01 20.73 6.96" />
						<line x1="12" y1="22.08" x2="12" y2="12" />
					</svg>
					<span>{{ 'pptx.model3d.label' | translate }}</span>
				</div>
			}
		</div>
	`,
	styles: `
		.pptx-ng-model3d-scene {
			width: 100%;
			height: 100%;
			display: block;
		}
	`,
})
export class Model3DRendererComponent implements OnDestroy {
	readonly element = input.required<PptxElement>();
	readonly zIndex = input<number>(0);
	readonly mediaDataUrls = input<Map<string, string>>(new Map());
	/**
	 * Enable interactive orbit controls. `true` (the default) for the viewer /
	 * editor; the root viewer can pass `false` in passive presentation mode.
	 */
	readonly interactive = input<boolean>(true);
	/**
	 * Emit the neutral element marker (`data-pptx-element="true"`) on this
	 * renderer's root, the node that also carries `data-element-id`. Set only by
	 * the main interactive canvas.
	 *
	 * Separate from `interactive` above, which is about the 3D scene's orbit
	 * controls and defaults to `true` even on a thumbnail.
	 */
	readonly markElement = input<boolean>(false);

	private readonly sceneRef = viewChild<ElementRef<HTMLDivElement>>('scene');

	readonly containerStyle = computed<StyleMap>(() =>
		buildModel3DContainerStyle(this.element(), this.zIndex()),
	);

	readonly vm = computed<Model3DViewModel>(() => buildModel3DViewModel(this.element()));

	/** Blob URL for the current model data; recomputed when `modelData` changes. */
	private readonly blobUrl = computed<string | undefined>(() =>
		deriveModel3DBlobUrl(this.element()),
	);

	/** Lazily-loaded shared mount fn; `null` until the scene runtime resolves. */
	private readonly mountFn = signal<MountFn | null>(null);

	/** `true` once a model is mountable: render the scene container, not poster. */
	readonly showScene = computed<boolean>(() => this.blobUrl() !== undefined && !this.failed());

	/** Set when `three` is missing or the model failed to load: forces poster. */
	private readonly failed = signal(false);

	private handle: Model3DHandle | null = null;
	/** The blob URL the live handle was mounted with, owned for revocation. */
	private mountedUrl: string | undefined;

	constructor() {
		afterNextRender(() => void this.loadScene());

		// Mount when the scene container exists, the runtime has loaded, and we
		// have a (new) blob URL. Re-mounts when the model URL changes.
		effect(() => {
			const container = this.sceneRef()?.nativeElement;
			const fn = this.mountFn();
			const url = this.blobUrl();
			if (!container || !fn || !url) {
				return;
			}
			if (this.mountedUrl === url && this.handle) {
				return;
			}
			this.mount(fn, container, url, this.element().width, this.element().height);
		});

		// Push interactivity toggles to the live handle without re-mounting.
		effect(() => {
			this.handle?.setInteractive(this.interactive());
		});

		// Push size changes to the live handle without re-mounting.
		effect(() => {
			const el = this.element();
			this.handle?.resize(el.width, el.height);
		});

		// Revoke the previous blob URL whenever it is replaced.
		effect((onCleanup) => {
			const url = this.blobUrl();
			onCleanup(() => {
				if (url && url !== this.mountedUrl) {
					URL.revokeObjectURL(url);
				}
			});
		});
	}

	private async loadScene(): Promise<void> {
		if (!this.blobUrl()) {
			return; // No model data: stay on the poster fallback.
		}
		try {
			const mod = await import('../internal/shared-src/render/model3d-scene');
			this.mountFn.set(mod.mountModel3D);
		} catch {
			this.failed.set(true);
		}
	}

	private mount(
		fn: MountFn,
		container: HTMLElement,
		url: string,
		width: number,
		height: number,
	): void {
		this.teardownHandle();
		const interactive = this.interactive();
		const mountedUrl = url;
		this.mountedUrl = mountedUrl;
		void fn(container, url, { width, height, interactive }).then((handle) => {
			// A newer mount (or teardown) superseded this one while loading.
			if (this.mountedUrl !== mountedUrl) {
				handle.dispose();
				URL.revokeObjectURL(mountedUrl);
				return undefined;
			}
			if (!handle.ok) {
				// `three` unavailable or model failed: drop to the poster fallback.
				handle.dispose();
				this.failed.set(true);
				this.mountedUrl = undefined;
				URL.revokeObjectURL(mountedUrl);
				return undefined;
			}
			this.handle = handle;
			return undefined;
		});
	}

	/** Dispose the live handle and revoke its blob URL. */
	private teardownHandle(): void {
		this.handle?.dispose();
		this.handle = null;
		if (this.mountedUrl) {
			URL.revokeObjectURL(this.mountedUrl);
			this.mountedUrl = undefined;
		}
	}

	ngOnDestroy(): void {
		this.teardownHandle();
	}
}
