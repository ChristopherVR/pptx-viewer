import { NgStyle } from '@angular/common';
import {
	afterNextRender,
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
	effect,
	ElementRef,
	HostListener,
	inject,
	input,
	output,
	signal,
	viewChild,
} from '@angular/core';
import type { InkPptxElement, PptxElement, PptxSlide } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import type { CanvasSize } from '../internal/shared';
import {
	applyMove,
	applyResize,
	handleAnchor,
	handleCursor,
	marqueeHitIds,
	RESIZE_HANDLES,
} from './drag-resize';
import type { Box, ResizeHandle } from './drag-resize';
import { ElementRendererComponent } from './element-renderer.component';
import type { StyleMap } from './element-style';
import { FieldContextService } from './field-context.service';
import { pointsToSvgPathD, strokeToInkElement } from './ink-drawing-helpers';
import type { InkPoint } from './ink-drawing-helpers';
import { getSlideBackgroundStyle } from './slide-background';
import { isViewportBackgroundPressTarget } from './slide-canvas-helpers';
import { computeSnap, snapToGridStep } from './snap-guides';
import type { SnapGuide } from './snap-guides';
import type { TableCellCommit } from './table-renderer.component';
import { isElementInteractive } from './template-mode';

/** Pixels (screen-space) a pointer must move before a click becomes a drag. */
const DRAG_THRESHOLD = 3;

// ── Ruler constants ───────────────────────────────────────────────────────────

/** Height/width (px) of the ruler strips: mirrors React's RULER_THICKNESS. */
const RULER_THICKNESS = 20;
/** Pixels per inch on the slide canvas (PPTX slides are 10" wide = 960 px). */
const SLIDE_PX_PER_INCH = 96;

/** A single tick mark on a ruler strip. */
interface RulerTick {
	/** Position in screen pixels along the ruler. */
	position: number;
	/** Whether this is a major (inch) tick. */
	isMajor: boolean;
	/** Label to display (only on major ticks, every N inches). */
	label: string | null;
}

/**
 * Generate ruler tick marks for a given slide dimension and scale.
 * Produces ticks every 1/4 inch (minor) and every inch (major).
 */
function generateRulerTicks(slidePx: number, scale: number): ReadonlyArray<RulerTick> {
	const scaledLength = slidePx * scale;
	const quarterInchPx = (SLIDE_PX_PER_INCH / 4) * scale;
	if (quarterInchPx < 2) {
		return [];
	}
	const ticks: RulerTick[] = [];
	let pos = 0;
	let inchIndex = 0;
	while (pos <= scaledLength + 0.5) {
		const isMajor = inchIndex % 4 === 0;
		ticks.push({
			position: pos,
			isMajor,
			label: isMajor && inchIndex > 0 ? String(inchIndex / 4) : null,
		});
		pos += quarterInchPx;
		inchIndex++;
	}
	return ticks;
}
/** Handle size in screen pixels (fine pointer: mouse/trackpad). */
const HANDLE_SCREEN_PX_FINE = 9;
/** Handle size in screen pixels (coarse pointer: touch); larger hit target. */
const HANDLE_SCREEN_PX_COARSE = 20;
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

/** A user-created guide line dragged from a ruler strip. */
interface RulerGuide {
	id: string;
	axis: 'x' | 'y';
	pos: number;
}

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
 * handles. Rulers, grid, guides, marquee, and collaboration overlays are
 * tracked in PORTING.md.
 */
