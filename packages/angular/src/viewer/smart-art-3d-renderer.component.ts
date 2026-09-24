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
	signal,
	viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement } from 'pptx-viewer-core';

import {
	elementHitTargetStyle,
	resolveSmartArtThreeViewSpec,
	shouldRenderHitTarget,
} from '../internal/shared';
import type { TextStyleAnimationDescriptor } from '../internal/shared';
import { EditorStateService } from './editor-state.service';
import { getContainerStyle } from './element-style';
import type { StyleMap } from './element-style';
import { Rendering3DService } from './rendering-3d.service';
import { SLIDE_CONTEXT } from './slide-context';
import {
	computeNode3DEditBox,
	findSmartArtNodeElementAtPoint,
	getSmartArtData,
} from './smart-art-3d-renderer-helpers';
import { commitNodeText, findOwningSlideIndex } from './smart-art-inline-edit';
import type { InlineEditState } from './smart-art-inline-edit';
import { SmartArtRendererComponent } from './smart-art-renderer.component';
import { ThreeViewComponent } from './three-view.component';

/**
 * SmartArt3DRendererComponent: Angular 3D SmartArt view on the shared
 * `<pptx-three-view>`. The spec (`resolveSmartArtThreeViewSpec`) and the whole
 * scene live in the shared package; this component projects the SVG
 * `<pptx-smart-art-renderer>` as the element's fallback (shown while the scene
 * loads, and kept when `three` is missing or the scene fails). A diagram with
 * nothing to draw renders the plain SVG. Mirrors React's `SmartArt3DView.tsx`.
 *
 * When `canEdit` is true, an invisible `<pptx-smart-art-renderer>` overlay is
 * stacked over the scene. Double-clicking
 * on the overlay uses `document.elementsFromPoint` to locate the `<g>` bearing
 * `data-smartart-node-id`, then opens an inline textarea editor over that node
 * (same commit path as the SVG renderer: `EditorStateService.updateElement`).
 */
@Component({
	selector: 'pptx-smart-art-3d-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, SmartArtRendererComponent, ThreeViewComponent, TranslatePipe],
	templateUrl: './smart-art-3d-renderer.component.html',
	styleUrl: './smart-art-3d-renderer.component.css',
})
export class SmartArt3DRendererComponent {
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
	/** Whether inline editing (drag/resize) is enabled on this surface. */
	readonly editable = input<boolean>(false);
	/** True only on the live presentation stage; see `ElementRendererComponent.presenting`. */
	readonly presenting = input<boolean>(false);
	/**
	 * Active font-style emphasis override (Bold Flash, Bold Reveal, Underline,
	 * Change Font Style/Size) for every node's caption, driven by native-
	 * animation playback. Mirrors `ChartElementViewComponent`'s `textStyle`
	 * threading for the 3D chart scenes: a canvas-texture caption has no DOM
	 * text node the CSS-injection path (`buildTextStyleOverrideCss`) can reach,
	 * so the scene's own text style is the only way in.
	 */
	readonly textStyle = input<TextStyleAnimationDescriptor | undefined>(undefined);

	private readonly containerEl = viewChild<ElementRef<HTMLElement>>('container3d');
	private readonly nodeEditor3d = viewChild<ElementRef<HTMLTextAreaElement>>('nodeEditor3d');

	private readonly rendering3D = inject(Rendering3DService, { optional: true });

	/** The scene spec, or `null` (flag off, or nothing to draw): render the plain SVG. */
	protected readonly spec = computed(() =>
		resolveSmartArtThreeViewSpec(this.element(), this.rendering3D?.flags().smartArt3D ?? false),
	);

	/** `true` when no 3D scene applies; renders the SVG renderer on its own. */
	readonly useFallback = computed(() => this.spec() === null);

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

	/**
	 * Interaction-only hit target for a degenerate 3D SmartArt; see
	 * `ElementRendererShapeComponent.hitTargetStyle`'s fuller doc (issue #285).
	 */
	readonly hitTargetStyle = computed(() =>
		shouldRenderHitTarget(this.editable(), this.presenting())
			? elementHitTargetStyle(this.element())
			: undefined,
	);

	private readonly smartArtData = computed(() => getSmartArtData(this.element()));

	constructor() {
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
}
