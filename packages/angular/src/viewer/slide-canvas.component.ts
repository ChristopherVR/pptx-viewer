/* oxlint-disable eslint/one-var -- pervasive pre-existing pattern in this file
   (many independent short-lived `const`s per handler); merging them isn't a
   style choice here. */
import { NgStyle } from '@angular/common';
import {
	afterNextRender,
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
	effect,
	ElementRef,
	forwardRef,
	HostListener,
	inject,
	input,
	output,
	signal,
	viewChild,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type {
	InkPptxElement,
	PptxElement,
	PptxGridSpacing,
	PptxSlide,
	PptxTableData,
	TextStyle,
} from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import {
	actionAffordanceLabels,
	applyElementActionAffordances,
	applyRenderedElementAccessibility,
	canInteractWithElement,
	collectConnectorSiteCandidates,
	editorNudgeDelta,
	findConnectorSiteNear,
	getConnectorEndpointHandles,
	isTemplateElement,
	resolveConnectorEndpointUpdate,
	withConnectorEndpointUpdate,
	RULER_FONT_SIZE,
	RULER_THICKNESS,
} from '../internal/shared';
import type {
	CanvasSize,
	ConnectorEndpointKind,
	ElementInteraction,
	RulerUnit,
	ShapeAdjustmentDragState,
	Tick,
} from '../internal/shared';
import type { AiChangeBatch } from '../internal/shared-ai';
import { resolveContextMenuElementId } from '../internal/shared-src/render/context-menu-target';
import { AiChangeOverlayComponent } from './ai/ai-change-overlay.component';
import { AiFocusHighlightOverlayComponent } from './ai/ai-focus-highlight-overlay.component';
import type { AiCanvasHighlight } from './ai/focus-targets';
import { CanvasFitService } from './canvas-fit.service';
import { applyMove, applyResize, marqueeHitIds } from './drag-resize';
import type { Box, ResizeHandle } from './drag-resize';
import { ElementRendererComponent } from './element-renderer.component';
import type { StyleMap } from './element-style';
import { FieldContextService } from './field-context.service';
import { InkDrawingService } from './ink-drawing.service';
import { resolveCommitTextAutoFitHeight } from './inline-edit-autofit-commit';
import { RulerGuidesService } from './ruler-guides.service';
import { rulerHighlight, rulerStripTicks } from './ruler-strips';
import {
	computeResizeHandleBoxes,
	computeRotateHandleBox,
	computeSelectionBoxes,
	computeSingleSelected,
	resolveInteractiveElementId,
} from './selection-geometry';
import {
	beginShapeAdjustmentDrag,
	computeAdjustHandles,
	draggedAdjustments,
} from './shape-adjust-handle';
import type { AdjustHandleBox } from './shape-adjust-handle';
import { getSlideBackgroundStyle } from './slide-background';
import { affordanceElements, isViewportBackgroundPressTarget } from './slide-canvas-helpers';
import { SLIDE_CONTEXT } from './slide-context';
import type { SlideContext } from './slide-context';
import { computeGridSpacingPx, computeSnap, snapToGridStep } from './snap-guides';
import type { SnapGuide } from './snap-guides';
import type { TableCellCommit } from './table-renderer.component';
import { isElementInteractive } from './template-mode';

/** Pixels (screen-space) a pointer must move before a click becomes a drag. */
const DRAG_THRESHOLD = 3;

/** Handle size in screen pixels (fine pointer: mouse/trackpad). */
const HANDLE_SCREEN_PX_FINE = 24;
/** Handle size in screen pixels (coarse pointer: touch); larger hit target. */
const HANDLE_SCREEN_PX_COARSE = 24;
/** Snap distance (screen pixels) for alignment guides. */
const SNAP_SCREEN_PX = 6;
/** Max delay (ms) between two taps to count as a double-tap on touch. */
const DOUBLE_TAP_MS = 300;

/**
 * True when the primary pointer is coarse (touch). Computed once at module
 * load; guarded for environments without `matchMedia` (SSR/tests).
 */
const IS_COARSE_POINTER: boolean =
	typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** Resize/rotate handle size in screen pixels for the current pointer kind. */
const HANDLE_SCREEN_PX = IS_COARSE_POINTER ? HANDLE_SCREEN_PX_COARSE : HANDLE_SCREEN_PX_FINE;

interface DragState {
	id: string;
	mode: 'move' | 'resize' | 'rotate';
	handle: ResizeHandle | null;
	startBox: Box;
	startX: number;
	startY: number;
	started: boolean;
	/** Rotation-gesture state (stage coords + degrees). */
	centerX?: number;
	centerY?: number;
	startAngle?: number;
	startRotation?: number;
}

/** Which lock governs each drag mode, for the mid-gesture lock re-check. */
const DRAG_MODE_INTERACTION: Readonly<Record<DragState['mode'], ElementInteraction>> = {
	move: 'move',
	resize: 'resize',
	rotate: 'rotate',
};

/** Best-effort plain text of a text-bearing element for inline editing. */
function plainText(el: PptxElement): string {
	if (!hasTextProperties(el)) {
		return '';
	}
	const segments = el.textSegments;
	if (segments && segments.length > 0) {
		return segments.map((s) => (s.isParagraphBreak || s.isLineBreak ? '\n' : s.text)).join('');
	}
	return el.text ?? '';
}

/**
 * SlideCanvasComponent: Angular port of the React `SlideCanvas.tsx` and Vue
 * `SlideCanvas.vue`.
 *
 * Renders the active slide as a fixed-size stage scaled by `zoom`, with each
 * element absolutely positioned. When `editable`, supports click-to-select
 * (event delegation), selection outlines, and pointer drag-to-move / resize
 * handles, plus the rulers, grid, guides, marquee, and collaboration
 * overlays.
 */
@Component({
	selector: 'pptx-slide-canvas',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [
		CanvasFitService,
		InkDrawingService,
		RulerGuidesService,
		// Expose which slide this canvas renders to leaf renderers (chart /
		// SmartArt), so template (master/layout) element commits can resolve
		// their owning slide; template elements are absent from slides[].elements.
		{ provide: SLIDE_CONTEXT, useExisting: forwardRef(() => SlideCanvasComponent) },
	],
	imports: [
		NgStyle,
		ElementRendererComponent,
		TranslatePipe,
		AiFocusHighlightOverlayComponent,
		AiChangeOverlayComponent,
	],
	styleUrl: './slide-canvas.component.css',
	templateUrl: './slide-canvas.component.html',
})
export class SlideCanvasComponent implements SlideContext {
	readonly slide = input<PptxSlide | undefined>(undefined);
	readonly canvasSize = input.required<CanvasSize>();

	/** {@link SlideContext}: the id of the slide this canvas renders. */
	slideId(): string | null {
		return this.slide()?.id ?? null;
	}
	readonly mediaDataUrls = input<Map<string, string>>(new Map());
	readonly zoom = input<number>(1);
	/** When true, elements are selectable and drag/resize handles are shown. */
	readonly editable = input<boolean>(false);
	/**
	 * When true, render a dot-grid overlay on the slide stage.
	 * Only active on the interactive (main editor) canvas; ignored on thumbnails.
	 * Defaults false so nothing changes unless toggled from the ribbon View tab.
	 */
	readonly showGrid = input<boolean>(false);
	/**
	 * When true, render horizontal and vertical ruler strips along the top/left
	 * of the slide viewport. Only active on the interactive canvas.
	 */
	readonly showRulers = input<boolean>(false);
	/**
	 * Unit system for the ruler labels. Defaults to inches, as PowerPoint does;
	 * the tick generator (shared with every other binding) also understands
	 * centimetres, which the old Angular-only generator could not express.
	 */
	readonly rulerUnit = input<RulerUnit>('inches');
	/**
	 * When true, render a static center-crosshair guide overlay on the slide stage.
	 * Only active on the interactive canvas.
	 */
	readonly showGuides = input<boolean>(false);
	/**
	 * When true, snap element positions to the grid increment during move.
	 * Combines with edge-alignment snapping.
	 */
	readonly snapToGrid = input<boolean>(false);
	/**
	 * The deck's authored grid spacing (EMU, from `viewProperties.gridSpacing`
	 * / `p:viewPr/p:gridSpacing` in `ppt/viewProps.xml`). `undefined` falls back
	 * to the 8px default in {@link gridSpacingPx}. NEVER read this off
	 * `presentationProperties` -- `p:gridSpacing` is not a child of
	 * `p:presentationPr`, and a real PowerPoint file never populates it there.
	 */
	readonly gridSpacing = input<PptxGridSpacing | undefined>(undefined);
	/** Whether moving elements snap to other element edges and centres. */
	readonly snapToShape = input<boolean>(true);
	/** Imperative toolbar request to add a centered user guide. */
	readonly guideCommand = input<{ id: number; axis: 'x' | 'y' } | null>(null);
	/** Whether the inline text editor uses the browser spell checker. */
	readonly spellCheck = input<boolean>(false);
	/**
	 * When true, snap elements to user-created ruler guides during move.
	 */
	readonly snapToGuides = input<boolean>(false);
	/**
	 * When true (default), the stage auto-fits the slide to the scroll viewport so
	 * the user's `zoom` is relative to "fit". Thumbnail consumers (slides panel,
	 * slide sorter) pass an explicit fit-to-width `zoom` and set this `false`, so
	 * their `zoom` is the sole scale; otherwise the two scales compound and the
	 * thumbnail shrinks to near-invisible.
	 */
	readonly autoFit = input<boolean>(true);
	/**
	 * Drop the resolved slide background so the stage stays see-through.
	 *
	 * Only a STACKED layer sets this: the morph transition overlay paints the
	 * departing slide's paired elements directly over the incoming stage, and a
	 * stage always paints `getSlideBackgroundStyle`, whose colour is never
	 * transparent (it falls back to `DEFAULT_SLIDE_BACKGROUND`, i.e. white). At
	 * the overlay's z-index that opaque field covered the incoming slide for the
	 * whole morph, so the morph looked like a static slab that hard-cut at the
	 * end. A whole-slide transition (fade / wipe / push) still needs its own
	 * background and leaves this false.
	 */
	readonly transparentBackground = input<boolean>(false);
	/**
	 * When true (default), the canvas + its elements expose the framework-neutral
	 * contract attributes (`data-pptx-viewport`, `aria-roledescription="slide"`,
	 * `data-pptx-element`). Thumbnail / preview / presentation instances pass
	 * `false` so only the main editing canvas exposes the contract (mirrors React,
	 * where thumbnails use a separate lightweight renderer). Prevents the shared
	 * e2e selectors from matching multiple elements.
	 */
	readonly interactive = input<boolean>(true);
	/**
	 * When true (default), this canvas's elements carry `data-element-id`.
	 *
	 * The miniature surfaces that paint EVERY slide at once (thumbnail rail,
	 * mobile slide sheet, slide sorter, presenter navigator, layout gallery, diff
	 * strip) pass `false`: they otherwise put one node per element PER SLIDE into
	 * the document, so a `[data-element-id]` query resolved a slide that is not
	 * on screen. It is deliberately separate from {@link interactive}, because
	 * the presentation stage is not interactive and still needs its ids (the
	 * morph engine generates keyframe CSS that selects on them).
	 */
	readonly exposeElementIds = input<boolean>(true);
	/**
	 * True only for the live presentation stage: slide-content media autoplays.
	 * Left false for thumbnails, the sorter and the editor canvas so their media
	 * stays quiet (the template layer never autoplays regardless).
	 *
	 * A presenting stage also carries the show contract: the shared
	 * `data-pptx-presenting` marker (stamped by
	 * `applyRenderedElementAccessibility`) plus `aria-roledescription="slide"`,
	 * so a running show is discoverable the same way in all five bindings.
	 */
	readonly presenting = input<boolean>(false);
	/** Ids of currently-selected elements (drawn with a selection outline). */
	readonly selectedIds = input<readonly string[]>([]);
	/** Id of the element currently being text-edited inline (or null). */
	readonly editingId = input<string | null>(null);
	/**
	 * When true, inherited master/layout (template) elements become interactive
	 * (selectable/draggable/deletable/editable) and show the editable affordance.
	 * When false (default) template elements still render but are inert, so normal
	 * slide editing never disturbs the shared template.
	 */
	readonly editTemplateMode = input<boolean>(false);
	/**
	 * Inherited master/layout (template) elements for this slide, separated out of
	 * `slide.elements` by the editor. Rendered as a dedicated layer BEHIND the
	 * slide's own elements; interactive only while {@link editTemplateMode} is on.
	 */
	readonly templateElements = input<readonly PptxElement[]>([]);

	// ── AI assistant inputs (main editing canvas only) ────────────────────────
	/**
	 * On-canvas AI highlight rings (explicit picks + the live tool focus), drawn
	 * inside the scaled stage so element coords map 1:1. Empty on thumbnails.
	 */
	readonly aiHighlights = input<readonly AiCanvasHighlight[]>([]);
	/** True while the AI is active: enables the colour tween on slide elements. */
	readonly aiActive = input<boolean>(false);
	/** Zero-based active slide index, so the overlay draws only its own slide. */
	readonly aiActiveSlideIndex = input<number>(0);
	/**
	 * The batch of just-applied AI element changes to play on the canvas (glide
	 * old->new, fade/scale in-out, glow), or null when idle. Drawn inside the
	 * scaled stage next to the focus overlay so bounds map 1:1. Empty on thumbnails.
	 */
	readonly aiChangeBatch = input<AiChangeBatch | null>(null);
	/**
	 * When true, the next element click(s) become AI picks (emitted via
	 * {@link elementSelect}) instead of selecting / dragging. mousedown never
	 * starts a drag while picking, mirroring React's pick mode.
	 */
	readonly aiPickMode = input<boolean>(false);

	// ── Draw tool inputs ──────────────────────────────────────────────────────
	/** Active draw tool. When not 'select', pointer gestures draw ink strokes. */
	readonly drawTool = input<'select' | 'pen' | 'highlighter' | 'eraser' | 'freeform'>('select');
	/** Active ink stroke colour (CSS colour string). */
	readonly drawColor = input<string>('#000000');
	/** Active ink stroke width in stage pixels. */
	readonly drawWidth = input<number>(3);

	/** Emitted when an element is pointer-pressed (with the additive modifier). */
	readonly elementSelect = output<{ id: string; additive: boolean }>();
	/** Emitted when empty stage space is pressed (deselect). */
	readonly backgroundClick = output<void>();
	/** Emitted once when a drag/resize gesture actually starts moving. */
	readonly transformStart = output<{ id: string; label: string }>();
	/** Emitted on each pointer move during a gesture with the new box. */
	readonly transformUpdate = output<{ id: string; box: Box }>();
	/**
	 * Emitted once a drag/resize gesture RELEASES, carrying every element id the
	 * gesture moved. The parent uses it to reroute the connectors bound to those
	 * shapes; without it a connector kept pointing at where its shape used to be,
	 * because the drag end simply discarded its state with no model write.
	 */
	readonly transformEnd = output<{ ids: readonly string[] }>();
	/**
	 * Emitted while the shape-adjustment (amber diamond) handle is dragged, with
	 * the `a:avLst` guide name and its new 0..50000 value. Deliberately separate
	 * from {@link transformUpdate}: an adjustment changes the shape's geometry
	 * parameter, never its box.
	 */
	readonly adjustUpdate = output<{ id: string; adjustments: Record<string, number> }>();

	/**
	 * Emitted when a connector endpoint drag lands: the whole rebuilt connector,
	 * because a DETACHED end has had its `a:stCxn` / `a:endCxn` key deleted and a
	 * merge of the surviving keys would leave the stale one behind.
	 */
	readonly connectorEndpointUpdate = output<{ id: string; element: PptxElement }>();
	/** Emitted on right-click with the element under the cursor (or null). */
	readonly contextMenu = output<{ id: string | null; x: number; y: number }>();
	/** Emitted on double-click of a text-bearing element to begin inline edit. */
	readonly textEditStart = output<{ id: string }>();
	/** Emitted with the new text when an inline edit commits. */
	readonly textCommit = output<{ id: string; text: string; height?: number }>();
	/**
	 * Emitted on EVERY keystroke while inline-editing. The commit path stays the
	 * only thing that touches editor state/history; this feeds the collaboration
	 * live preview so peers see typing before the edit commits.
	 */
	readonly textInput = output<{ id: string; text: string }>();
	/** Emitted when an inline edit is cancelled (Escape). */
	readonly textCancel = output<void>();
	/** Emitted on Ctrl/Cmd+B/I/U while inline-editing (parity with React/Vue). */
	readonly textFormat = output<{ id: string; updates: Partial<TextStyle> }>();
	/** Emitted during a rotate gesture with the new rotation (degrees). */
	readonly rotateUpdate = output<{ id: string; rotation: number }>();
	/** Emitted on marquee release with the ids of enclosed/overlapping elements. */
	readonly marqueeSelect = output<string[]>();
	/** Emitted when a pen/highlighter/freeform stroke is completed. */
	readonly inkStrokeComplete = output<InkPptxElement>();
	/** Emitted when the eraser tool hits an ink element (emits the element id). */
	readonly eraserHit = output<string>();
	/** Emitted when a table cell's inline text edit commits. */
	readonly cellCommit = output<{ id: string; commit: TableCellCommit }>();
	/** Emitted when a structural table change (drag-resize) should be persisted. */
	readonly tableChange = output<{ id: string; tableData: PptxTableData }>();

	private drag: DragState | null = null;
	/** Live shape-adjustment gesture (amber diamond), or null when idle. */
	private adjustDrag: ShapeAdjustmentDragState | null = null;

	/** Live connector-endpoint gesture, in SLIDE px, or null when idle. */
	protected readonly connectorEndpointDrag = signal<{
		kind: ConnectorEndpointKind;
		x: number;
		y: number;
	} | null>(null);
	private editCancelled = false;
	private marquee: {
		startX: number;
		startY: number;
		startScreenX: number;
		startScreenY: number;
		started: boolean;
	} | null = null;
	/** Live marquee rectangle (stage coords) while rubber-band selecting. */
	readonly marqueeRect = signal<{ x: number; y: number; width: number; height: number } | null>(
		null,
	);
	/** Live alignment-snap guide lines (stage coords) during a move. */
	readonly snapGuides = signal<readonly SnapGuide[]>([]);

	private readonly translate = inject(TranslateService);

	/** Per-instance pen/highlighter/freeform/eraser drawing controller. */
	protected readonly inkDrawing = inject(InkDrawingService);
	/** Per-instance user-created ruler-guide controller. */
	protected readonly rulerGuidesSvc = inject(RulerGuidesService);

	private readonly textEditor = viewChild<ElementRef<HTMLTextAreaElement>>('textEditor');
	private readonly stageRef = viewChild<ElementRef<HTMLElement>>('stage');
	private readonly viewportRef = viewChild<ElementRef<HTMLElement>>('viewport');

	/** Per-instance auto-fit scale measurement (see {@link CanvasFitService}). */
	private readonly canvasFit = inject(CanvasFitService);

	/**
	 * The on-screen scale used for ALL rendering and pointer→stage coordinate
	 * math: the user's zoom folded with the auto-fit. The parent keeps showing the
	 * raw user zoom as the percentage, so this stays internal to the canvas.
	 */
	private readonly effectiveScale = computed(() => this.canvasFit.fitScale() * this.zoom());

	/** The editing id we've already initialised the textarea for, to avoid re-seeding its value mid-edit. */
	private seededEditId: string | null = null;
	/** Last-tap timestamp + element id, for synthetic double-tap detection on touch. */
	private lastTap: { id: string; time: number } | null = null;
	private lastGuideCommandId = 0;

	constructor() {
		// Seed + focus the inline editor exactly once when it first appears for a
		// given element. The textarea is UNCONTROLLED (no `[value]` binding): if
		// Angular rewrote `value` on every change-detection pass the caret would
		// jump to position 0 and typed text would reverse. We therefore set the
		// initial text and select it only on first appearance, and never touch
		// `value` again while the user types.
		effect(() => {
			const editor = this.textEditor();
			const box = this.editingBox();
			if (!editor || !box) {
				if (!box) {
					this.seededEditId = null;
				}
				return;
			}
			if (this.seededEditId === box.id) {
				return;
			}
			this.seededEditId = box.id;
			editor.nativeElement.value = box.text;
			editor.nativeElement.focus();
			// Caret at end (do NOT select-all): typing appends to the existing text,
			// matching React/Vue inline editors (and the shared inline-edit e2e spec).
			const end = editor.nativeElement.value.length;
			editor.nativeElement.setSelectionRange(end, end);
		});

		// Wire the fit-scale measurement accessors (viewport element, autoFit,
		// canvasSize all live on this component).
		this.canvasFit.bind({
			autoFit: () => this.autoFit(),
			viewportElement: () => this.viewportRef()?.nativeElement,
			canvasSize: () => this.canvasSize(),
		});

		// Re-fit whenever the authored slide size changes (e.g. switching decks).
		effect(() => {
			this.canvasSize();
			this.canvasFit.recompute();
		});

		// Keep every delegated element renderer aligned with the shared role/name
		// model after Angular has committed the current slide DOM.
		effect(() => {
			const stage = this.stageRef()?.nativeElement;
			const elements = this.allElements();
			const interactive = this.interactive();
			const presenting = this.presenting();
			// An inherited master/layout shape only gets the authoring chrome while
			// it is actually editable, matching React's `canInteract` gate.
			const decorated = affordanceElements(elements, this.editTemplateMode(), isTemplateElement);
			if (stage && (interactive || presenting)) {
				queueMicrotask(() => {
					applyRenderedElementAccessibility(stage, elements, { presenting });
					// The on-canvas action affordances (amber badge + hover link
					// tooltip) ride the same post-render pass: `ElementRendererComponent`
					// dispatches every non-shape type straight to a per-type component
					// whose root IS the element node, leaving no wrapper in the template
					// to hang the chrome off.
					applyElementActionAffordances(stage, decorated, {
						canInteract: interactive,
						presenting,
						labels: actionAffordanceLabels((key) => this.translate.instant(key) as string),
					});
				});
			}
		});

		// Observe the viewport so the slide re-fits on container resize / rotation.
		const destroyRef = inject(DestroyRef);
		afterNextRender(() => {
			this.canvasFit.recompute();
			const el = this.viewportRef()?.nativeElement;
			if (typeof ResizeObserver !== 'undefined' && el) {
				const observer = new ResizeObserver(() => this.canvasFit.recompute());
				observer.observe(el);
				destroyRef.onDestroy(() => observer.disconnect());
			}
		});

		// Wire the ink-drawing controller's accessors + emitters (the stage
		// element, effective scale, and all-elements accessors, plus the two
		// outputs it completes, all live on this component).
		this.inkDrawing.bind({
			stageElement: () => this.stageRef()?.nativeElement,
			effectiveScale: () => this.effectiveScale(),
			elements: () => this.elements(),
			drawTool: () => this.drawTool(),
			drawColor: () => this.drawColor(),
			drawWidth: () => this.drawWidth(),
			emitInkStrokeComplete: (ink) => this.inkStrokeComplete.emit(ink),
			emitEraserHit: (id) => this.eraserHit.emit(id),
		});

		// Wire the ruler-guides controller's accessors (editable, stage element,
		// effective scale, canvas size all live on this component).
		this.rulerGuidesSvc.bind({
			editable: () => this.editable(),
			stageElement: () => this.stageRef()?.nativeElement,
			effectiveScale: () => this.effectiveScale(),
			canvasSize: () => this.canvasSize(),
		});

		effect(() => {
			const command = this.guideCommand();
			if (command && command.id !== this.lastGuideCommandId) {
				this.lastGuideCommandId = command.id;
				this.rulerGuidesSvc.addGuide(command.axis);
			}
		});
	}

	readonly elements = computed(() => this.slide()?.elements ?? []);

	/**
	 * Template elements + the slide's own elements, template first (behind). Used
	 * for every id-based lookup (hit-testing, selection boxes, inline-edit box) so
	 * a selected/dragged template element resolves the same as a normal one.
	 */
	readonly allElements = computed<readonly PptxElement[]>(() => [
		...this.templateElements(),
		...this.elements(),
	]);

	/**
	 * OOXML field-substitution context for the slide being rendered. Built from
	 * the viewer-scoped {@link FieldContextService} (header/footer + custom doc
	 * properties) folded with this slide's number + title. `optional` injection
	 * means canvases used outside the viewer subtree get no substitution.
	 */
	private readonly fieldContextSvc = inject(FieldContextService, { optional: true });
	readonly fieldContext = computed(() => this.fieldContextSvc?.forSlide(this.slide()));

	/**
	 * Obstacle rects (absolute slide coords) for connector A* routing: every
	 * non-connector element with a positive footprint. Bent connectors detour
	 * around these instead of cutting straight through neighbouring shapes.
	 */
	readonly connectorObstacles = computed(() =>
		this.allElements()
			.filter((e) => e.type !== 'connector' && e.width > 0 && e.height > 0)
			.map((e) => ({ x: e.x, y: e.y, width: e.width, height: e.height })),
	);

	/** Bounding boxes (stage coords) for the selected elements. */
	readonly selectionBoxes = computed(() =>
		computeSelectionBoxes(this.allElements(), this.selectedIds()),
	);

	/** The single selected element's box, or null when 0 or >1 are selected. */
	readonly singleSelected = computed<(Box & { id: string }) | null>(() =>
		computeSingleSelected(this.allElements(), this.selectedIds()),
	);

	/** Look an element up by id across the slide + template layers. */
	private elementById(id: string): PptxElement | undefined {
		return this.allElements().find((el) => el.id === id);
	}

	/** The single selected element itself (not just its box), or null. */
	private readonly singleSelectedElement = computed<PptxElement | null>(() => {
		const box = this.singleSelected();
		return box ? (this.elementById(box.id) ?? null) : null;
	});

	/**
	 * Resize-handle render boxes (stage coords) for the single selection. Empty
	 * for an element whose authored `a:spLocks/@noResize` pins its size.
	 */
	readonly handleBoxes = computed(() =>
		computeResizeHandleBoxes(
			this.singleSelectedElement(),
			this.singleSelected(),
			this.editable(),
			HANDLE_SCREEN_PX,
			this.effectiveScale(),
		),
	);

	/**
	 * Rotation-handle box (stage coords) above the single selection, or null (also
	 * null when `a:spLocks/@noRotation` is authored on the element).
	 */
	readonly rotateHandle = computed(() =>
		computeRotateHandleBox(
			this.singleSelectedElement(),
			this.singleSelected(),
			this.editable(),
			HANDLE_SCREEN_PX,
			24,
			this.effectiveScale(),
		),
	);

	/**
	 * Shape-adjustment-handle boxes (stage coords) for the single selection.
	 * Position, existence and cursor all come from the SHARED
	 * `getShapeAdjustmentHandleDescriptors`, so a handle appears only for a
	 * geometry that actually has an adjustable parameter, there is ONE per
	 * `a:avLst` guide, and each sits exactly where the other four bindings put
	 * it. Selection-only + editable-only, so they vanish in presentation with
	 * the rest of the chrome.
	 */
	readonly adjustHandles = computed(() =>
		computeAdjustHandles(
			this.singleSelectedElement(),
			this.singleSelected(),
			this.editable(),
			HANDLE_SCREEN_PX,
			this.effectiveScale(),
		),
	);

	/** The selected connector, when exactly one connector is selected. */
	private readonly selectedConnector = computed<PptxElement | null>(() => {
		const element = this.singleSelectedElement();
		return element && element.type === 'connector' ? element : null;
	});

	/**
	 * The two endpoint handles of the selected connector, in stage coords.
	 *
	 * Angular could DRAW a connector but never bind one: nothing in this binding
	 * ever wrote `a:stCxn` / `a:endCxn`, so `connector-reroute` only ever fired
	 * for connectors that arrived already bound from a `.pptx`.
	 */
	readonly connectorEndpoints = computed(() => {
		const connector = this.selectedConnector();
		if (!connector || !this.editable()) {
			return [];
		}
		const size = HANDLE_SCREEN_PX / (this.effectiveScale() || 1);
		const drag = this.connectorEndpointDrag();
		return getConnectorEndpointHandles(connector).map((handle) => {
			const live = drag?.kind === handle.kind ? drag : handle;
			return { ...handle, left: live.x - size / 2, top: live.y - size / 2, size };
		});
	});

	/** Candidate connection sites, resolved only while an end is in flight. */
	readonly connectorSiteCandidates = computed(() => {
		const connector = this.selectedConnector();
		if (!connector || !this.connectorEndpointDrag()) {
			return [];
		}
		const size = HANDLE_SCREEN_PX / (this.effectiveScale() || 1);
		const drag = this.connectorEndpointDrag();
		const candidates = collectConnectorSiteCandidates(
			this.allElements().filter((element) => element.id !== connector.id),
		);
		const snapped = drag ? findConnectorSiteNear(candidates, drag.x, drag.y) : null;
		return candidates.map((site) => ({
			key: `${site.elementId}-${site.siteIndex}`,
			left: site.x - size / 4,
			top: site.y - size / 4,
			size: size / 2,
			snapped: snapped?.elementId === site.elementId && snapped.siteIndex === site.siteIndex,
		}));
	});

	/** Begin dragging one end of the selected connector. */
	onConnectorEndpointPointerDown(event: PointerEvent, kind: ConnectorEndpointKind): void {
		event.preventDefault();
		event.stopPropagation();
		(event.target as Element | null)?.setPointerCapture?.(event.pointerId);
		this.connectorEndpointDrag.set({ kind, ...this.stagePoint(event) });
	}

	/** Pointer position in SLIDE px (the stage carries the scale as a transform). */
	private stagePoint(event: PointerEvent): { x: number; y: number } {
		const rect = this.stageRef()?.nativeElement.getBoundingClientRect();
		const scale = this.effectiveScale() || 1;
		return {
			x: (event.clientX - (rect?.left ?? 0)) / scale,
			y: (event.clientY - (rect?.top ?? 0)) / scale,
		};
	}

	/**
	 * Resolve the id of the interactive element under a pointer target, or null.
	 * See {@link resolveInteractiveElementId}.
	 */
	private interactiveElementIdAt(target: EventTarget | null): string | null {
		return resolveInteractiveElementId(target, this.allElements(), this.editTemplateMode());
	}

	onStagePointerDown(event: PointerEvent): void {
		if (!this.editable()) {
			return;
		}
		// A press that reaches the stage started OUTSIDE the inline text editor
		// (the textarea stops its own pointerdown). Flush the edit synchronously by
		// blurring it: this routes through commitText → textCommit now, instead of
		// relying on the native blur firing before pointerup clears selection, which
		// is unreliable on touch.
		if (this.editingId()) {
			this.textEditor()?.nativeElement.blur();
		}

		// ── DRAW BRANCH: must come before the select/marquee/drag path ─────────
		// When a draw tool is active, pointer gestures capture strokes; none of
		// the select/marquee/drag logic should run.
		if (this.inkDrawing.isDrawToolActive()) {
			this.inkDrawing.handleStagePointerDown(event);
			return;
		}
		// ── END DRAW BRANCH ─────────────────────────────────────────────────────

		// Capture the pointer so subsequent move/up events keep firing even when
		// the finger drifts off the original target (essential on touch, where the
		// browser would otherwise route the gesture elsewhere).
		(event.target as Element | null)?.setPointerCapture?.(event.pointerId);
		// Template (master/layout) elements are inert unless editTemplateMode is on;
		// the resolver returns null for them so they fall through to the marquee/
		// background path instead of being selected or dragged.
		const id = this.interactiveElementIdAt(event.target);
		// Synthetic double-tap: two TOUCH/PEN presses on the same element within
		// DOUBLE_TAP_MS begin inline text editing (native dblclick is unreliable
		// on touch). Desktop dblclick is handled separately in onDblClick. Mouse
		// presses are excluded so a touch select-tap immediately followed by a
		// mouse drag (as e2e drives move/resize) is never misread as a double-tap.
		if (id && event.pointerType !== 'mouse') {
			const now = event.timeStamp || Date.now();
			if (this.lastTap && this.lastTap.id === id && now - this.lastTap.time < DOUBLE_TAP_MS) {
				this.lastTap = null;
				if (this.canTextEdit(id)) {
					this.textEditStart.emit({ id });
				}
				return;
			}
			this.lastTap = { id, time: now };
		} else if (!id) {
			this.lastTap = null;
		}
		if (!id) {
			// Empty space: begin a marquee (rubber-band) selection.
			const stage = this.stageRef()?.nativeElement;
			if (stage) {
				const rect = stage.getBoundingClientRect();
				const zoom = this.effectiveScale() || 1;
				this.marquee = {
					startX: (event.clientX - rect.left) / zoom,
					startY: (event.clientY - rect.top) / zoom,
					startScreenX: event.clientX,
					startScreenY: event.clientY,
					started: false,
				};
			} else {
				this.backgroundClick.emit();
			}
			return;
		}
		this.elementSelect.emit({ id, additive: event.shiftKey || event.ctrlKey || event.metaKey });
		// AI pick mode: the press hands this element to the assistant (via the
		// parent's elementSelect handler); never begin a drag / inline edit.
		if (this.aiPickMode()) {
			return;
		}
		const el = this.allElements().find((e) => e.id === id);
		if (!el) {
			return;
		}
		// A `noMove` shape may still be SELECTED (otherwise the user could never
		// reach the inspector to unlock it) but must not arm a drag.
		if (!canInteractWithElement(el, 'move')) {
			return;
		}
		this.drag = {
			id,
			mode: 'move',
			handle: null,
			startBox: { x: el.x, y: el.y, width: el.width, height: el.height },
			startX: event.clientX,
			startY: event.clientY,
			started: false,
		};
	}

	/**
	 * Press on the scrollable viewport background (the empty workspace around a
	 * centered slide). The slide stage owns its own empty-press deselect, but
	 * clicks outside the slide borders land on the viewport container instead, so
	 * without this they would leave the current selection intact. Only direct hits
	 * on the viewport itself deselect; bubbled child events (wrapper, stage,
	 * rulers, handles, content) keep their existing behavior.
	 */
	onViewportPointerDown(event: PointerEvent): void {
		if (!this.editable()) {
			return;
		}
		if (!isViewportBackgroundPressTarget(event.target, event.currentTarget)) {
			return;
		}
		// Flush any in-progress inline edit synchronously, matching onStagePointerDown.
		if (this.editingId()) {
			this.textEditor()?.nativeElement.blur();
		}
		this.backgroundClick.emit();
	}

	/** Box + current plain text for the element under inline edit, or null. */
	readonly editingBox = computed(() => {
		const id = this.editingId();
		if (!id || !this.editable()) {
			return null;
		}
		const el = this.allElements().find((e) => e.id === id);
		if (!el) {
			return null;
		}
		return { id: el.id, x: el.x, y: el.y, width: el.width, height: el.height, text: plainText(el) };
	});

	/**
	 * May inline text editing begin on this element? Honours the authored
	 * `a:spLocks/@noTextEdit`, which Angular ignored entirely while the other four
	 * bindings enforced it: a locked caption opened an editable textarea here.
	 */
	private canTextEdit(id: string): boolean {
		return canInteractWithElement(
			this.allElements().find((el) => el.id === id),
			'textEdit',
		);
	}

	onDblClick(event: MouseEvent): void {
		if (!this.editable()) {
			return;
		}
		const id = this.interactiveElementIdAt(event.target);
		if (id && this.canTextEdit(id)) {
			event.preventDefault();
			this.textEditStart.emit({ id });
		}
	}

	onEditorKeydown(event: KeyboardEvent): void {
		const editor = event.target as HTMLTextAreaElement;
		// Inline formatting shortcuts (Ctrl/Cmd + B/I/U), matching React/Vue.
		if ((event.ctrlKey || event.metaKey) && !event.shiftKey) {
			const key = event.key.toLowerCase();
			if (key === 'b' || key === 'i' || key === 'u') {
				event.preventDefault();
				event.stopPropagation();
				this.emitTextFormat(key);
				return;
			}
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			this.editCancelled = true;
			editor.blur();
		} else if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			editor.blur();
		} else if (event.key === 'Enter' && event.shiftKey) {
			this.trimTrailingSpaceBeforeCaret(editor);
		}
	}

	/**
	 * When the caret sits at a soft word-wrap boundary (no explicit line break,
	 * just CSS wrapping), the space separating the two words is still part of
	 * the text and lands right before the caret. Inserting a line break there
	 * leaves the new line preceded by a stray space: e.g. "fox jumps" wrapped as
	 * "fox " / "jumps" becomes lines "fox " and "jumps" instead of "fox" and
	 * "jumps". That extra, invisible trailing character then counts toward the
	 * line's measured width, occasionally forcing an unwanted extra wrapped
	 * line. Since a space immediately before a line break is never visually
	 * meaningful, drop it before the browser inserts the native line break.
	 */
	private trimTrailingSpaceBeforeCaret(editor: HTMLTextAreaElement): void {
		const { selectionStart, selectionEnd, value } = editor;
		if (selectionStart === null || selectionStart !== selectionEnd || selectionStart === 0) {
			return;
		}
		if (value.charAt(selectionStart - 1) !== ' ') {
			return;
		}
		editor.value = value.slice(0, selectionStart - 1) + value.slice(selectionStart);
		editor.setSelectionRange(selectionStart - 1, selectionStart - 1);
	}

	/** Toggle bold/italic/underline for the element under inline edit. */
	private emitTextFormat(key: 'b' | 'i' | 'u'): void {
		const id = this.editingId();
		const el = id ? this.allElements().find((e) => e.id === id) : undefined;
		if (!id || !el) {
			return;
		}
		const styled = el as { textSegments?: Array<{ style?: TextStyle }>; textStyle?: TextStyle };
		const ts = styled.textSegments?.[0]?.style ?? styled.textStyle;
		const updates: Partial<TextStyle> =
			key === 'b'
				? { bold: !ts?.bold }
				: key === 'i'
					? { italic: !ts?.italic }
					: { underline: !ts?.underline };
		this.textFormat.emit({ id, updates });
	}

	/** Mirror each keystroke out for the collaboration live preview. */
	onTextInput(event: Event, id: string): void {
		this.textInput.emit({ id, text: (event.target as HTMLTextAreaElement).value });
	}

	commitText(event: Event, id: string): void {
		if (this.editCancelled) {
			this.editCancelled = false;
			this.textCancel.emit();
			return;
		}
		const editor = event.target as HTMLTextAreaElement;
		// `a:spAutoFit` ("Resize shape to fit text"): grow/shrink the shape to
		// the text's natural content height, the way PowerPoint does. `editor`
		// is the live, still-mounted textarea (this handler runs off its own
		// `blur`), so no separate DOM lookup is needed here.
		const height = resolveCommitTextAutoFitHeight(this.allElements(), id, editor);
		this.textCommit.emit(
			height !== undefined ? { id, text: editor.value, height } : { id, text: editor.value },
		);
	}

	onContextMenu(event: MouseEvent): void {
		if (!this.editable()) {
			return;
		}
		event.preventDefault();
		// The inline text editor renders as an overlay beside the elements, not a
		// child of the one it edits, so a right-click inside it hit-tests to
		// nothing via interactiveElementIdAt. Fall back to the element being
		// edited rather than swallowing the menu on the element the user just
		// clicked (matches Vue's and Svelte's useContextMenu/onStageContextMenu).
		const hitId = this.interactiveElementIdAt(event.target),
			id = resolveContextMenuElementId(hitId, event.target, this.editingId());
		this.contextMenu.emit({ id, x: event.clientX, y: event.clientY });
	}

	onHandlePointerDown(event: PointerEvent, handle: ResizeHandle): void {
		event.stopPropagation();
		(event.target as Element | null)?.setPointerCapture?.(event.pointerId);
		const box = this.singleSelected();
		if (!box || !canInteractWithElement(this.singleSelectedElement(), 'resize')) {
			return;
		}
		this.drag = {
			id: box.id,
			mode: 'resize',
			handle,
			startBox: { x: box.x, y: box.y, width: box.width, height: box.height },
			startX: event.clientX,
			startY: event.clientY,
			started: false,
		};
	}

	onRotatePointerDown(event: PointerEvent): void {
		event.stopPropagation();
		(event.target as Element | null)?.setPointerCapture?.(event.pointerId);
		const box = this.singleSelected();
		const stage = this.stageRef()?.nativeElement;
		const el = this.singleSelectedElement();
		if (!box || !stage || !canInteractWithElement(el, 'rotate')) {
			return;
		}
		const zoom = this.effectiveScale() || 1;
		const rect = stage.getBoundingClientRect();
		const centerX = box.x + box.width / 2;
		const centerY = box.y + box.height / 2;
		const px = (event.clientX - rect.left) / zoom;
		const py = (event.clientY - rect.top) / zoom;
		this.drag = {
			id: box.id,
			mode: 'rotate',
			handle: null,
			startBox: box,
			startX: event.clientX,
			startY: event.clientY,
			started: false,
			centerX,
			centerY,
			startAngle: Math.atan2(py - centerY, px - centerX),
			startRotation: el?.rotation ?? 0,
		};
	}

	/**
	 * Begin a shape-adjustment gesture on the amber diamond. Captures the shared
	 * {@link ShapeAdjustmentDragState} so every subsequent pointer move resolves
	 * through `getDraggedShapeAdjustmentValue` rather than the resize pipeline
	 * this handle used to be wired to.
	 */
	onAdjustPointerDown(event: PointerEvent, handle: AdjustHandleBox): void {
		event.stopPropagation();
		(event.target as Element | null)?.setPointerCapture?.(event.pointerId);
		const el = this.singleSelectedElement();
		if (!el) {
			return;
		}
		// The gesture acts on the diamond the user GRABBED, not on the element's
		// first adjustable parameter: a `quadArrow` has three and they are not
		// interchangeable.
		this.adjustDrag = beginShapeAdjustmentDrag(el, handle, event.clientX, event.clientY);
	}

	/**
	 * Keyboard resize from a focused handle.
	 *
	 * The step comes from the shared `editorNudgeDelta`, the same function the
	 * arrow keys nudge with, because a hand-rolled copy of it here is how the two
	 * gestures end up disagreeing: this one carried its own `shiftKey ? 10 : 1`
	 * literal, so a change to the shared step (which has already been wrong once,
	 * at 2/20 in two bindings) would have moved the nudge and left the keyboard
	 * resize behind.
	 */
	onResizeHandleKeydown(event: KeyboardEvent, handle: ResizeHandle): void {
		const delta = editorNudgeDelta(event.key, event.shiftKey);
		if (!delta) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		const box = this.singleSelected();
		if (!box) {
			return;
		}
		const { dx, dy } = delta;
		this.transformStart.emit({
			id: box.id,
			label: this.translate.instant('pptx.undoAction.resize'),
		});
		this.transformUpdate.emit({ id: box.id, box: applyResize(box, handle, dx, dy) });
	}

	onRotateHandleKeydown(event: KeyboardEvent): void {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		const box = this.singleSelected();
		const element = box ? this.allElements().find((item) => item.id === box.id) : undefined;
		if (!box || !element) {
			return;
		}
		const step = event.shiftKey ? 15 : 1;
		const delta = event.key === 'ArrowLeft' ? -step : step;
		this.transformStart.emit({
			id: box.id,
			label: this.translate.instant('pptx.undoAction.rotate'),
		});
		this.rotateUpdate.emit({ id: box.id, rotation: (element.rotation ?? 0) + delta });
	}

	@HostListener('document:pointermove', ['$event'])
	onPointerMove(event: PointerEvent): void {
		// ── GUIDE DRAG ────────────────────────────────────────────────────────
		if (this.rulerGuidesSvc.handlePointerMove(event)) {
			return;
		}
		// ── END GUIDE DRAG ────────────────────────────────────────────────────

		// ── DRAW BRANCH ───────────────────────────────────────────────────────
		// When a stroke is in progress, consume all pointer-move events for drawing.
		if (this.inkDrawing.handlePointerMove(event)) {
			return;
		}
		// ── END DRAW BRANCH ───────────────────────────────────────────────────

		// ── CONNECTOR ENDPOINT ────────────────────────────────────────────────
		// Resolved before the drag/resize pipeline: this gesture rebinds an end,
		// it never moves the connector's box as a whole.
		if (this.connectorEndpointDrag()) {
			const current = this.connectorEndpointDrag();
			if (current) {
				this.connectorEndpointDrag.set({ ...current, ...this.stagePoint(event) });
			}
			return;
		}
		// ── END CONNECTOR ENDPOINT ────────────────────────────────────────────

		// ── SHAPE ADJUSTMENT ──────────────────────────────────────────────────
		// The amber diamond writes `shapeAdjustments[key]`, never a box, so it is
		// resolved before (and independently of) the drag/resize pipeline.
		const adjust = this.adjustDrag;
		if (adjust) {
			const adjustments = draggedAdjustments(
				adjust,
				event.clientX,
				event.clientY,
				this.effectiveScale(),
			);
			const travelled = Math.hypot(
				event.clientX - adjust.startClientX,
				event.clientY - adjust.startClientY,
			);
			if (!adjust.moved && travelled >= DRAG_THRESHOLD) {
				adjust.moved = true;
				this.transformStart.emit({
					id: adjust.elementId,
					label: this.translate.instant('pptx.selectionOverlay.adjust'),
				});
			}
			if (adjust.moved) {
				this.adjustUpdate.emit({ id: adjust.elementId, adjustments });
			}
			return;
		}
		// ── END SHAPE ADJUSTMENT ──────────────────────────────────────────────

		const marquee = this.marquee;
		if (marquee) {
			const stage = this.stageRef()?.nativeElement;
			if (!stage) {
				return;
			}
			if (
				!marquee.started &&
				Math.abs(event.clientX - marquee.startScreenX) < DRAG_THRESHOLD &&
				Math.abs(event.clientY - marquee.startScreenY) < DRAG_THRESHOLD
			) {
				return;
			}
			marquee.started = true;
			const rect = stage.getBoundingClientRect();
			const z = this.effectiveScale() || 1;
			const curX = (event.clientX - rect.left) / z;
			const curY = (event.clientY - rect.top) / z;
			this.marqueeRect.set({
				x: Math.min(marquee.startX, curX),
				y: Math.min(marquee.startY, curY),
				width: Math.abs(curX - marquee.startX),
				height: Math.abs(curY - marquee.startY),
			});
			return;
		}

		const drag = this.drag;
		if (!drag) {
			return;
		}
		// Belt-and-braces lock gate: the pointer-down paths already refuse to arm a
		// gesture a lock forbids, but a lock added mid-gesture (a collaborator, an
		// AI edit) must not keep writing transforms for the rest of the drag.
		if (!canInteractWithElement(this.elementById(drag.id), DRAG_MODE_INTERACTION[drag.mode])) {
			this.drag = null;
			return;
		}
		const zoom = this.effectiveScale() || 1;

		if (!drag.started) {
			if (
				Math.abs(event.clientX - drag.startX) < DRAG_THRESHOLD &&
				Math.abs(event.clientY - drag.startY) < DRAG_THRESHOLD
			) {
				return;
			}
			drag.started = true;
			const label =
				drag.mode === 'move'
					? this.translate.instant('pptx.undoAction.move')
					: drag.mode === 'resize'
						? this.translate.instant('pptx.undoAction.resize')
						: this.translate.instant('pptx.undoAction.rotate');
			this.transformStart.emit({ id: drag.id, label });
		}

		if (drag.mode === 'rotate') {
			const stage = this.stageRef()?.nativeElement;
			if (
				!stage ||
				drag.centerX === undefined ||
				drag.centerY === undefined ||
				drag.startAngle === undefined ||
				drag.startRotation === undefined
			) {
				return;
			}
			const rect = stage.getBoundingClientRect();
			const px = (event.clientX - rect.left) / zoom;
			const py = (event.clientY - rect.top) / zoom;
			const angle = Math.atan2(py - drag.centerY, px - drag.centerX);
			const deltaDeg = ((angle - drag.startAngle) * 180) / Math.PI;
			const rotation = (((drag.startRotation + deltaDeg) % 360) + 360) % 360;
			this.rotateUpdate.emit({ id: drag.id, rotation: Math.round(rotation) });
			return;
		}

		const dx = (event.clientX - drag.startX) / zoom;
		const dy = (event.clientY - drag.startY) / zoom;
		let box =
			drag.mode === 'move' || drag.handle === null
				? applyMove(drag.startBox, dx, dy)
				: applyResize(drag.startBox, drag.handle, dx, dy);

		// Snap a move to nearby element edges/centres and show alignment guides.
		if (drag.mode === 'move') {
			const others = this.allElements()
				.filter((el) => el.id !== drag.id)
				.map((el) => ({ x: el.x, y: el.y, width: el.width, height: el.height }));
			if (this.snapToShape()) {
				const snap = computeSnap(box, others, SNAP_SCREEN_PX / zoom);
				box = { ...box, x: snap.x, y: snap.y };
				this.snapGuides.set(snap.guides);
			} else {
				this.snapGuides.set([]);
			}

			// Grid snap: applied after element-edge snap so grid takes precedence.
			if (this.snapToGrid()) {
				const step = this.gridSpacingPx();
				box = {
					...box,
					x: snapToGridStep(box.x, step),
					y: snapToGridStep(box.y, step),
				};
			}

			// Guide snap: snap the moving element to the nearest user guide.
			if (this.snapToGuides()) {
				const guides = this.rulerGuidesSvc.rulerGuides();
				const thr = SNAP_SCREEN_PX / zoom;
				let gx = box.x;
				let gy = box.y;
				for (const g of guides) {
					if (g.axis === 'x') {
						for (const candidate of [gx, gx + box.width / 2, gx + box.width]) {
							if (Math.abs(candidate - g.pos) <= thr) {
								gx = g.pos - (candidate - gx);
								break;
							}
						}
					} else {
						for (const candidate of [gy, gy + box.height / 2, gy + box.height]) {
							if (Math.abs(candidate - g.pos) <= thr) {
								gy = g.pos - (candidate - gy);
								break;
							}
						}
					}
				}
				box = { ...box, x: gx, y: gy };
			}
		}
		this.transformUpdate.emit({ id: drag.id, box });
	}

	@HostListener('document:pointerup')
	onPointerUp(): void {
		// ── GUIDE DRAG ────────────────────────────────────────────────────────
		if (this.rulerGuidesSvc.handlePointerUp()) {
			return;
		}
		// ── END GUIDE DRAG ────────────────────────────────────────────────────

		// ── DRAW BRANCH ───────────────────────────────────────────────────────
		// Finalise the stroke and emit the completed ink element.
		if (this.inkDrawing.handlePointerUp()) {
			return;
		}
		// ── END DRAW BRANCH ───────────────────────────────────────────────────

		// ── CONNECTOR ENDPOINT ────────────────────────────────────────────────
		// The drop point is the last position `onPointerMove` recorded: this host
		// listener takes no event, and re-deriving it from a stale pointer would
		// be worse than reading the value the move branch already resolved.
		const endpoint = this.connectorEndpointDrag();
		const connector = this.selectedConnector();
		if (endpoint) {
			this.connectorEndpointDrag.set(null);
			if (connector) {
				const elements = this.allElements();
				const target = findConnectorSiteNear(
					collectConnectorSiteCandidates(elements.filter((element) => element.id !== connector.id)),
					endpoint.x,
					endpoint.y,
				);
				const update = resolveConnectorEndpointUpdate(
					connector,
					elements,
					endpoint.kind,
					endpoint,
					target,
				);
				this.connectorEndpointUpdate.emit({
					id: connector.id,
					element: withConnectorEndpointUpdate(connector, update),
				});
			}
			return;
		}
		// ── END CONNECTOR ENDPOINT ────────────────────────────────────────────

		const marquee = this.marquee;
		if (marquee) {
			const rect = this.marqueeRect();
			if (marquee.started && rect) {
				// Only rubber-band-select elements the gate considers interactive, so
				// inert template elements are never swept up when editTemplateMode is off.
				const selectable = this.allElements().filter((el) =>
					isElementInteractive(el, true, this.editTemplateMode()),
				);
				const ids = marqueeHitIds(rect, selectable);
				this.marqueeSelect.emit(ids);
			} else {
				this.backgroundClick.emit();
			}
			this.marquee = null;
			this.marqueeRect.set(null);
		}
		if (this.adjustDrag) {
			this.adjustDrag = null;
			return;
		}
		const drag = this.drag;
		this.drag = null;
		this.snapGuides.set([]);
		// A gesture that actually moved/resized a shape must let the parent reroute
		// the connectors bound to it, otherwise every connector keeps pointing at
		// where its shape used to be. Rotation leaves the box (and so every
		// connection site's anchor) alone, so it is not worth a model write.
		if (drag?.started && drag.mode !== 'rotate') {
			this.transformEnd.emit({ ids: [drag.id] });
		}
	}

	readonly wrapperStyle = computed<StyleMap>(() => {
		const scale = this.effectiveScale();
		const size = this.canvasSize();
		const rulerOffset = this.interactive() && this.showRulers() ? RULER_THICKNESS : 0;
		// The wrapper uses content-box sizing so that the padding area (ruler strips)
		// and the content area (slide stage) are sized independently.
		// Total rendered width = padding-left + content-width = rulerOffset + slide*scale.
		return {
			width: `${size.width * scale}px`,
			height: `${size.height * scale}px`,
			'padding-top': rulerOffset > 0 ? `${rulerOffset}px` : '0',
			'padding-left': rulerOffset > 0 ? `${rulerOffset}px` : '0',
			position: 'relative',
			'box-sizing': 'content-box',
			margin: '1rem auto',
		};
	});

	/**
	 * Public accessor of the internal effective scale for ruler/overlay sizing
	 * inside the template. The field itself must stay private because it is
	 * consumed by many internal methods; exposing it directly via `protected`
	 * accessor avoids renaming all callers.
	 */
	readonly effectiveScalePublic = computed(() => this.effectiveScale());

	/**
	 * Grid dot spacing (slide-local px). Derived from the deck's authored
	 * `gridSpacing` input via the shared `computeGridSpacingPx`; falls back to
	 * 8px (matching React's `GRID_SIZE`) when the deck has none.
	 */
	readonly gridSpacingPx = computed(() => computeGridSpacingPx(this.gridSpacing(), 8));

	/**
	 * SVG dot-grid pattern id: unique per instance so multiple canvases on the
	 * same page do not share the same `<pattern>` definition.
	 */
	protected readonly gridPatternId = `pptx-ng-grid-${Math.random().toString(36).slice(2, 8)}`;

	/**
	 * Tick marks for the horizontal ruler strip (scaled slide width).
	 *
	 * Generated by the SHARED `generateTicks`, which is what gives Angular the
	 * same unit system, subdivision-density collapse at low zoom and label
	 * thinning the other bindings have. A local generator used to live in
	 * `ruler-ticks.ts` with fixed quarter-inch subdivisions and inch-only
	 * labels, so Angular disagreed with every other binding at every zoom.
	 */
	readonly hRulerTicks = computed<ReadonlyArray<Tick>>(() =>
		rulerStripTicks(
			this.interactive() && this.showRulers(),
			this.canvasSize().width,
			this.effectiveScale(),
			this.rulerUnit(),
		),
	);

	/** Tick marks for the vertical ruler strip (scaled slide height). */
	readonly vRulerTicks = computed<ReadonlyArray<Tick>>(() =>
		rulerStripTicks(
			this.interactive() && this.showRulers(),
			this.canvasSize().height,
			this.effectiveScale(),
			this.rulerUnit(),
		),
	);

	/** Ruler strip thickness / label font size, exposed for the template. */
	protected readonly rulerThickness = RULER_THICKNESS;
	protected readonly rulerFontSize = RULER_FONT_SIZE;

	/**
	 * Bounds of a single selection, highlighted on both strips (PowerPoint shades
	 * the selected shape's span on its rulers). Multi-selection paints nothing,
	 * matching React and Svelte.
	 */
	private readonly rulerHighlightBounds = computed(() => {
		const ids = this.selectedIds();
		if (ids.length !== 1) {
			return null;
		}
		const all = [...this.templateElements(), ...(this.slide()?.elements ?? [])];
		const element = all.find((candidate) => candidate.id === ids[0]);
		return element
			? { x: element.x, y: element.y, width: element.width, height: element.height }
			: null;
	});

	/** Selected element extent (scaled px) highlighted on the horizontal strip. */
	readonly hRulerHighlight = computed(() => {
		const bounds = this.rulerHighlightBounds();
		return rulerHighlight(bounds?.x, bounds?.width, this.effectiveScale());
	});

	/** Selected element extent (scaled px) highlighted on the vertical strip. */
	readonly vRulerHighlight = computed(() => {
		const bounds = this.rulerHighlightBounds();
		return rulerHighlight(bounds?.y, bounds?.height, this.effectiveScale());
	});

	readonly stageStyle = computed<StyleMap>(() => {
		const scale = this.effectiveScale();
		const size = this.canvasSize();
		const slide = this.slide();
		const style: StyleMap = {
			width: `${size.width}px`,
			height: `${size.height}px`,
			transform: `scale(${scale})`,
			'transform-origin': 'top left',
			position: 'relative',
			overflow: 'hidden',
			'box-shadow': '0 10px 40px rgba(0, 0, 0, 0.35)',
			// Motion-path keyframes translate by a fraction of the SLIDE, not of the
			// animated element's own box, so the stage publishes its size for those
			// `calc(var(--pptx-slide-w) * f)` offsets to resolve against.
			'--pptx-slide-w': `${size.width}px`,
			'--pptx-slide-h': `${size.height}px`,
			// Resolved slide background: image → gradient → pattern → solid colour.
			// A stacked overlay layer (the morph departing slide) opts out entirely
			// and stays see-through, so it cannot occlude the stage beneath it.
			...(this.transparentBackground()
				? { background: 'none', 'background-color': 'transparent', 'box-shadow': 'none' }
				: getSlideBackgroundStyle(slide)),
		};
		return style;
	});
}
