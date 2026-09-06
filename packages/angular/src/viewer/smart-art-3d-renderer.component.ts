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
import type { PptxElement } from 'pptx-viewer-core';

import type { SmartArt3DModel, TextStyleAnimationDescriptor } from '../internal/shared';
// Type-only import of the scene runtime; the implementation (which pulls the
// optional `three` peer) is loaded lazily via dynamic import so it never lands
// in the main bundle.
import type { mountSmartArt3D as MountSmartArt3D } from '../internal/shared-src/smartart-3d/index';
import { EditorStateService } from './editor-state.service';
import { getContainerStyle } from './element-style';
import type { StyleMap } from './element-style';
import { SLIDE_CONTEXT } from './slide-context';
import {
	buildSmartArt3DModelForElement,
	computeNode3DEditBox,
	findSmartArtNodeElementAtPoint,
	getSmartArtData,
} from './smart-art-3d-renderer-helpers';
import { commitNodeText, findOwningSlideIndex } from './smart-art-inline-edit';
import type { InlineEditState } from './smart-art-inline-edit';
import { SmartArtRendererComponent } from './smart-art-renderer.component';

type MountFn = typeof MountSmartArt3D;
type SceneHandle = ReturnType<MountFn>;

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
	templateUrl: './smart-art-3d-renderer.component.html',
	styleUrl: './smart-art-3d-renderer.component.css',
})
export class SmartArt3DRendererComponent implements OnDestroy {
	readonly element = input.required<PptxElement>();
	readonly zIndex = input<number>(0);
	/** When true and the 3D scene is active, enables inline node text editing. */
	readonly canEdit = input<boolean>(false);
	/**
	 * Emit the neutral element marker (`data-pptx-element="true"`) on the node
	 * that also carries `data-element-id`: the 3D scene's root, or the box the
	 * SVG fallback branch is drawn into. Set only by the main interactive canvas.
	 */
	readonly markElement = input<boolean>(false);
	/**
	 * Active font-style emphasis override (Bold Flash, Bold Reveal, Underline,
	 * Change Font Style/Size) for every node's caption, driven by native-
	 * animation playback. Mirrors `ChartElementViewComponent`'s `textStyle`
	 * threading for the 3D chart scenes: a canvas-texture caption has no DOM
	 * text node the CSS-injection path (`buildTextStyleOverrideCss`) can reach,
	 * so the scene's own `setTextStyle` handle method is the only way in.
	 */
	readonly textStyle = input<TextStyleAnimationDescriptor | undefined>(undefined);

	private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
	private readonly containerEl = viewChild<ElementRef<HTMLElement>>('container3d');
	private readonly nodeEditor3d = viewChild<ElementRef<HTMLTextAreaElement>>('nodeEditor3d');

	/** `true` until the 3D scene is known to be mountable; renders the SVG fallback. */
	readonly useFallback = signal(true);

	private readonly mountFn = signal<MountFn | null>(null);
	/** The live mounted handle, or `null` while unmounted. A signal so
	 * `setTextStyle` re-applies as soon as it (or the input) changes. */
	private readonly handle = signal<SceneHandle | null>(null);

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

	private readonly smartArtData = computed(() => getSmartArtData(this.element()));

	private readonly model = computed<SmartArt3DModel | null>(() =>
		buildSmartArt3DModelForElement(this.element()),
	);

	constructor() {
		afterNextRender(() => void this.loadScene());

		// Mount once the canvas exists and the scene runtime has loaded.
		effect(() => {
			const canvasEl = this.canvas()?.nativeElement;
			const fn = this.mountFn();
			const m = this.model();
			if (!canvasEl || !fn || !m || this.handle()) {
				return;
			}
			try {
				const el = this.element();
				this.handle.set(fn(canvasEl, m, el.width, el.height, { textStyle: this.textStyle() }));
			} catch {
				this.useFallback.set(true);
			}
		});

		// Resize without re-mounting.
		effect(() => {
			const el = this.element();
			this.handle()?.resize(el.width, el.height);
		});

		// Apply/clear the node-caption text-style override when it (or the live
		// handle) changes.
		effect(() => {
			this.handle()?.setTextStyle(this.textStyle());
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
		const data = this.smartArtData();
		if (!container || !data) {
			return;
		}
		// elementsFromPoint includes pointer-events:none nodes, so this finds the
		// <g data-smartart-node-id="..."> in the invisible overlay SVG.
		const nodeEl = findSmartArtNodeElementAtPoint(
			document.elementsFromPoint(event.clientX, event.clientY),
		);
		const nodeId = nodeEl?.getAttribute('data-smartart-node-id');
		if (!nodeEl || !nodeId) {
			return;
		}
		const currentText = data.nodes.find((n) => n.id === nodeId)?.text ?? '';
		this.draftText = currentText;
		this.editSettled = false;
		this.editState.set({
			nodeId,
			box: computeNode3DEditBox(nodeEl.getBoundingClientRect(), container.getBoundingClientRect()),
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
		this.handle()?.dispose();
		this.handle.set(null);
	}
}
