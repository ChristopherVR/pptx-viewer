import { NgStyle } from '@angular/common';
import {
	afterNextRender,
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	ElementRef,
	inject,
	Injector,
	input,
	OnDestroy,
	signal,
	viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement, SmartArtColorScheme, SmartArtStyle } from 'pptx-viewer-core';

import { buildSmartArt3DModel, computeSmartArtLayout } from '../internal/shared';
import type { SmartArt3DModel } from '../internal/shared';
// Type-only import of the scene runtime; the implementation (which pulls the
// optional `three` peer) is loaded lazily via dynamic import so it never lands
// in the main bundle.
import type { mountSmartArt3D as MountSmartArt3D } from '../internal/shared-src/smartart-3d/index';
import { EditorStateService } from './editor-state.service';
import { getContainerStyle } from './element-style';
import type { StyleMap } from './element-style';
import { SLIDE_CONTEXT } from './slide-context';
import { commitNodeText, findOwningSlideIndex } from './smart-art-inline-edit';
import type { InlineEditState } from './smart-art-inline-edit';
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
 *
 * When `canEdit` is true and the 3D scene is active, an invisible
 * `<pptx-smart-art-renderer>` overlay is stacked over the canvas. Double-clicking
 * on the overlay uses `document.elementsFromPoint` to locate the `<g>` bearing
 * `data-smartart-node-id`, then opens an inline textarea editor over that node
 * (same commit path as the SVG renderer: `EditorStateService.updateElement`).
 */
@Component({
	selector: 'pptx-smart-art-3d-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, SmartArtRendererComponent, TranslatePipe],
	template: `
		@if (useFallback()) {
			<pptx-smart-art-renderer [element]="element()" [zIndex]="zIndex()" />
		} @else {
			<div
				#container3d
				class="pptx-ng-element pptx-ng-smartart-3d"
				[ngStyle]="containerStyle()"
				[attr.data-element-id]="element().id"
			>
				<canvas #canvas class="pptx-ng-smartart-3d-canvas"></canvas>
				@if (canEdit()) {
					<!-- Invisible SVG overlay: provides data-smartart-node-id hit targets -->
					<div class="pptx-ng-smartart-3d-hittest" (dblclick)="onOverlayDblClick($event)">
						<pptx-smart-art-renderer [element]="element()" [editable]="false" [zIndex]="0" />
					</div>
					@if (editState()) {
						<textarea
							#nodeEditor3d
							class="pptx-ng-smartart-3d-node-editor"
							[style.left.px]="editState()!.box.x"
							[style.top.px]="editState()!.box.y"
							[style.width.px]="editState()!.box.width"
							[style.height.px]="editState()!.box.height"
							[value]="editState()!.text"
							spellcheck="false"
							[attr.aria-label]="'pptx.smartArt.editNodeText' | translate"
							(input)="updateDraft($event)"
							(blur)="commitEdit()"
							(keydown)="onEditorKeydown($event)"
							(mousedown)="$event.stopPropagation()"
							(click)="$event.stopPropagation()"
							(dblclick)="$event.stopPropagation()"
						></textarea>
					}
				}
			</div>
		}
	`,
	styles: `
		.pptx-ng-smartart-3d-canvas {
			width: 100%;
			height: 100%;
			display: block;
		}

		/* Invisible hit-test overlay: fills the canvas area, captures dblclicks */
		.pptx-ng-smartart-3d-hittest {
			position: absolute;
			inset: 0;
			opacity: 0;
			pointer-events: auto;
		}

		/* Inline node text editor, positioned over the clicked node */
		.pptx-ng-smartart-3d-node-editor {
			position: absolute;
			box-sizing: border-box;
			margin: 0;
			padding: 1px 2px;
			border: 1px solid var(--pptx-inspector-active, #0078d4);
			border-radius: 2px;
			background: #fff;
			color: #111;
			font-size: 11px;
			line-height: 1.1;
			text-align: center;
			resize: none;
			overflow: hidden;
			z-index: 20;
			outline: none;
		}
	`,
})
export class SmartArt3DRendererComponent implements OnDestroy {
	readonly element = input.required<PptxElement>();
	readonly zIndex = input<number>(0);
	/** When true and the 3D scene is active, enables inline node text editing. */
	readonly canEdit = input<boolean>(false);

	private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
	private readonly containerEl = viewChild<ElementRef<HTMLElement>>('container3d');
	private readonly nodeEditor3d = viewChild<ElementRef<HTMLTextAreaElement>>('nodeEditor3d');

