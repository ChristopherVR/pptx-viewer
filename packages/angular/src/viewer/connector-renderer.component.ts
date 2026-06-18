import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';

import { buildConnectorGeometry } from './connector-path';
import type { MarkerShape } from './connector-path';
import type { Rect } from './connector-routing';
import { ConnectorTextOverlayComponent } from './connector-text-overlay.component';

/**
 * ConnectorRendererComponent — Angular port of the Vue `ConnectorRenderer.vue`
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
 *
 * Not yet ported (TODO, see PORTING.md): compound (double/triple) lines, line
 * shadows/glow.
 */
@Component({
	selector: 'pptx-connector-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ConnectorTextOverlayComponent],
	template: `
		<div
			class="pptx-ng-element pptx-ng-connector"
			[style]="geo().wrapperStyle"
			[attr.data-element-id]="element().id"
			[attr.data-pptx-element]="interactive() ? 'true' : null"
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
							markerWidth="4"
							markerHeight="4"
							orient="auto-start-reverse"
							markerUnits="strokeWidth"
						>
							@if (geo().startMarker!.shape === 'circle') {
								<circle cx="5" cy="5" r="4" [attr.fill]="geo().strokeColor" />
							} @else {
								<path [attr.d]="geo().startMarker!.d" [attr.fill]="geo().strokeColor" />
							}
						</marker>
					}
					@if (geo().endMarker) {
						<marker
							[attr.id]="geo().endMarkerId"
							viewBox="0 0 10 10"
							refX="5"
							refY="5"
							markerWidth="4"
							markerHeight="4"
							orient="auto-start-reverse"
							markerUnits="strokeWidth"
						>
							@if (geo().endMarker!.shape === 'circle') {
								<circle cx="5" cy="5" r="4" [attr.fill]="geo().strokeColor" />
							} @else {
								<path [attr.d]="geo().endMarker!.d" [attr.fill]="geo().strokeColor" />
							}
						</marker>
					}
				</defs>
				@if (geo().pathD) {
					<path
						[attr.d]="geo().pathD"
						fill="none"
						[attr.stroke]="geo().strokeColor"
						[attr.stroke-width]="geo().strokeWidth"
						[attr.stroke-opacity]="geo().strokeOpacity"
						[attr.stroke-dasharray]="geo().dashArray ?? null"
						stroke-linecap="round"
						stroke-linejoin="round"
						[attr.marker-start]="geo().startMarkerRef"
						[attr.marker-end]="geo().endMarkerRef"
					/>
				} @else {
					<line
						[attr.x1]="geo().x1"
						[attr.y1]="geo().y1"
						[attr.x2]="geo().x2"
						[attr.y2]="geo().y2"
						[attr.stroke]="geo().strokeColor"
						[attr.stroke-width]="geo().strokeWidth"
						[attr.stroke-opacity]="geo().strokeOpacity"
						[attr.stroke-dasharray]="geo().dashArray ?? null"
						stroke-linecap="round"
						[attr.marker-start]="geo().startMarkerRef"
						[attr.marker-end]="geo().endMarkerRef"
					/>
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
	/** See ElementRenderer.interactive — gates the data-pptx-element contract attr. */
	readonly interactive = input<boolean>(true);

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

	// Connectors carry an optional text label (PptxTextProperties). Narrow the
	// union once here so the template can bind the overlay inputs.
	private readonly textProps = computed(
		() => this.element() as { text?: string; textSegments?: TextSegment[]; textStyle?: TextStyle },
	);
	readonly connectorText = computed(() => this.textProps().text);
	readonly connectorSegments = computed(() => this.textProps().textSegments);
	readonly connectorTextStyle = computed(() => this.textProps().textStyle);
}

// Re-export the MarkerShape type so consumers can reference it if needed.
export type { MarkerShape };
