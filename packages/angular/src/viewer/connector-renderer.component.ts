import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';

import { buildConnectorGeometry } from './connector-path';
import type { MarkerShape } from './connector-path';

/**
 * ConnectorRendererComponent — Angular port of the Vue `ConnectorRenderer.vue`
 * (and the React `ConnectorElementRenderer`, basic subset).
 *
 * Renders straight connectors/lines as an inline SVG spanning the element's
 * bounding box, with stroke colour/width/dash and start/end arrowheads. Flip
 * is baked into the endpoints (not a CSS transform) so arrowheads point the
 * right way.
 *
 * All path/style math lives in `connector-path.ts` (pure TS, no Angular
 * dependency) so it can be unit-tested without TestBed.
 *
 * Not yet ported (TODO, see PORTING.md): bent/curved connector routing
 * (`getConnectorPathGeometry`), compound lines, connector text overlay, line
 * shadows/glow. Bent/curved connectors currently fall back to a straight line.
 */
@Component({
	selector: 'pptx-connector-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [],
	template: `
		<div
			class="pptx-ng-element pptx-ng-connector"
			[style]="geo().wrapperStyle"
			[attr.data-element-id]="element().id"
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
			</svg>
		</div>
	`,
})
export class ConnectorRendererComponent {
	readonly element = input.required<PptxElement>();
	readonly zIndex = input<number>(0);

	/** All derived geometry, recomputed on every input change. */
	readonly geo = computed(() => buildConnectorGeometry(this.element(), this.zIndex()));

	readonly viewBox = computed(() => `0 0 ${this.geo().svgW} ${this.geo().svgH}`);
}

// Re-export the MarkerShape type so consumers can reference it if needed.
export type { MarkerShape };
