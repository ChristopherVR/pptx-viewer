import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';

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
 * Not ported (TODO, see PORTING.md): pressure-sensitive variable-width strokes
 * (`inkPointPressures`), ink replay animation, and the highlighter/eraser tool
 * blend modes. These all degrade gracefully to plain constant-width strokes.
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
			[attr.data-element-id]="element().id"
		>
			@if (strokes().length > 0) {
				<svg
					class="pptx-ng-ink-svg"
					[attr.viewBox]="viewBox()"
					preserveAspectRatio="none"
					style="width:100%;height:100%;pointer-events:none;display:block"
				>
					@for (stroke of strokes(); track $index) {
						<path
							[attr.d]="stroke.d"
							fill="none"
							[attr.stroke]="stroke.color"
							[attr.stroke-width]="stroke.width"
							[attr.stroke-opacity]="stroke.opacity"
							stroke-linecap="round"
							stroke-linejoin="round"
							vector-effect="non-scaling-stroke"
						/>
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

	readonly containerStyle = computed<StyleMap>(() =>
		buildInkContainerStyle(this.element(), this.zIndex()),
	);

	readonly strokes = computed<InkStroke[]>(() => buildInkStrokes(this.element()));

	readonly viewBox = computed<string>(() => inkViewBox(this.element()));
}
