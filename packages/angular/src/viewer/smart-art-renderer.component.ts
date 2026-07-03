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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { PptxElement } from 'pptx-viewer-core';
import { setSmartArtNodeStyle } from 'pptx-viewer-core';

import {
	buildSmartArtA11y,
	computeInlineEditorRect,
	computeSmartArtLayout,
	flattenNodes,
	resolveDrawingShapeNodeId,
} from '../internal/shared';
import type {
	InlineEditRect,
	RenderedNode,
	SmartArtA11y,
	SmartArtLayoutResult,
} from '../internal/shared';
import { EditorStateService } from './editor-state.service';
import type { StyleMap } from './element-style';
import { getContainerStyle } from './element-style';
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
	findSlideIndexByElementId,
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
 */
@Component({
	selector: 'pptx-smart-art-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, TranslatePipe],
	template: `
		<div
			class="pptx-ng-element pptx-ng-smartart"
			[ngStyle]="containerStyle()"
			[attr.data-element-id]="element().id"
		>
			<div
				#smartartContainer
				class="pptx-ng-smartart-chrome"
				[ngStyle]="chromeStyle()"
				[attr.role]="a11y() ? a11y()!.role : null"
				[attr.aria-label]="a11y()?.label ?? null"
				(mousemove)="onMouseMove($event)"
				(mouseleave)="onMouseLeave()"
			>
				@if (isEmpty()) {
					<div class="pptx-ng-smartart-placeholder">
						{{ 'pptx.smartArt.placeholder' | translate }}
					</div>
				} @else if (hasDrawingShapes()) {
					<svg
						class="pptx-ng-smartart-svg"
						[attr.viewBox]="svgViewBox()"
						preserveAspectRatio="xMidYMid meet"
					>
						@for (shape of renderedShapes(); track shape.key; let i = $index) {
							<g
								[ngStyle]="shadowFilter() ? { filter: shadowFilter() } : {}"
								[attr.data-smartart-node-id]="drawingShapeNodeIds()[i] ?? null"
								[class.pptx-ng-smartart-node--editable]="
									canEditNodes() && !!drawingShapeNodeIds()[i]
								"
							>
								@if (shape.isEllipse) {
									<ellipse
										[attr.cx]="shape.cx"
										[attr.cy]="shape.cy"
										[attr.rx]="shape.width / 2"
										[attr.ry]="shape.height / 2"
										[attr.fill]="shape.fill"
										[attr.stroke]="shape.stroke"
										[attr.stroke-width]="shape.strokeWidth"
										[attr.transform]="shape.transform ?? null"
									/>
								} @else {
									<rect
										[attr.x]="shape.x"
										[attr.y]="shape.y"
										[attr.width]="shape.width"
										[attr.height]="shape.height"
										[attr.rx]="shape.rx"
										[attr.fill]="shape.fill"
										[attr.stroke]="shape.stroke"
										[attr.stroke-width]="shape.strokeWidth"
										[attr.transform]="shape.transform ?? null"
									/>
								}
								@if (shape.text) {
									<text
										[attr.x]="shape.textX"
										text-anchor="middle"
										dominant-baseline="central"
										[attr.fill]="shape.fontColor"
										[attr.font-size]="shape.fontSize"
									>
										@for (line of textLines(shape.text, shape.fontSize); track $index) {
											<tspan [attr.x]="shape.textX" [attr.y]="shape.textY + line.offsetY">
												{{ line.text }}
											</tspan>
										}
									</text>
								}
							</g>
						}
					</svg>
				} @else if (hasLayout()) {
					<svg
						class="pptx-ng-smartart-svg"
						[attr.viewBox]="layout().viewBox"
						preserveAspectRatio="xMidYMid meet"
						[attr.data-layout-family]="layout().family"
					>
						@for (conn of layout().connectors; track conn.key) {
							<path
								[attr.d]="conn.d"
								fill="none"
								stroke="#94a3b8"
								stroke-width="1.5"
								opacity="0.5"
							/>
						}
						@for (node of layout().nodes; track node.key) {
							<g
								[ngStyle]="shadowFilter() ? { filter: shadowFilter() } : {}"
								[class.pptx-ng-smartart-node--editable]="canEditNodes()"
								[attr.tabindex]="canEditNodes() ? 0 : null"
								[attr.role]="canEditNodes() ? 'button' : 'img'"
								[attr.aria-label]="nodeAriaLabel(node) ?? node.text"
								[attr.data-smartart-node-id]="nodeKeyId(node)"
								(dblclick)="onNodeDblClick($event, node)"
								(keydown)="onNodeKeydown($event, node)"
							>
								@if (nodeAriaLabel(node); as title) {
									<title>{{ title }}</title>
								}
								@if (asCircle(node); as c) {
									<circle
										[attr.cx]="c.cx"
										[attr.cy]="c.cy"
										[attr.r]="c.r"
										[attr.fill]="c.fill"
										[attr.stroke]="c.stroke"
										[attr.stroke-width]="c.strokeWidth"
										[attr.opacity]="c.opacity"
									/>
									<text
										[attr.x]="c.cx"
										text-anchor="middle"
										dominant-baseline="central"
										fill="white"
										[attr.font-size]="c.fontSize"
									>
										@for (line of textLines(c.text, c.fontSize); track $index) {
											<tspan [attr.x]="c.cx" [attr.y]="c.cy + line.offsetY">{{ line.text }}</tspan>
										}
									</text>
								} @else if (asPolygon(node); as p) {
									<polygon
										[attr.points]="p.points"
										[attr.fill]="p.fill"
										[attr.stroke]="p.stroke"
										[attr.stroke-width]="p.strokeWidth"
										[attr.opacity]="p.opacity"
									/>
									<text
										[attr.x]="p.textX"
										text-anchor="middle"
										dominant-baseline="central"
										fill="white"
										[attr.font-size]="p.fontSize"
									>
										@for (line of textLines(p.text, p.fontSize); track $index) {
											<tspan [attr.x]="p.textX" [attr.y]="p.textY + line.offsetY">
												{{ line.text }}
											</tspan>
										}
									</text>
								} @else if (asRect(node); as r) {
									<rect
										[attr.x]="r.x"
										[attr.y]="r.y"
										[attr.width]="r.width"
										[attr.height]="r.height"
										[attr.rx]="r.rx"
										[attr.fill]="r.fill"
										[attr.stroke]="r.stroke"
										[attr.stroke-width]="r.strokeWidth"
										[attr.opacity]="r.opacity"
									/>
									<text
										[attr.x]="r.textX"
										text-anchor="middle"
										dominant-baseline="central"
										fill="white"
										[attr.font-size]="r.fontSize"
									>
										@for (line of textLines(r.text, r.fontSize); track $index) {
											<tspan [attr.x]="r.textX" [attr.y]="r.textY + line.offsetY">
												{{ line.text }}
											</tspan>
										}
									</text>
								}
							</g>
						}
					</svg>
				} @else {
					<div class="pptx-ng-smartart-placeholder">
						{{ 'pptx.smartArt.placeholder' | translate }}
					</div>
				}

				@if (canEditNodes() && hoveredNodeId() && !editState() && styleBarStyle()) {
					<div
						class="pptx-ng-smartart-style-bar"
						[ngStyle]="styleBarStyle()!"
						(mousedown)="$event.stopPropagation()"
						(click)="$event.stopPropagation()"
					>
						@for (color of palette().slice(0, 6); track color) {
							<button
								type="button"
								class="pptx-ng-smartart-swatch"
								[attr.aria-label]="'pptx.smartArt.setFill' | translate: { color: color }"
								[style.background]="color"
								(click)="handleChangeNodeStyle(hoveredNodeId()!, color)"
							></button>
						}
					</div>
				}

				<!--
					Inline node-text editor. Positioned in element-local px (== viewBox
					units, since the SVG viewBox matches the element pixel size and the
					svg fills the chrome) over the double-clicked node. Commits via the
					shared EditorStateService.updateElement path on Enter / blur.
				-->
				@if (editState(); as edit) {
					<textarea
						#nodeEditor
						class="pptx-ng-smartart-node-editor"
						[style.left.px]="edit.box.x"
						[style.top.px]="edit.box.y"
						[style.width.px]="edit.box.width"
						[style.height.px]="edit.box.height"
						[value]="edit.text"
						(pointerdown)="$event.stopPropagation()"
						(mousedown)="$event.stopPropagation()"
						(click)="$event.stopPropagation()"
						(dblclick)="$event.stopPropagation()"
						(blur)="commitEdit($event)"
						(keydown)="onEditorKeydown($event)"
					></textarea>
				}

				<!-- Polite live region: announces node-text edit commits to AT. -->
				<span class="pptx-ng-sr-only" aria-live="polite" role="status">{{ liveMessage() }}</span>
			</div>
		</div>
	`,
	styles: `
		.pptx-ng-smartart-chrome {
			box-sizing: border-box;
			overflow: hidden;
			position: relative;
		}

		.pptx-ng-smartart-svg {
			width: 100%;
			height: 100%;
			pointer-events: none;
		}

		/* Editable nodes accept pointer + keyboard interaction for inline editing. */
		.pptx-ng-smartart-node--editable {
			pointer-events: auto;
			cursor: text;
		}

		/* Hover ring: outline does not render on SVG <g> elements in all browsers,
		   so drop-shadow is used as the visual confirmation that a node is editable. */
		.pptx-ng-smartart-node--editable:hover {
			filter: drop-shadow(0 0 2px rgba(96, 165, 250, 0.8));
		}

		.pptx-ng-smartart-node-editor {
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
			z-index: 2;
		}

		.pptx-ng-smartart-placeholder {
			width: 100%;
			height: 100%;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 11px;
			color: rgba(255, 255, 255, 0.8);
			pointer-events: none;
		}

		/* Visually hidden but available to assistive technology. */
		.pptx-ng-sr-only {
			position: absolute;
			width: 1px;
			height: 1px;
			padding: 0;
			margin: -1px;
			overflow: hidden;
			clip: rect(0, 0, 0, 0);
			white-space: nowrap;
			border: 0;
		}

		.pptx-ng-smartart-style-bar {
			position: absolute;
			pointer-events: auto;
		}

		.pptx-ng-smartart-swatch {
			width: 14px;
			height: 14px;
			border-radius: 50%;
			border: 1px solid rgba(0, 0, 0, 0.1);
			cursor: pointer;
			transition: transform 0.1s;
		}

		.pptx-ng-smartart-swatch:hover {
			transform: scale(1.25);
		}
	`,
})
export class SmartArtRendererComponent {
	/** The smartArt element to render. Must be `type === 'smartArt'`. */
	readonly element = input.required<PptxElement>();
	readonly zIndex = input<number>(0);