@Component({
	selector: 'pptx-slide-canvas',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, ElementRendererComponent],
	styles: [
		`
			/*
			 * In editor mode the stage must own all pointer gestures so touch
			 * drag/resize/rotate/marquee aren't stolen by the browser for
			 * panning/pinch-zooming. View-only mode keeps default behaviour so
			 * the slide can still be scrolled.
			 */
			.pptx-ng-canvas-stage.is-editable {
				touch-action: none;
			}
		`,
	],
	template: `
		<div
			#viewport
			class="pptx-ng-canvas-viewport"
			[attr.data-pptx-viewport]="interactive() ? '' : null"
			(pointerdown)="onViewportPointerDown($event)"
		>
			<div class="pptx-ng-canvas-wrapper" [ngStyle]="wrapperStyle()">
				<div
					#stage
					class="pptx-ng-canvas-stage"
					[class.is-editable]="editable()"
					role="region"
					[attr.aria-roledescription]="interactive() ? 'slide' : null"
					[ngStyle]="stageStyle()"
					(pointerdown)="onStagePointerDown($event)"
					(contextmenu)="onContextMenu($event)"
					(dblclick)="onDblClick($event)"
				>
					<!--
						Template layer: inherited master/layout elements, rendered BEHIND
						the slide's own elements (lower z-index). Interactive + given the
						amber editable affordance only while editTemplateMode is on; when
						off they render inertly with no affordance, exactly as core
						delivered them.
					-->
					@for (element of templateElements(); track element.id; let i = $index) {
						<pptx-element-renderer
							[element]="element"
							[mediaDataUrls]="mediaDataUrls()"
							[zIndex]="i"
							[obstacles]="connectorObstacles()"
							[canvasWidth]="canvasSize().width"
							[canvasHeight]="canvasSize().height"
							[interactive]="interactive() && editTemplateMode()"
							[editable]="editable() && editTemplateMode()"
							[fieldContext]="fieldContext()"
							[editTemplateMode]="editTemplateMode()"
							(cellCommit)="cellCommit.emit($event)"
						/>
					}
					@for (element of elements(); track element.id; let i = $index) {
						<pptx-element-renderer
							[element]="element"
							[mediaDataUrls]="mediaDataUrls()"
							[zIndex]="templateElements().length + i"
							[obstacles]="connectorObstacles()"
							[canvasWidth]="canvasSize().width"
							[canvasHeight]="canvasSize().height"
							[interactive]="interactive()"
							[editable]="editable()"
							[fieldContext]="fieldContext()"
							[editTemplateMode]="false"
							(cellCommit)="cellCommit.emit($event)"
						/>
					}
					@for (box of selectionBoxes(); track box.id) {
						<div
							class="pptx-ng-selection"
							[style.left.px]="box.x"
							[style.top.px]="box.y"
							[style.width.px]="box.width"
							[style.height.px]="box.height"
						></div>
					}
					@for (h of handleBoxes(); track h.handle) {
						<div
							class="pptx-ng-handle"
							[style.left.px]="h.left"
							[style.top.px]="h.top"
							[style.width.px]="h.size"
							[style.height.px]="h.size"
							[style.cursor]="h.cursor"
							(pointerdown)="onHandlePointerDown($event, h.handle)"
						></div>
					}
					@if (marqueeRect(); as mr) {
						<div
							class="pptx-ng-marquee"
							[style.left.px]="mr.x"
							[style.top.px]="mr.y"
							[style.width.px]="mr.width"
							[style.height.px]="mr.height"
						></div>
					}
					@for (g of snapGuides(); track $index) {
						<div
							class="pptx-ng-snap-guide"
							[style.left.px]="g.axis === 'x' ? g.pos : g.start"
							[style.top.px]="g.axis === 'x' ? g.start : g.pos"
							[style.width.px]="g.axis === 'x' ? 0 : g.end - g.start"
							[style.height.px]="g.axis === 'x' ? g.end - g.start : 0"
						></div>
					}
					@if (rotateHandle(); as rh) {
						<div
							class="pptx-ng-rotate-handle"
							role="button"
							aria-label="Rotate"
							[style.left.px]="rh.left"
							[style.top.px]="rh.top"
							[style.width.px]="rh.size"
							[style.height.px]="rh.size"
							(pointerdown)="onRotatePointerDown($event)"
						></div>
					}
					@if (adjustHandle(); as ah) {
						<!--
							Shape-adjustment affordance (amber diamond). Mirrors React's
							separate "Adjust shape" handle: a selection-only control that
							appears for a selected element in editable mode and is gone in
							presentation (the whole canvas is non-editable then). Dragging it
							adjusts the shape via the same resize pipeline (SE corner),
							keeping it a real, useful affordance rather than a decoy.
						-->
						<div
							class="pptx-ng-adjust-handle"
							role="button"
							aria-label="Adjust shape"
							[style.left.px]="ah.left"
							[style.top.px]="ah.top"
							[style.width.px]="ah.size"
							[style.height.px]="ah.size"
							(pointerdown)="onHandlePointerDown($event, 'se')"
						></div>
					}
					@if (editingBox(); as eb) {
						<textarea
							#textEditor
							data-inline-editor
							class="pptx-ng-text-editor"
							[style.left.px]="eb.x"
							[style.top.px]="eb.y"
							[style.width.px]="eb.width"
							[style.height.px]="eb.height"
							(pointerdown)="$event.stopPropagation()"
							(blur)="commitText($event, eb.id)"
							(keydown)="onEditorKeydown($event)"
						></textarea>
					}

					<!--
						View overlays: editor aids only, never on thumbnails/preview/presentation.
						All are pointer-events:none so they never break selection/drag.
						None carry data-pptx-element / aria-roledescription / data-pptx-viewport.
					-->
					@if (interactive() && showGrid()) {
						<svg
							class="pptx-ng-overlay-grid"
							aria-hidden="true"
							[attr.width]="canvasSize().width"
							[attr.height]="canvasSize().height"
						>
							<defs>
								<pattern
									[attr.id]="gridPatternId"
									[attr.width]="gridSpacingPx()"
									[attr.height]="gridSpacingPx()"
									patternUnits="userSpaceOnUse"
								>
									<circle
										[attr.cx]="gridSpacingPx() / 2"
										[attr.cy]="gridSpacingPx() / 2"
										r="0.6"
										fill="rgba(156,163,175,0.55)"
									/>
								</pattern>
							</defs>
							<rect
								[attr.width]="canvasSize().width"
								[attr.height]="canvasSize().height"
								[attr.fill]="'url(#' + gridPatternId + ')'"
							/>
						</svg>
					}

					@if (interactive() && showGuides()) {
						<!--
							Center crosshair: one horizontal line and one vertical line
							through the midpoint of the slide. Static; draggable guides
							are a follow-up.
						-->
						<svg
							class="pptx-ng-overlay-guides"
							aria-hidden="true"
							[attr.width]="canvasSize().width"
							[attr.height]="canvasSize().height"
						>
							<!-- Horizontal center guide -->
							<line
								x1="0"
								[attr.y1]="canvasSize().height / 2"
								[attr.x2]="canvasSize().width"
								[attr.y2]="canvasSize().height / 2"
								stroke="rgba(99,102,241,0.7)"
								stroke-width="1"
								stroke-dasharray="6 3"
							/>
							<!-- Vertical center guide -->
							<line
								[attr.x1]="canvasSize().width / 2"
								y1="0"
								[attr.x2]="canvasSize().width / 2"
								[attr.y2]="canvasSize().height"
								stroke="rgba(99,102,241,0.7)"
								stroke-width="1"
								stroke-dasharray="6 3"
							/>
						</svg>

						<!--
							User-created ruler guides.
							Each guide has a non-interactive line body and an interactive
							drag handle. Double-click the handle to delete the guide.
						-->
						@for (g of rulerGuides(); track g.id) {
							<!-- Guide line body: pointer-events:none -->
							<div
								class="pptx-ng-ruler-guide-line"
								[style.left.px]="g.axis === 'x' ? g.pos : 0"
								[style.top.px]="g.axis === 'y' ? g.pos : 0"
								[style.width]="g.axis === 'x' ? '1px' : '100%'"
								[style.height]="g.axis === 'y' ? '1px' : '100%'"
							></div>
							<!-- Drag handle: pointer-events:auto -->
							<div
								class="pptx-ng-ruler-guide-handle"
								[style.left.px]="g.axis === 'x' ? g.pos - 4 : 0"
								[style.top.px]="g.axis === 'y' ? g.pos - 4 : 0"
								[style.width]="g.axis === 'x' ? '9px' : '100%'"
								[style.height]="g.axis === 'y' ? '9px' : '100%'"
								[style.cursor]="g.axis === 'x' ? 'col-resize' : 'row-resize'"
								(pointerdown)="onGuidePointerDown($event, g.id, g.axis)"
								(dblclick)="onGuideDoubleClick($event, g.id)"
								title="Drag to move guide. Double-click to remove."
							></div>
						}
					}

					<!--
						Live ink stroke preview: shown while the user is drawing.
						pointer-events:none so it never intercepts element gestures.
						No data-pptx-element / aria-roledescription / data-pptx-viewport.
					-->
					@if (inkActiveSignal() && liveInkPath() && drawTool() !== 'select') {
						<svg
							class="pptx-ng-ink-preview"
							aria-hidden="true"
							[attr.width]="canvasSize().width"
							[attr.height]="canvasSize().height"
							style="position:absolute;inset:0;pointer-events:none;z-index:70"
						>
							<path
								[attr.d]="liveInkPath()"
								fill="none"
								[attr.stroke]="drawColor()"
								[attr.stroke-width]="drawWidth()"
								[attr.stroke-opacity]="drawTool() === 'highlighter' ? 0.4 : 1"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					}
				</div>

				<!--
					Ruler strips: siblings to the scaled stage inside the wrapper div,
					absolutely positioned at top:0/left:0 within the wrapper's padding area.
					The wrapper's padding (RULER_THICKNESS px top+left) reserves space for
					these strips so the stage content starts below/right of them.
					pointer-events:none so they never intercept element gestures.
				-->
				@if (interactive() && showRulers()) {
					<!-- Corner square at the intersection of the two ruler strips -->
					<div class="pptx-ng-ruler-corner" aria-hidden="true"></div>

					<!-- Horizontal ruler: spans the top padding row of the wrapper -->
					<svg
						class="pptx-ng-ruler-h"
						aria-hidden="true"
						[attr.width]="canvasSize().width * effectiveScalePublic()"
						[attr.height]="20"
						[style.cursor]="editable() ? 'crosshair' : null"
						(pointerdown)="editable() ? onHRulerPointerDown($event) : null"
					>
						<rect
							[attr.width]="canvasSize().width * effectiveScalePublic()"
							height="20"
							fill="#1e293b"
						/>
						<line
							x1="0"
							y1="19.5"
							[attr.x2]="canvasSize().width * effectiveScalePublic()"
							y2="19.5"
							stroke="rgba(255,255,255,0.15)"
							stroke-width="1"
						/>
						@for (tick of hRulerTicks(); track tick.position) {
							<line
								[attr.x1]="tick.position"
								y1="20"
								[attr.x2]="tick.position"
								[attr.y2]="tick.isMajor ? 8 : 14"
								stroke="rgba(156,163,175,0.7)"
								[attr.stroke-width]="tick.isMajor ? 1 : 0.5"
							/>
							@if (tick.label) {
								<text
									[attr.x]="tick.position + 2"
									y="8"
									font-size="7"
									fill="rgba(156,163,175,0.9)"
									style="font-family:system-ui,sans-serif"
								>
									{{ tick.label }}"
								</text>
							}
						}
					</svg>

					<!-- Vertical ruler: spans the left padding column of the wrapper -->
					<svg
						class="pptx-ng-ruler-v"
						aria-hidden="true"
						[attr.width]="20"
						[attr.height]="canvasSize().height * effectiveScalePublic()"
						[style.cursor]="editable() ? 'crosshair' : null"
						(pointerdown)="editable() ? onVRulerPointerDown($event) : null"
					>
						<rect
							width="20"
							[attr.height]="canvasSize().height * effectiveScalePublic()"
							fill="#1e293b"
						/>
						<line
							x1="19.5"
							y1="0"
							x2="19.5"
							[attr.y2]="canvasSize().height * effectiveScalePublic()"
							stroke="rgba(255,255,255,0.15)"
							stroke-width="1"
						/>
						@for (tick of vRulerTicks(); track tick.position) {
							<line
								x1="20"
								[attr.y1]="tick.position"
								[attr.x2]="tick.isMajor ? 8 : 14"
								[attr.y2]="tick.position"
								stroke="rgba(156,163,175,0.7)"
								[attr.stroke-width]="tick.isMajor ? 1 : 0.5"
							/>
							@if (tick.label) {
								<text
									x="2"
									[attr.y]="tick.position + 9"
									font-size="7"
									fill="rgba(156,163,175,0.9)"
									style="font-family:system-ui,sans-serif"
								>
									{{ tick.label }}"
								</text>
							}
						}
					</svg>
				}
			</div>
		</div>
	`,
})
export class SlideCanvasComponent {
	readonly slide = input<PptxSlide | undefined>(undefined);
	readonly canvasSize = input.required<CanvasSize>();
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
	 * When true (default), the canvas + its elements expose the framework-neutral
	 * contract attributes (`data-pptx-viewport`, `aria-roledescription="slide"`,
	 * `data-pptx-element`). Thumbnail / preview / presentation instances pass
	 * `false` so only the main editing canvas exposes the contract (mirrors React,
	 * where thumbnails use a separate lightweight renderer). Prevents the shared
	 * e2e selectors from matching multiple elements.
	 */
	readonly interactive = input<boolean>(true);
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
	/** Emitted on right-click with the element under the cursor (or null). */
	readonly contextMenu = output<{ id: string | null; x: number; y: number }>();
	/** Emitted on double-click of a text-bearing element to begin inline edit. */
	readonly textEditStart = output<{ id: string }>();
	/** Emitted with the new text when an inline edit commits. */
	readonly textCommit = output<{ id: string; text: string }>();
	/** Emitted when an inline edit is cancelled (Escape). */
	readonly textCancel = output<void>();
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

