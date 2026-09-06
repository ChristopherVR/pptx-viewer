import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';
import { isInkElement } from 'pptx-viewer-core';

import {
	getInkReplayStyles,
	INK_REPLAY_KEYFRAMES,
} from '../internal/shared-src/render/ink-rendering';
import type { StyleMap } from './element-style';
import { buildInkContainerStyle, buildInkStrokes, inkViewBox } from './ink-renderer-helpers';
import type { InkStroke } from './ink-renderer-helpers';

/**
 * InkRendererComponent: Angular port of the Vue `InkRenderer.vue`
 * (and the React `renderInk` inside `InkGroupRenderers.tsx`), viewer-first
 * subset.
 *
 * Renders freehand ink strokes (`InkPptxElement.inkPaths`) as inline SVG
 * `<path>` elements inside the element's bounding box, with per-stroke colour,
 * width, and opacity resolved from the parallel `inkColors`/`inkWidths`/
 * `inkOpacities` arrays.
 *
 * Pressure-sensitive variable-width strokes (`inkPointPressures`, or a varying
 * `inkWidths` array) are rendered as a set of filled `<circle>` elements whose
 * radii follow the per-point pressure, matching React's `renderInk`. Strokes
 * without pressure variation degrade to a plain constant-width `<path>`.
 *
 * Presentation mode progressively replays constant-width paths using the
 * shared dash-offset timing model. Pressure circles remain static because SVG
 * dash replay only applies to paths.
 *
 * All non-trivial pure computation lives in `ink-renderer-helpers.ts` (no
 * Angular dependency) so it can be unit-tested without TestBed.
 */
@Component({
	selector: 'pptx-ink-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle],
	template: `
		<div
			class="pptx-ng-element pptx-ng-ink"
			[ngStyle]="containerStyle()"
			[attr.data-element-id]="elementIdAttr()"
			[attr.data-pptx-element]="markElement() ? 'true' : null"
		>
			@if (strokes().length > 0) {
				<svg
					class="pptx-ng-ink-svg"
					[attr.viewBox]="viewBox()"
					preserveAspectRatio="none"
					style="width:100%;height:100%;pointer-events:none;display:block"
				>
					@if (replay()) {
						<style [textContent]="replayKeyframes"></style>
					}
					@for (stroke of strokes(); track $index) {
						@if (stroke.nibMarks && stroke.nibMarks.length > 0) {
							<g [attr.opacity]="stroke.opacity">
								@for (m of stroke.nibMarks; track $index) {
									<ellipse
										[attr.cx]="m.cx"
										[attr.cy]="m.cy"
										[attr.rx]="m.rPerp"
										[attr.ry]="m.rTilt"
										[attr.transform]="'rotate(' + m.rotationDeg + ' ' + m.cx + ' ' + m.cy + ')'"
										[attr.fill]="stroke.color"
									/>
								}
							</g>
						} @else if (stroke.circles && stroke.circles.length > 0) {
							<g [attr.opacity]="stroke.opacity">
								@for (c of stroke.circles; track $index) {
									<circle
										[attr.cx]="c.cx"
										[attr.cy]="c.cy"
										[attr.r]="c.r"
										[attr.fill]="stroke.color"
									/>
								}
							</g>
						} @else {
							<path
								[attr.d]="stroke.d"
								fill="none"
								[attr.stroke]="stroke.color"
								[attr.stroke-width]="stroke.width"
								[attr.stroke-opacity]="stroke.opacity"
								stroke-linecap="round"
								stroke-linejoin="round"
								vector-effect="non-scaling-stroke"
								[style.animation]="replayStyles()[$index]?.animation ?? null"
								[style.stroke-dasharray]="replayStyles()[$index]?.strokeDasharray ?? null"
								[style.stroke-dashoffset]="replayStyles()[$index]?.strokeDashoffset ?? null"
								[style.--ink-path-length]="replayStyles()[$index]?.pathLength ?? null"
							/>
						}
					}
				</svg>
			}
		</div>
	`,
})
export class InkRendererComponent {
	readonly element = input.required<PptxElement>();
	readonly zIndex = input<number>(0);
	readonly mediaDataUrls = input<Map<string, string>>(new Map());
	readonly replay = input<boolean>(false);
	/**
	 * Emit the neutral element marker (`data-pptx-element="true"`) on this
	 * renderer's root, the node that also carries `data-element-id`.
	 *
	 * Set only by the main interactive canvas. It is an input rather than
	 * something the dispatcher wraps around this component because the root here
	 * positions itself absolutely, so an outer marked box would offset the ink
	 * twice. Without it an ink element renders correctly but is not an element as
	 * far as the shared contract is concerned, so anything enumerating or
	 * hit-testing slide elements by the marker skips it.
	 */
	readonly markElement = input<boolean>(false);
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

	readonly replayKeyframes = INK_REPLAY_KEYFRAMES;

	readonly containerStyle = computed<StyleMap>(() =>
		buildInkContainerStyle(this.element(), this.zIndex()),
	);

	readonly strokes = computed<InkStroke[]>(() => buildInkStrokes(this.element()));
	readonly replayStyles = computed(() => {
		const element = this.element();
		return this.replay() && isInkElement(element) ? getInkReplayStyles(element) : [];
	});

	readonly viewBox = computed<string>(() => inkViewBox(this.element()));
}