	/**
	 * Whether inline on-canvas node-text editing is enabled. False in
	 * presentation / read-only / thumbnail contexts (mirrors the table renderer's
	 * `editable` input). Double-clicking a node only enters edit mode when true.
	 */
	readonly editable = input<boolean>(false);

	/**
	 * The editor state layer. Optional: the renderer is also used outside the
	 * editing viewer (thumbnails, export), where this service is not provided.
	 * Inline editing commits through `updateElement` here, the exact channel the
	 * inspector's SmartArt panel uses, so undo/redo + save round-trip are shared.
	 */
	private readonly editor = inject(EditorStateService, { optional: true });
	private readonly injector = inject(Injector);
	private readonly translate = inject(TranslateService);

	/** The node currently being edited on the canvas, or null. */
	protected readonly editState = signal<InlineEditState | null>(null);

	/** The mounted `<textarea>` for the active node edit, if any. */
	private readonly nodeEditor = viewChild<ElementRef<HTMLTextAreaElement>>('nodeEditor');

	/** Container div ref used to project hover rects into local coordinates. */
	private readonly smartartContainer = viewChild<ElementRef>('smartartContainer');

	/**
	 * Guards against a cancel-triggered DOM-removal blur committing the edit.
	 * Set to true before programmatic cancellation; reset to false on each new edit.
	 */
	private editSettled = false;