	private drag: DragState | null = null;
	private editCancelled = false;
	/** Active guide-drag state (id + axis only), or null when nothing is being dragged. */
	private guideDrag: Pick<RulerGuide, 'id' | 'axis'> | null = null;
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
	/**
	 * User-created guide lines (dragged from rulers or added from toolbar).
	 * axis:'x' → vertical line at x=pos; axis:'y' → horizontal line at y=pos.
	 */
	readonly rulerGuides = signal<readonly RulerGuide[]>([]);

	// ── Ink drawing state ─────────────────────────────────────────────────────
	/** Accumulated points for the stroke currently being drawn. */
	private inkPoints: InkPoint[] = [];
	/** Whether a freehand stroke is in progress. Signal for template reactivity. */
	readonly inkActiveSignal = signal(false);
	/** SVG path `d` for the live stroke preview (updated on every pointer move). */
	readonly liveInkPath = signal<string>('');

	private readonly textEditor = viewChild<ElementRef<HTMLTextAreaElement>>('textEditor');
	private readonly stageRef = viewChild<ElementRef<HTMLElement>>('stage');
	private readonly viewportRef = viewChild<ElementRef<HTMLElement>>('viewport');

	/**
	 * Auto-fit scale (≤ 1): how much the fixed-size slide must shrink to fit the
	 * scroll viewport. The authored slide is e.g. 1280×720, which overflows a
	 * phone; without this it renders off-screen at `zoom=1`. Mirrors the React
	 * viewer's `fitScale * scale` model (useZoomViewport.ts) so "100%" means "fit
	 * to viewport". Measured from the viewport via ResizeObserver below.
	 */
	private readonly fitScale = signal(1);

