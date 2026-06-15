import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PptxSlide } from 'pptx-viewer-core';

import type { CanvasSize } from '../internal/shared';
import { ElementRendererComponent } from './element-renderer.component';
import type { StyleMap } from './element-style';
import { getSlideBackgroundStyle } from './slide-background';

/**
 * SlideCanvasComponent — Angular port of the React `SlideCanvas.tsx` and Vue
 * `SlideCanvas.vue` (viewer-first subset).
 *
 * Renders the active slide as a fixed-size stage scaled by `zoom`, with each
 * element absolutely positioned. The React version additionally layered in
 * rulers, grid, guides, marquee/selection, connector-creation, drawing, and
 * collaboration overlays — all tracked in PORTING.md.
 */
@Component({
	selector: 'pptx-slide-canvas',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, ElementRendererComponent],
	template: `
		<div class="pptx-ng-canvas-viewport">
			<div class="pptx-ng-canvas-wrapper" [ngStyle]="wrapperStyle()">
				<div
					class="pptx-ng-canvas-stage"
					role="region"
					aria-roledescription="slide"
					[ngStyle]="stageStyle()"
				>
					@for (element of elements(); track element.id; let i = $index) {
						<pptx-element-renderer
							[element]="element"
							[mediaDataUrls]="mediaDataUrls()"
							[zIndex]="i"
						/>
					}
				</div>
			</div>
		</div>
	`,
})
export class SlideCanvasComponent {
	readonly slide = input<PptxSlide | undefined>(undefined);
	readonly canvasSize = input.required<CanvasSize>();
	readonly mediaDataUrls = input<Map<string, string>>(new Map());
	readonly zoom = input<number>(1);

	readonly elements = computed(() => this.slide()?.elements ?? []);

	readonly wrapperStyle = computed<StyleMap>(() => {
		const scale = this.zoom();
		const size = this.canvasSize();
		return {
			width: `${size.width * scale}px`,
			height: `${size.height * scale}px`,
			position: 'relative',
			margin: '1rem auto',
		};
	});

	readonly stageStyle = computed<StyleMap>(() => {
		const scale = this.zoom();
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