	/** Whether node double-click / Enter enters inline edit (editable + has editor). */
	readonly canEditNodes = computed(() => this.editable() && this.editor !== null);

	constructor() {
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

	readonly containerStyle = computed<StyleMap>(() =>
		getContainerStyle(this.element(), this.zIndex()),
	);

	readonly chromeStyle = computed<StyleMap>(() => buildChromeStyle(this.smartArtData()?.chrome));

	readonly palette = computed<string[]>(() => resolvePalette(this.smartArtData()));

	readonly artStyle = computed(() => this.smartArtData()?.style ?? 'flat');

	readonly nodes = computed(() => this.smartArtData()?.nodes ?? []);

	readonly shadowFilter = computed<string | undefined>(() => styleShadowFilter(this.artStyle()));

	private readonly rawDrawingShapes = computed(() => this.smartArtData()?.drawingShapes ?? []);

	readonly hasDrawingShapes = computed(() => this.rawDrawingShapes().length > 0);

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
			this.rawDrawingShapes(),
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
			this.nodes(),
			{ width: Math.max(el.width, 1), height: Math.max(el.height, 1) },
			this.palette(),
			this.artStyle(),
			el.id,
			data?.resolvedLayoutType,
			data?.layout,
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
		const slideIndex = findSlideIndexByElementId(editor.slides(), this.element().id);
		if (slideIndex < 0) {
			return;
		}
		editor.updateElement(slideIndex, this.element().id, {
			smartArtData: next,
		} as Partial<PptxElement>);
		// Announce the commit to assistive technology via the polite live region.
		this.liveMessage.set(
			text.trim().length > 0
				? this.translate.instant('pptx.smartart.nodeUpdated', { text: text.trim() })
				: this.translate.instant('pptx.smartart.nodeCleared'),
		);
	}