	/**
	 * The on-screen scale used for ALL rendering and pointer→stage coordinate
	 * math: the user's zoom folded with the auto-fit. The parent keeps showing the
	 * raw user zoom as the percentage, so this stays internal to the canvas.
	 */
	private readonly effectiveScale = computed(() => this.fitScale() * this.zoom());

	/** The editing id we've already initialised the textarea for, to avoid re-seeding its value mid-edit. */
	private seededEditId: string | null = null;
	/** Last-tap timestamp + element id, for synthetic double-tap detection on touch. */
	private lastTap: { id: string; time: number } | null = null;

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

		// Re-fit whenever the authored slide size changes (e.g. switching decks).
		effect(() => {
			this.canvasSize();
			this.recomputeFit();
		});

		// Observe the viewport so the slide re-fits on container resize / rotation.
		const destroyRef = inject(DestroyRef);
		afterNextRender(() => {
			this.recomputeFit();
			const el = this.viewportRef()?.nativeElement;
			if (typeof ResizeObserver !== 'undefined' && el) {
				const observer = new ResizeObserver(() => this.recomputeFit());
				observer.observe(el);
				destroyRef.onDestroy(() => observer.disconnect());
			}
		});
	}

	/**
	 * Compute the largest scale (≤ 1) at which the whole slide fits the viewport,
	 * reserving the 1rem gutter + drop shadow. Sets fitScale to 1 when unmeasured.
	 */
	private recomputeFit(): void {
		// Thumbnail consumers manage their own scale via `zoom`; keep fit at 1 so
		// the two scales don't compound.
		if (!this.autoFit()) {
			this.fitScale.set(1);
			return;
		}
		const el = this.viewportRef()?.nativeElement;
		const size = this.canvasSize();
		if (!el || !size.width || !size.height) {
			this.fitScale.set(1);
			return;
		}
		const availW = Math.max(el.clientWidth - 16, 0);
		const availH = Math.max(el.clientHeight - 32, 0);
		if (!availW || !availH) {
			this.fitScale.set(1);
			return;
		}
		const fit = Math.min(availW / size.width, availH / size.height, 1);
		this.fitScale.set(fit > 0 ? fit : 1);
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
	readonly selectionBoxes = computed(() => {
		const selected = new Set(this.selectedIds());
		if (selected.size === 0) {
			return [];
		}
		return this.allElements()
			.filter((el) => selected.has(el.id))
			.map((el) => ({ id: el.id, x: el.x, y: el.y, width: el.width, height: el.height }));
	});

	/** The single selected element's box, or null when 0 or >1 are selected. */
	readonly singleSelected = computed<(Box & { id: string }) | null>(() => {
		const ids = this.selectedIds();
		if (ids.length !== 1) {
			return null;
		}
		const el = this.allElements().find((e) => e.id === ids[0]);
		return el ? { id: el.id, x: el.x, y: el.y, width: el.width, height: el.height } : null;
	});

	/** Resize-handle render boxes (stage coords) for the single selection. */
	readonly handleBoxes = computed(() => {
		if (!this.editable()) {
			return [];
		}
		const box = this.singleSelected();
		if (!box) {
			return [];
		}
		const size = HANDLE_SCREEN_PX / (this.effectiveScale() || 1);
		return RESIZE_HANDLES.map((handle) => {
			const { fx, fy } = handleAnchor(handle);
			return {
				handle,
				left: box.x + fx * box.width - size / 2,
				top: box.y + fy * box.height - size / 2,
				size,
				cursor: handleCursor(handle),
			};
		});
	});

	/** Rotation-handle box (stage coords) above the single selection, or null. */
	readonly rotateHandle = computed(() => {
		if (!this.editable()) {
			return null;
		}
		const box = this.singleSelected();
		if (!box) {
			return null;
		}
		const zoom = this.effectiveScale() || 1;
		const size = HANDLE_SCREEN_PX / zoom;
		const offset = 24 / zoom;
		return { left: box.x + box.width / 2 - size / 2, top: box.y - offset - size / 2, size };
	});

	/**
	 * Shape-adjustment-handle box (stage coords) for the single selection, or
	 * null. Sits just outside the top-left corner so it never collides with the
	 * resize/rotate handles. Selection-only + editable-only, so it vanishes in
	 * presentation alongside the rest of the edit chrome.
	 */
	readonly adjustHandle = computed(() => {
		if (!this.editable()) {
			return null;
		}
		const box = this.singleSelected();
		if (!box) {
			return null;
		}
		const zoom = this.effectiveScale() || 1;
		const size = HANDLE_SCREEN_PX / zoom;
		const offset = 16 / zoom;
		return { left: box.x - offset - size / 2, top: box.y - offset - size / 2, size };
	});

	/**
	 * Resolve the id of the interactive element under a pointer target, or null.
	 * An element host carries `data-element-id`, but template (master/layout)
	 * elements are only interactive while editTemplateMode is on; when off they
	 * are reported as null so the canvas treats them as background (no
	 * select/drag/context-menu/inline-edit).
	 */
	private interactiveElementIdAt(target: EventTarget | null): string | null {
		const host = (target as HTMLElement | null)?.closest('[data-element-id]') as HTMLElement | null;
		const id = host?.getAttribute('data-element-id');
		if (!id) {
			return null;
		}
		const el = this.allElements().find((e) => e.id === id);
		if (!el) {
			return null;
		}
		return isElementInteractive(el, true, this.editTemplateMode()) ? id : null;
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
		if (this.drawTool() !== 'select') {
			const stage = this.stageRef()?.nativeElement;
			if (!stage) {
				return;
			}
			const rect = stage.getBoundingClientRect();
			const zoom = this.effectiveScale() || 1;
			const pt: InkPoint = {
				x: (event.clientX - rect.left) / zoom,
				y: (event.clientY - rect.top) / zoom,
			};

			if (this.drawTool() === 'eraser') {
				// Find ink elements whose bounding box (+ 15px hit radius) contains
				// the pointer. Iterate in reverse so the topmost element wins.
				const HIT_RADIUS = 15;
				const allElements = this.elements();
				for (let i = allElements.length - 1; i >= 0; i--) {
					const el = allElements[i];
					if (el.type !== 'ink') {
						continue;
					}
					if (
						pt.x >= el.x - HIT_RADIUS &&
						pt.x <= el.x + el.width + HIT_RADIUS &&
						pt.y >= el.y - HIT_RADIUS &&
						pt.y <= el.y + el.height + HIT_RADIUS
					) {
						this.eraserHit.emit(el.id);
						break;
					}
				}
				return;
			}

			// pen / highlighter / freeform: begin stroke
			event.preventDefault();
			(event.target as Element | null)?.setPointerCapture?.(event.pointerId);
			this.inkPoints = [pt];
			this.inkActiveSignal.set(true);
			this.liveInkPath.set(pointsToSvgPathD(this.inkPoints));
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
				this.textEditStart.emit({ id });
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
		const el = this.allElements().find((e) => e.id === id);
		if (!el) {
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

	onDblClick(event: MouseEvent): void {
		if (!this.editable()) {
			return;
		}
		const id = this.interactiveElementIdAt(event.target);
		if (id) {
			event.preventDefault();
			this.textEditStart.emit({ id });
		}
	}

	onEditorKeydown(event: KeyboardEvent): void {
		const editor = event.target as HTMLTextAreaElement;
		if (event.key === 'Escape') {
			event.preventDefault();
			this.editCancelled = true;
			editor.blur();
		} else if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			editor.blur();
		}
	}

	commitText(event: Event, id: string): void {
		if (this.editCancelled) {
			this.editCancelled = false;
			this.textCancel.emit();
			return;
		}
		const editor = event.target as HTMLTextAreaElement;
		this.textCommit.emit({ id, text: editor.value });
	}

	onContextMenu(event: MouseEvent): void {
		if (!this.editable()) {
			return;
		}
		event.preventDefault();
		const id = this.interactiveElementIdAt(event.target);
		this.contextMenu.emit({ id, x: event.clientX, y: event.clientY });
	}

	onHandlePointerDown(event: PointerEvent, handle: ResizeHandle): void {
		event.stopPropagation();
		(event.target as Element | null)?.setPointerCapture?.(event.pointerId);
		const box = this.singleSelected();
		if (!box) {
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
		if (!box || !stage) {
			return;
		}
		const el = this.allElements().find((e) => e.id === box.id);
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

	@HostListener('document:pointermove', ['$event'])
	onPointerMove(event: PointerEvent): void {
		// ── GUIDE DRAG ────────────────────────────────────────────────────────
		if (this.guideDrag) {
			const stage = this.stageRef()?.nativeElement;
			if (stage) {
				const rect = stage.getBoundingClientRect();
				const z = this.effectiveScale() || 1;
				const guides = this.rulerGuides();
				const { id, axis } = this.guideDrag;
				const rawPos =
					axis === 'x' ? (event.clientX - rect.left) / z : (event.clientY - rect.top) / z;
				const clampMax = axis === 'x' ? this.canvasSize().width : this.canvasSize().height;
				const pos = Math.max(0, Math.min(clampMax, rawPos));
				this.rulerGuides.set(guides.map((g) => (g.id === id ? { ...g, pos } : g)));
			}
			return;
		}
		// ── END GUIDE DRAG ────────────────────────────────────────────────────

		// ── DRAW BRANCH ───────────────────────────────────────────────────────
		// When a stroke is in progress, consume all pointer-move events for drawing.
		if (this.inkActiveSignal()) {
			const stage = this.stageRef()?.nativeElement;
			if (!stage) {
				return;
			}
			const rect = stage.getBoundingClientRect();
			const zoom = this.effectiveScale() || 1;
			const pt: InkPoint = {
				x: (event.clientX - rect.left) / zoom,
				y: (event.clientY - rect.top) / zoom,
			};
			this.inkPoints.push(pt);
			this.liveInkPath.set(pointsToSvgPathD(this.inkPoints));
			return;
		}
		// ── END DRAW BRANCH ───────────────────────────────────────────────────

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
		const zoom = this.effectiveScale() || 1;

		if (!drag.started) {
			if (
				Math.abs(event.clientX - drag.startX) < DRAG_THRESHOLD &&
				Math.abs(event.clientY - drag.startY) < DRAG_THRESHOLD
			) {
				return;
			}
			drag.started = true;
			const label = drag.mode === 'move' ? 'Move' : drag.mode === 'resize' ? 'Resize' : 'Rotate';
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
			const snap = computeSnap(box, others, SNAP_SCREEN_PX / zoom);
			box = { ...box, x: snap.x, y: snap.y };
			this.snapGuides.set(snap.guides);

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
				const guides = this.rulerGuides();
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
		if (this.guideDrag) {
			this.guideDrag = null;
			return;
		}
		// ── END GUIDE DRAG ────────────────────────────────────────────────────

		// ── DRAW BRANCH ───────────────────────────────────────────────────────
		// Finalise the stroke and emit the completed ink element.
		if (this.inkActiveSignal()) {
			this.inkActiveSignal.set(false);
			const tool = this.drawTool();
			const resolvedTool: 'pen' | 'highlighter' | 'freeform' =
				tool === 'highlighter' ? 'highlighter' : tool === 'freeform' ? 'freeform' : 'pen';
			const ink = strokeToInkElement({
				points: this.inkPoints,
				color: this.drawColor(),
				width: this.drawWidth(),
				tool: resolvedTool,
			});
			if (ink) {
				this.inkStrokeComplete.emit(ink);
			}
			this.inkPoints = [];
			this.liveInkPath.set('');
			return;
		}
		// ── END DRAW BRANCH ───────────────────────────────────────────────────

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
		this.drag = null;
		this.snapGuides.set([]);
	}

	/** Begin dragging an existing guide. Called from the guide handle pointerdown. */
	onGuidePointerDown(event: PointerEvent, id: string, axis: RulerGuide['axis']): void {
		event.stopPropagation();
		(event.target as Element | null)?.setPointerCapture?.(event.pointerId);
		this.guideDrag = { id, axis };
	}

	/** Remove a guide (called on guide handle double-click). */
	onGuideDoubleClick(event: MouseEvent, id: string): void {
		event.stopPropagation();
		this.rulerGuides.update((gs: readonly RulerGuide[]) =>
			gs.filter((g: RulerGuide) => g.id !== id),
		);
	}

	/** Drag from the horizontal ruler to create a new horizontal guide (axis:'y'). */
	onHRulerPointerDown(event: PointerEvent): void {
		if (!this.editable()) {
			return;
		}
		const stage = this.stageRef()?.nativeElement;
		if (!stage) {
			return;
		}
		event.preventDefault();
		(event.target as Element | null)?.setPointerCapture?.(event.pointerId);
		const rect = stage.getBoundingClientRect();
		const z = this.effectiveScale() || 1;
		const pos = (event.clientY - rect.top) / z;
		const id = `guide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
		this.rulerGuides.update((gs: readonly RulerGuide[]) => [
			...gs,
			{ id, axis: 'y' as const, pos: Math.max(0, pos) },
		]);
		this.guideDrag = { id, axis: 'y' };
	}

	/** Drag from the vertical ruler to create a new vertical guide (axis:'x'). */
	onVRulerPointerDown(event: PointerEvent): void {
		if (!this.editable()) {
			return;
		}
		const stage = this.stageRef()?.nativeElement;
		if (!stage) {
			return;
		}
		event.preventDefault();
		(event.target as Element | null)?.setPointerCapture?.(event.pointerId);
		const rect = stage.getBoundingClientRect();
		const z = this.effectiveScale() || 1;
		const pos = (event.clientX - rect.left) / z;
		const id = `guide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
		this.rulerGuides.update((gs: readonly RulerGuide[]) => [
			...gs,
			{ id, axis: 'x' as const, pos: Math.max(0, pos) },
		]);
		this.guideDrag = { id, axis: 'x' };
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

	/** Grid dot spacing (slide-local px, 8 px = matches React GRID_SIZE). */
	readonly gridSpacingPx = computed(() => 8);

	/**
	 * SVG dot-grid pattern id: unique per instance so multiple canvases on the
	 * same page do not share the same `<pattern>` definition.
	 */
	protected readonly gridPatternId = `pptx-ng-grid-${Math.random().toString(36).slice(2, 8)}`;

	/** Tick marks for the horizontal ruler strip (scaled slide width). */
	readonly hRulerTicks = computed<ReadonlyArray<RulerTick>>(() => {
		if (!this.interactive() || !this.showRulers()) {
			return [];
		}
		return generateRulerTicks(this.canvasSize().width, this.effectiveScale());
	});

	/** Tick marks for the vertical ruler strip (scaled slide height). */
	readonly vRulerTicks = computed<ReadonlyArray<RulerTick>>(() => {
		if (!this.interactive() || !this.showRulers()) {
			return [];
		}
		return generateRulerTicks(this.canvasSize().height, this.effectiveScale());
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
			// Resolved slide background: image → gradient → pattern → solid colour.
			...getSlideBackgroundStyle(slide),
		};
		return style;
	});
}