	/** `true` until the 3D scene is known to be mountable; renders the SVG fallback. */
	readonly useFallback = signal(true);

	private readonly mountFn = signal<MountFn | null>(null);
	private handle: SceneHandle | null = null;

	protected readonly editState = signal<InlineEditState | null>(null);
	/** Live draft text, updated on every input event. */
	protected draftText = '';
	/** Guards against a cancel-triggered DOM-removal blur committing the edit. */
	private editSettled = false;

	private readonly editor = inject(EditorStateService, { optional: true });
	/** The hosting canvas's slide, for resolving template (master/layout) SmartArt. */
	private readonly slideContext = inject(SLIDE_CONTEXT, { optional: true });
	private readonly injector = inject(Injector);

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
		return buildSmartArt3DModel(layout, {
			background: data.chrome?.backgroundColor,
			spatial: true,
		});
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

		// Auto-focus the textarea when the editor opens.
		effect(() => {
			if (this.editState()) {
				afterNextRender(
					() => {
						const el = this.nodeEditor3d()?.nativeElement;
						if (el) {
							el.focus();
							el.select();
						}
					},
					{ injector: this.injector },
				);
			}
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

	/**
	 * Locate the SmartArt node at the click position using `elementsFromPoint`
	 * (which includes pointer-events:none SVG elements) and open the inline editor.
	 */
	onOverlayDblClick(event: MouseEvent): void {
		const container = this.containerEl()?.nativeElement;
		if (!container) {
			return;
		}

		const data = this.smartArtData();
		if (!data) {
			return;
		}

		// document.elementsFromPoint includes elements with pointer-events:none,
		// so we can find the <g data-smartart-node-id="..."> in the overlay SVG.
		const elements = document.elementsFromPoint(event.clientX, event.clientY);
		const nodeEl = elements.find(
			(el): el is Element => el instanceof Element && el.hasAttribute('data-smartart-node-id'),
		);
		if (!nodeEl) {
			return;
		}

		const nodeId = nodeEl.getAttribute('data-smartart-node-id');
		if (!nodeId) {
			return;
		}

		const currentText = data.nodes.find((n) => n.id === nodeId)?.text ?? '';
		const nodeRect = nodeEl.getBoundingClientRect();
		const containerRect = container.getBoundingClientRect();

		this.draftText = currentText;
		this.editSettled = false;
		this.editState.set({
			nodeId,
			box: {
				x: nodeRect.left - containerRect.left,
				y: nodeRect.top - containerRect.top,
				width: nodeRect.width,
				height: nodeRect.height,
			},
			text: currentText,
		});
	}

	/** Update the live draft text on each keystroke. */
	updateDraft(event: Event): void {
		this.draftText = (event.target as HTMLTextAreaElement).value;
	}

	/** Enter commits (via blur); Escape cancels. Propagation always stopped. */
	onEditorKeydown(event: KeyboardEvent): void {
		event.stopPropagation();
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			// Commit via blur so the single commit path runs once.
			(event.target as HTMLTextAreaElement).blur();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			this.cancelEdit();
		}
	}

	/** Commit the current draft through EditorStateService (blur handler). */
	commitEdit(): void {
		if (this.editSettled) {
			this.editSettled = false;
			return;
		}
		const edit = this.editState();
		if (!edit) {
			return;
		}
		const text = this.draftText;
		this.editState.set(null);
		this.applyCommit(edit.nodeId, text);
	}

	/** Discard the current edit without committing. */
	cancelEdit(): void {
		// Mark as settled so the DOM-removal blur does not commit the cancelled edit.
		this.editSettled = true;
		this.editState.set(null);
	}

	private applyCommit(nodeId: string, text: string): void {
		const data = this.smartArtData();
		if (!data || !this.editor) {
			return;
		}
		const next = commitNodeText(data, nodeId, text);
		if (next === data) {
			return;
		} // no-op: text unchanged
		const slideIndex = findOwningSlideIndex(
			this.editor.slides(),
			this.element().id,
			this.slideContext?.slideId() ?? null,
		);
		if (slideIndex < 0) {
			return;
		}
		this.editor.updateElement(slideIndex, this.element().id, {
			smartArtData: next,
		} as Partial<PptxElement>);
	}

	ngOnDestroy(): void {
		this.handle?.dispose();
		this.handle = null;
	}
}