	// ── Style bar & hover tracking ────────────────────────────────────────

	protected readonly styleBarStyle = computed<Record<string, string> | null>(() => {
		const rect = this.hoveredNodeRect();
		if (!rect) {
			return null;
		}
		return {
			position: 'absolute',
			left: `${Math.max(0, rect.left + rect.width - 120)}px`,
			top: `${Math.max(0, rect.top - 22)}px`,
			'z-index': '25',
		};
	});

	protected onMouseMove(event: MouseEvent): void {
		if (!this.canEditNodes()) {
			return;
		}
		const nodeEl = this.findNodeEl(event.target as EventTarget);
		const cnt = this.smartartContainer()?.nativeElement as HTMLElement | undefined;
		const id = nodeEl?.getAttribute('data-smartart-node-id') ?? null;
		this.hoveredNodeId.set(id);
		this.hoveredNodeRect.set(
			id && nodeEl && cnt
				? computeInlineEditorRect(nodeEl.getBoundingClientRect(), cnt.getBoundingClientRect())
				: null,
		);
	}

	protected onMouseLeave(): void {
		this.hoveredNodeId.set(null);
		this.hoveredNodeRect.set(null);
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
		const slideIndex = findSlideIndexByElementId(this.editor.slides(), this.element().id);
		if (slideIndex < 0) {
			return;
		}
		this.editor.updateElement(slideIndex, this.element().id, {
			smartArtData: next,
		} as Partial<PptxElement>);
	}

	// ── Empty / no-data state ──────────────────────────────────────────────

	readonly isEmpty = computed(() => this.nodes().length === 0 && !this.hasDrawingShapes());
}

// Re-export helper types used in the template so template type-checking works.
export type { DrawingViewBox, RenderedShape };
