import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { hasShapeProperties } from 'pptx-viewer-core';
import type { PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';

import { getLineGlowFilterCss, getLineShadowParams } from '../internal/shared';
import type { ElementAnimationState } from '../internal/shared';
import { buildConnectorGeometry } from './connector-path';
import type { MarkerShape } from './connector-path';
import type { Rect } from './connector-routing';
import { ConnectorTextOverlayComponent } from './connector-text-overlay.component';

/**
 * ConnectorRendererComponent: Angular port of the Vue `ConnectorRenderer.vue`
 * (and the React `ConnectorElementRenderer`, basic subset).
 *
 * Renders straight connectors/lines as an inline SVG spanning the element's
 * bounding box, with stroke colour/width/dash and start/end arrowheads. Flip
 * is baked into the endpoints (not a CSS transform) so arrowheads point the
 * right way.
 *
 * Renders straight (`<line>`), bent (elbow) and curved (Bézier) connectors via
 * `connector-path.ts`. When obstacle rects are supplied (`obstacles` input,
 * absolute slide coords), bent connectors are routed around them with an A*
 * orthogonal router. A connector's optional text label is painted on top via
 * `ConnectorTextOverlayComponent`.
 *
 * All path/style math lives in `connector-path.ts` / `connector-routing.ts`
 * (pure TS, no Angular dependency) so it can be unit-tested without TestBed.
 * Compound (double/triple) lines render as parallel strands and line caps map
 * from `a:ln/@cap`; both derive from the shared connector geometry.
 *
 * Line shadows use an SVG drop-shadow filter and line glow uses the shared
 * CSS filter builder, matching the other framework bindings.
 */
@Component({
	selector: 'pptx-connector-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ConnectorTextOverlayComponent],
	template: `
		<div
			class="pptx-ng-element pptx-ng-connector"
			[style]="wrapperStyle()"
			[attr.data-element-id]="elementIdAttr()"
			[attr.data-pptx-element]="interactive() || marked() ? 'true' : null"
		>
			<svg
				[attr.width]="geo().svgW"
				[attr.height]="geo().svgH"
				[attr.viewBox]="viewBox()"
				style="overflow: visible; display: block"
			>
				<defs>
					@if (geo().startMarker) {
						<marker
							[attr.id]="geo().startMarkerId"
							viewBox="0 0 10 10"
							refX="5"
							refY="5"
							[attr.markerWidth]="geo().startMarker!.markerWidth"
							[attr.markerHeight]="geo().startMarker!.markerHeight"
							orient="auto-start-reverse"
							markerUnits="strokeWidth"
						>
							@if (geo().startMarker!.shape === 'circle') {
								<circle cx="5" cy="5" r="4" [attr.fill]="strokeColor()" />
							} @else {
								<path [attr.d]="geo().startMarker!.d" [attr.fill]="strokeColor()" />
							}
						</marker>
					}
					@if (geo().endMarker) {
						<marker
							[attr.id]="geo().endMarkerId"
							viewBox="0 0 10 10"
							refX="5"
							refY="5"
							[attr.markerWidth]="geo().endMarker!.markerWidth"
							[attr.markerHeight]="geo().endMarker!.markerHeight"
							orient="auto-start-reverse"
							markerUnits="strokeWidth"
						>
							@if (geo().endMarker!.shape === 'circle') {
								<circle cx="5" cy="5" r="4" [attr.fill]="strokeColor()" />
							} @else {
								<path [attr.d]="geo().endMarker!.d" [attr.fill]="strokeColor()" />
							}
						</marker>
					}
					@if (lineShadow(); as shadow) {
						<filter [attr.id]="shadowFilterId()" x="-50%" y="-50%" width="200%" height="200%">
							<feDropShadow
								[attr.dx]="shadow.offsetX"
								[attr.dy]="shadow.offsetY"
								[attr.stdDeviation]="shadow.blur / 2"
								[attr.flood-color]="shadow.color"
								[attr.flood-opacity]="shadow.opacity"
							/>
						</filter>
					}
				</defs>
				<!--
					The only pointer-reachable part of a connector: a transparent stroke
					along the line that opts back into hit testing. The wrapper is
					pointer-events:none so a connector's mostly-empty bounding box never
					swallows clicks meant for the shapes it spans, which left the line
					itself unclickable until this path existed.
				-->
				<path
					class="pptx-ng-connector-hit"
					[attr.d]="geo().hitPathD"
					fill="none"
					stroke="transparent"
					[attr.stroke-width]="geo().hitStrokeWidth"
					stroke-linecap="round"
					stroke-linejoin="round"
					style="pointer-events: stroke"
				/>
				@for (strand of strands(); track strand.key) {
					@if (geo().pathD) {
						<path
							[attr.d]="geo().pathD"
							fill="none"
							[attr.stroke]="strokeColor()"
							[attr.stroke-width]="strand.width"
							[attr.stroke-opacity]="geo().strokeOpacity"
							[attr.stroke-dasharray]="geo().dashArray ?? null"
							[attr.stroke-linecap]="geo().strokeLinecap"
							stroke-linejoin="round"
							[attr.transform]="strand.transform"
							[attr.filter]="strand.shadowFilter"
							[attr.marker-start]="strand.markerStart"
							[attr.marker-end]="strand.markerEnd"
						/>
					} @else {
						<line
							[attr.x1]="geo().x1"
							[attr.y1]="geo().y1"
							[attr.x2]="geo().x2"
							[attr.y2]="geo().y2"
							[attr.stroke]="strokeColor()"
							[attr.stroke-width]="strand.width"
							[attr.stroke-opacity]="geo().strokeOpacity"
							[attr.stroke-dasharray]="geo().dashArray ?? null"
							[attr.stroke-linecap]="geo().strokeLinecap"
							[attr.transform]="strand.transform"
							[attr.filter]="strand.shadowFilter"
							[attr.marker-start]="strand.markerStart"
							[attr.marker-end]="strand.markerEnd"
						/>
					}
				}
			</svg>
			<pptx-connector-text-overlay
				[text]="connectorText()"
				[segments]="connectorSegments()"
				[textStyle]="connectorTextStyle()"
			/>
		</div>
	`,
})
export class ConnectorRendererComponent {
	readonly element = input.required<PptxElement>();
	readonly zIndex = input<number>(0);
	/** Obstacle rects (absolute slide coords) for A* routing of bent connectors. */
	readonly obstacles = input<readonly Rect[]>([]);
	readonly canvasWidth = input<number>(0);
	readonly canvasHeight = input<number>(0);
	/** See ElementRenderer.interactive: gates the data-pptx-element contract attr. */
	readonly interactive = input<boolean>(true);
	/** Keep the data-pptx-element marker on interaction-locked template elements. */
	readonly marked = input<boolean>(false);
	/**
	 * When true (default), the rendered node carries `data-element-id`. The
	 * miniature surfaces that paint every slide at once turn it off so one
	 * element id resolves to exactly one node in the document; see
	 * `ElementRendererComponent.exposeElementId`.
	 */
	readonly exposeElementId = input<boolean>(true);

	/** `data-element-id` for this element, or null on a miniature surface. */
	readonly elementIdAttr = computed<string | null>(() =>
		this.exposeElementId() ? this.element().id : null,
	);

	/**
	 * Native-animation playback state. When an active `p:animClr` colour animation
	 * targets the stroke (`animatesStroke`), the SVG stroke + arrowheads paint
	 * `inherit` so the wrapper's animated `stroke` keyframes cascade in. Absent
	 * outside a running presentation.
	 */
	readonly animationState = input<ElementAnimationState | undefined>(undefined);

	/** All derived geometry, recomputed on every input change. */
	readonly geo = computed(() => {
		const obstacles = this.obstacles();
		const routing =
			obstacles.length > 0
				? { obstacles, canvasWidth: this.canvasWidth(), canvasHeight: this.canvasHeight() }
				: undefined;
		return buildConnectorGeometry(this.element(), this.zIndex(), routing);
	});

	readonly viewBox = computed(() => `0 0 ${this.geo().svgW} ${this.geo().svgH}`);
	/**
	 * Stroke paint for the line + arrowheads: `inherit` while a `p:animClr` stroke
	 * colour animation is active (so the wrapper keyframes own it), else the
	 * geometry's resolved stroke colour.
	 */
	readonly strokeColor = computed(() =>
		this.animationState()?.animatesStroke ? 'inherit' : this.geo().strokeColor,
	);
	private readonly shapeStyle = computed(() => {
		const element = this.element();
		return hasShapeProperties(element) ? element.shapeStyle : undefined;
	});
	readonly lineShadow = computed(() => getLineShadowParams(this.shapeStyle()));
	readonly lineGlow = computed(() => getLineGlowFilterCss(this.shapeStyle()));
	readonly shadowFilterId = computed(
		() => `${this.geo().startMarkerId.replace(/-start$/u, '')}-line-shadow`,
	);
	readonly wrapperStyle = computed(() => {
		const glow = this.lineGlow();
		return glow ? `${this.geo().wrapperStyle};filter:${glow}` : this.geo().wrapperStyle;
	});

	/**
	 * Parallel strokes for compound (double/triple) line styles. A single line
	 * yields one strand at offset 0. Each strand carries its own width and is
	 * translated perpendicular to the line; only the first strand paints the
	 * start marker and only the last paints the end marker.
	 */
	readonly strands = computed<ConnectorStrand[]>(() => {
		const g = this.geo();
		const offsets = g.compoundOffsets;
		const last = offsets.length - 1;
		return offsets.map((offset, idx) => ({
			key: idx,
			width: Math.max(g.compoundWidths[idx] ?? g.strokeWidth, 1),
			transform: offset !== 0 ? `translate(0 ${offset})` : null,
			shadowFilter: idx === 0 && this.lineShadow() ? `url(#${this.shadowFilterId()})` : null,
			markerStart: idx === 0 ? g.startMarkerRef : null,
			markerEnd: idx === last ? g.endMarkerRef : null,
		}));
	});

	// Connectors carry an optional text label (PptxTextProperties). Narrow the
	// union once here so the template can bind the overlay inputs.
	private readonly textProps = computed(
		() => this.element() as { text?: string; textSegments?: TextSegment[]; textStyle?: TextStyle },
	);
	readonly connectorText = computed(() => this.textProps().text);
	readonly connectorSegments = computed(() => this.textProps().textSegments);
	readonly connectorTextStyle = computed(() => this.textProps().textStyle);
}

/** One parallel stroke of a (possibly compound) connector line. */
interface ConnectorStrand {
	key: number;
	width: number;
	transform: string | null;
	shadowFilter: string | null;
	markerStart: string | null;
	markerEnd: string | null;
}

// Re-export the MarkerShape type so consumers can reference it if needed.
export type { MarkerShape };
