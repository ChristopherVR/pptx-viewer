import { NgStyle } from '@angular/common';
import {
	afterNextRender,
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
	effect,
	ElementRef,
	inject,
	Injector,
	input,
	signal,
	viewChild,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { PptxElement, PptxSmartArtData } from 'pptx-viewer-core';
import { setSmartArtNodeStyle } from 'pptx-viewer-core';

import {
	buildSmartArtA11y,
	computeInlineEditorRect,
	computeSmartArtLayout,
	flattenNodes,
	rebuildDrawingShapesIfCleared,
	resolveDrawingShapeNodeId,
	revealedSmartArtNodeCount,
} from '../internal/shared';
import type {
	ElementAnimationState,
	InlineEditRect,
	RenderedNode,
	SmartArtA11y,
	SmartArtLayoutResult,
} from '../internal/shared';
import { EditorStateService } from './editor-state.service';
import type { StyleMap } from './element-style';
import { SLIDE_CONTEXT } from './slide-context';
import {
	buildChromeStyle,
	computeDrawingViewBox,
	projectDrawingShapes,
	resolvePalette,
	styleShadowFilter,
} from './smart-art-drawing';
import type { DrawingViewBox, RenderedShape } from './smart-art-drawing';
import {
	beginNodeEdit,
	commitNodeText,
	findOwningSlideIndex,
	nodeIdFromKey,
} from './smart-art-inline-edit';
import type { InlineEditState } from './smart-art-inline-edit';
import {
	computeTextLines,
	narrowToCircle,
	narrowToPolygon,
	narrowToRect,
} from './smart-art-renderer-helpers';

/**
 * SmartArtRendererComponent: Angular SmartArt renderer.
 *
 * Data path mirrors the Vue `SmartArtRenderer.vue` and the React renderer:
 *  1. **Drawing shapes** (`smartArtData.drawingShapes`) -- the preferred path
 *     when the core extracted per-shape geometry from `ppt/diagrams/drawing*.xml`.
 *  2. **Shared SVG-fallback engine** (`computeSmartArtLayout`) -- when no drawing
 *     shapes exist, the framework-agnostic engine in `pptx-viewer-shared`
 *     positions/styles the node tree across all 10 layout families (list /
 *     process / cycle / hierarchy / matrix / radial / pyramid / venn / funnel /
 *     target), returning `RenderedNode[]` (rect / circle / polygon) +
 *     `RenderedConnector[]` view-models. Every binding renders the same
 *     geometry; this maps those view-models to SVG exactly as Vue does.
 *  3. **Placeholder** -- when there is neither data nor any nodes/shapes.
 *
 * Positioning is NOT this component's job: its chrome root fills the positioned,
 * element-id bearing box its host draws (the element dispatcher, the 3D
 * renderer's fallback branch, or a preview stage), the same contract the chart
 * and table renderers follow. Owning `left`/`top` here too offset the diagram
 * twice, and stamping the element id on this root hid the host's marked node
 * from anything reading the element contract by id.
 */
@Component({
	selector: 'pptx-smart-art-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, TranslatePipe],
	templateUrl: './smart-art-renderer.component.html',
	styleUrl: './smart-art-renderer.component.css',
})
export class SmartArtRendererComponent {
	/** The smartArt element to render. Must be `type === 'smartArt'`. */
	readonly element = input.required<PptxElement>();

	/**
	 * Whether inline on-canvas node-text editing is enabled. False in
	 * presentation / read-only / thumbnail contexts (mirrors the table renderer's
	 * `editable` input). Double-clicking a node only enters edit mode when true.
	 */
	readonly editable = input<boolean>(false);

	/**
	 * Native-animation playback state. A staged diagram build
	 * (`build.kind === 'diagram'`) reveals the leading nodes / drawing shapes for
	 * the current progress; absent or non-diagram state renders every node. The
	 * view box is still computed from the FULL shape set so the diagram does not
	 * rescale as it builds. Mirrors the Vue `SmartArtRenderer`'s reveal slice.
	 */
	readonly animationState = input<ElementAnimationState | undefined>(undefined);

	/**
	 * The editor state layer. Optional: the renderer is also used outside the
	 * editing viewer (thumbnails, export), where this service is not provided.
	 * Inline editing commits through `updateElement` here, the exact channel the
	 * inspector's SmartArt panel uses, so undo/redo + save round-trip are shared.
	 */
	private readonly editor = inject(EditorStateService, { optional: true });
	/** The hosting canvas's slide, for resolving template (master/layout) SmartArt. */
	private readonly slideContext = inject(SLIDE_CONTEXT, { optional: true });
	private readonly injector = inject(Injector);
	private readonly translate = inject(TranslateService);

	/** The node currently being edited on the canvas, or null. */
	protected readonly editState = signal<InlineEditState | null>(null);

	/** The mounted `<textarea>` for the active node edit, if any. */
	private readonly nodeEditor = viewChild<ElementRef<HTMLTextAreaElement>>('nodeEditor');

	/** Container div ref used to project hover rects into local coordinates. */
	private readonly smartartContainer = viewChild<ElementRef>('smartartContainer');

	/**
	 * The mounted style-bar popover, if any. Mousemove events landing inside it
	 * must not clear hover state, or the popover would unmount as soon as the
	 * pointer reaches the swatches it needs to be clicked.
	 */
	private readonly styleBar = viewChild<ElementRef>('styleBar');

	/** Pending "leave" timeout: grace period for the pointer to reach the style bar. */
	private hideTimeout: ReturnType<typeof setTimeout> | null = null;

	/**
	 * Guards against a cancel-triggered DOM-removal blur committing the edit.
	 * Set to true before programmatic cancellation; reset to false on each new edit.
	 */
	private editSettled = false;

	/** Whether node double-click / Enter enters inline edit (editable + has editor). */
	readonly canEditNodes = computed(() => this.editable() && this.editor !== null);

	constructor() {
		inject(DestroyRef).onDestroy(() => this.cancelPendingHide());
		// Focus + select-all the editor as soon as it mounts (mirrors the table
		// renderer's cell-input effect).
		effect(() => {
			if (this.editState()) {
				afterNextRender(
					() => {
						const el = this.nodeEditor()?.nativeElement;
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

	private readonly smartArtData = computed(() => {
		const el = this.element();
		return el.type === 'smartArt' ? el.smartArtData : undefined;
	});

	readonly chromeStyle = computed<StyleMap>(() => buildChromeStyle(this.smartArtData()?.chrome));

	readonly palette = computed<string[]>(() => resolvePalette(this.smartArtData()));

	readonly artStyle = computed(() => this.smartArtData()?.style ?? 'flat');

	readonly nodes = computed(() => this.smartArtData()?.nodes ?? []);

	readonly shadowFilter = computed<string | undefined>(() => styleShadowFilter(this.artStyle()));

	private readonly rawDrawingShapes = computed(() => this.smartArtData()?.drawingShapes ?? []);

	readonly hasDrawingShapes = computed(() => this.rawDrawingShapes().length > 0);

	// ── Staged diagram build (p:bldDgm) reveal ──────────────────────────────
	//
	// When an active native animation carries a staged diagram build, reveal only
	// the leading nodes / drawing shapes for the current progress; the view box is
	// still computed from the FULL shape set so the diagram does not rescale.

	private readonly diagramBuild = computed(() => {
		const build = this.animationState()?.build;
		return build?.kind === 'diagram' ? build : undefined;
	});

	private readonly shownNodeCount = computed(() => {
		const build = this.diagramBuild();
		return build ? revealedSmartArtNodeCount(this.nodes(), build) : this.nodes().length;
	});

	private readonly isPartialBuild = computed(
		() => this.diagramBuild() !== undefined && this.shownNodeCount() < this.nodes().length,
	);

	/** Leading node prefix revealed so far (full list when no partial build). */
	private readonly revealedNodes = computed(() =>
		this.isPartialBuild() ? this.nodes().slice(0, this.shownNodeCount()) : this.nodes(),
	);

	/** Leading drawing-shape prefix revealed so far (proportional to nodes). */
	private readonly revealedShapeList = computed(() => {
		const shapes = this.rawDrawingShapes();
		if (!this.isPartialBuild() || shapes.length === 0) {
			return shapes;
		}
		const count = Math.ceil(
			(this.shownNodeCount() / Math.max(this.nodes().length, 1)) * shapes.length,
		);
		return shapes.slice(0, count);
	});

	private readonly viewBox = computed<DrawingViewBox>(() =>
		computeDrawingViewBox(this.rawDrawingShapes()),
	);

	/** `viewBox` attribute string for the drawing-shapes `<svg>`. */
	readonly svgViewBox = computed<string>(() => {
		const vb = this.viewBox();
		return `0 0 ${vb.width} ${vb.height}`;
	});

	readonly renderedShapes = computed<RenderedShape[]>(() =>
		projectDrawingShapes(
			this.element().id,
			this.revealedShapeList(),
			this.viewBox(),
			this.palette(),
			this.artStyle(),
		),
	);

	/**
	 * Node id for each drawing shape (index-aligned with `renderedShapes`).
	 * Used to tag `<g>` elements with `data-smartart-node-id` so the 3D
	 * renderer's hit-test overlay can resolve a click to a node.
	 */
	readonly drawingShapeNodeIds = computed<(string | undefined)[]>(() => {
		const shapes = this.rawDrawingShapes();
		const nodes = this.nodes();
		return shapes.map((shape, i) => resolveDrawingShapeNodeId(shape, i, shapes, nodes));
	});

	// ── Shared SVG-fallback engine (no drawing shapes) ──────────────────────

	readonly layout = computed<SmartArtLayoutResult>(() => {
		const el = this.element();
		const data = this.smartArtData();
		return computeSmartArtLayout(
			this.revealedNodes(),
			{ width: Math.max(el.width, 1), height: Math.max(el.height, 1) },
			this.palette(),
			this.artStyle(),
			el.id,
			data?.resolvedLayoutType,
			data?.layout,
			undefined,
			data?.layoutDefinition,
			data?.presLayoutVars,
		);
	});

	readonly hasLayout = computed(() => this.layout().nodes.length > 0);

	// ── Accessibility view-model (shared) ───────────────────────────────────

	/**
	 * Screen-reader metadata for the whole diagram, derived by the shared
	 * `buildSmartArtA11y`. The container SVG gets `role="img"` + this `label`;
	 * each node gets a per-node `aria-label` + `<title>` resolved by node id.
	 */
	readonly a11y = computed<SmartArtA11y | undefined>(() => {
		const data = this.smartArtData();
		return data ? buildSmartArtA11y(data) : undefined;
	});

	/** Map of node id -> accessibility label (for per-node `<title>` lookup). */
	private readonly a11yLabelById = computed<Map<string, string>>(() => {
		const map = new Map<string, string>();
		for (const node of this.a11y()?.nodes ?? []) {
			map.set(node.id, node.label);
		}
		return map;
	});

	/**
	 * Parsed data-model node id for a rendered node (or `null` when the key does
	 * not map to one). Exposed as a method so the template can use it: Angular
	 * AOT templates can only call component members, not imported functions.
	 */
	nodeKeyId(node: RenderedNode): string | null {
		return nodeIdFromKey(node.key, this.element().id);
	}

	/** Resolve the accessibility label for a rendered node (by parsed node id). */
	nodeAriaLabel(node: RenderedNode): string | null {
		const nodeId = this.nodeKeyId(node);
		if (nodeId === null) {
			return null;
		}
		return this.a11yLabelById().get(nodeId) ?? null;
	}

	/**
	 * Polite live-region message announcing the most recent node-text commit.
	 * Empty between commits so assistive tech only speaks on change.
	 */
	readonly liveMessage = signal<string>('');

	protected readonly hoveredNodeId = signal<string | null>(null);
	protected readonly hoveredNodeRect = signal<InlineEditRect | null>(null);

	/** Narrowing helpers bound as class properties for template type-checking. */
	protected readonly asCircle = narrowToCircle;
	protected readonly asPolygon = narrowToPolygon;
	protected readonly asRect = narrowToRect;
	protected readonly textLines = computeTextLines;

	// ── Inline node-text editing ───────────────────────────────────────────

	/** Double-click a node enters inline edit mode (when editable). */
	onNodeDblClick(event: Event, node: RenderedNode): void {
		if (!this.canEditNodes()) {
			return;
		}
		event.stopPropagation();
		this.enterEdit(node);
	}

	/** Enter / F2 on a focused node enters inline edit mode (when editable). */
	onNodeKeydown(event: KeyboardEvent, node: RenderedNode): void {
		if (!this.canEditNodes() || (event.key !== 'Enter' && event.key !== 'F2')) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		this.enterEdit(node);
	}

	/** Commit the current edit (called on blur). */
	commitEdit(event: Event): void {
		if (this.editSettled) {
			this.editSettled = false;
			return;
		}
		const edit = this.editState();
		if (!edit) {
			return;
		}
		const value = (event.target as HTMLTextAreaElement).value;
		this.editState.set(null);
		this.applyCommit(edit.nodeId, value);
	}

	/** Enter commits (Shift+Enter inserts a newline); Escape cancels. */
	onEditorKeydown(event: KeyboardEvent): void {
		event.stopPropagation();
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			// Commit via blur so the single commit path runs once.
			(event.target as HTMLTextAreaElement).blur();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			// Mark as settled so the DOM-removal blur does not commit the cancelled edit.
			this.editSettled = true;
			this.editState.set(null);
		}
	}

	/** Resolve the node id + geometry and open the editor seeded with full text. */
	private enterEdit(node: RenderedNode): void {
		this.editSettled = false;
		const elementId = this.element().id;
		const seed = beginNodeEdit(node, elementId, this.rawNodeText(node));
		if (seed) {
			this.editState.set(seed);
		}
	}

	/** The node's full (untruncated) data-model text, falling back to rendered text. */
	private rawNodeText(node: RenderedNode): string {
		const nodeId = this.nodeKeyId(node);
		if (nodeId === null) {
			return node.text;
		}
		const match = flattenNodes(this.nodes()).find((n) => n.id === nodeId);
		return match ? match.text : node.text;
	}

	/** Commit edited text through the shared editor state (one history entry). */
	private applyCommit(nodeId: string, text: string): void {
		const data = this.smartArtData();
		const editor = this.editor;
		if (!data || !editor) {
			return;
		}
		const next = commitNodeText(data, nodeId, text);
		if (next === data) {
			return;
		}
		const slideIndex = findOwningSlideIndex(
			editor.slides(),
			this.element().id,
			this.slideContext?.slideId() ?? null,
		);
		if (slideIndex < 0) {
			return;
		}
		editor.updateElement(slideIndex, this.element().id, {
			smartArtData: this.reflow(next),
		} as Partial<PptxElement>);
		// Announce the commit to assistive technology via the polite live region.
		this.liveMessage.set(
			text.trim().length > 0
				? this.translate.instant('pptx.smartart.nodeUpdated', { text: text.trim() })
				: this.translate.instant('pptx.smartart.nodeCleared'),
		);
	}

	// ── Style bar & hover tracking ────────────────────────────────────────

	/** Approximate rendered size of the style bar (6 swatches + padding/border). */
	private static readonly STYLE_BAR_WIDTH = 168;
	private static readonly STYLE_BAR_HEIGHT = 40;

	/** Grace period (ms) before clearing hover state once the pointer leaves the
	 * node, so it can cross the small visual gap to the style bar. */
	private static readonly HIDE_GRACE_MS = 150;

	protected readonly styleBarStyle = computed<Record<string, string> | null>(() => {
		const rect = this.hoveredNodeRect();
		const cnt = this.smartartContainer()?.nativeElement as HTMLElement | undefined;
		if (!rect || !cnt) {
			return null;
		}
		const maxLeft = Math.max(0, cnt.clientWidth - SmartArtRendererComponent.STYLE_BAR_WIDTH);
		const maxTop = Math.max(0, cnt.clientHeight - SmartArtRendererComponent.STYLE_BAR_HEIGHT);
		return {
			position: 'absolute',
			left: `${Math.min(maxLeft, Math.max(0, rect.left + rect.width - SmartArtRendererComponent.STYLE_BAR_WIDTH))}px`,
			top: `${Math.min(maxTop, Math.max(0, rect.top - 22))}px`,
			'z-index': '25',
		};
	});

	protected onMouseMove(event: MouseEvent): void {
		if (!this.canEditNodes()) {
			return;
		}
		const nodeEl = this.findNodeEl(event.target as EventTarget);
		const cnt = this.smartartContainer()?.nativeElement as HTMLElement | undefined;
		if (nodeEl && cnt) {
			this.cancelPendingHide();
			const id = nodeEl.getAttribute('data-smartart-node-id');
			this.hoveredNodeId.set(id);
			this.hoveredNodeRect.set(
				id
					? computeInlineEditorRect(nodeEl.getBoundingClientRect(), cnt.getBoundingClientRect())
					: null,
			);
			return;
		}
		// Pointer may be over the style-bar popover anchored to the currently
		// hovered node (not the node itself) - keep the hover state so the
		// popover doesn't unmount out from under the pointer.
		const styleBarEl = this.styleBar()?.nativeElement as HTMLElement | undefined;
		if (styleBarEl && event.target instanceof Node && styleBarEl.contains(event.target)) {
			this.cancelPendingHide();
			return;
		}
		this.cancelPendingHide();
		this.hideTimeout = setTimeout(() => {
			this.hoveredNodeId.set(null);
			this.hoveredNodeRect.set(null);
			this.hideTimeout = null;
		}, SmartArtRendererComponent.HIDE_GRACE_MS);
	}

	protected onMouseLeave(): void {
		this.cancelPendingHide();
		this.hoveredNodeId.set(null);
		this.hoveredNodeRect.set(null);
	}

	private cancelPendingHide(): void {
		if (this.hideTimeout !== null) {
			clearTimeout(this.hideTimeout);
			this.hideTimeout = null;
		}
	}

	private findNodeEl(target: EventTarget | null): Element | null {
		let el = target instanceof Element ? target : null;
		while (el) {
			if (el.hasAttribute('data-smartart-node-id')) {
				return el;
			}
			el = el.parentElement;
		}
		return null;
	}

	protected handleChangeNodeStyle(nodeId: string, fill: string): void {
		const data = this.smartArtData();
		if (!data || !this.editor) {
			return;
		}
		const next = setSmartArtNodeStyle(data, nodeId, { fillColor: fill });
		if (next === data) {
			return;
		}
		const slideIndex = findOwningSlideIndex(
			this.editor.slides(),
			this.element().id,
			this.slideContext?.slideId() ?? null,
		);
		if (slideIndex < 0) {
			return;
		}
		this.editor.updateElement(slideIndex, this.element().id, {
			smartArtData: this.reflow(next),
		} as Partial<PptxElement>);
	}

	/**
	 * Reflow `drawingShapes` back from the shared layout engine when an edit op
	 * cleared them (every text/style edit does) -- otherwise the renderer falls
	 * back to the generic SVG layout for every node, not just the edited one.
	 */
	private reflow(data: PptxSmartArtData): PptxSmartArtData {
		const el = this.element();
		return rebuildDrawingShapesIfCleared(
			data,
			data.layout,
			resolvePalette(data),
			data.style ?? 'flat',
			el.id,
			{ width: el.width, height: el.height },
		);
	}

	// ── Empty / no-data state ──────────────────────────────────────────────

	readonly isEmpty = computed(() => this.nodes().length === 0 && !this.hasDrawingShapes());
}

// Re-export helper types used in the template so template type-checking works.
export type { DrawingViewBox, RenderedShape };
