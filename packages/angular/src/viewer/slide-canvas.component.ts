import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
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
					[class.is-editable]="editable()"
					role="region"
					aria-roledescription="slide"
					[ngStyle]="stageStyle()"
					(click)="onStageClick($event)"
				>
					@for (element of elements(); track element.id; let i = $index) {
						<pptx-element-renderer
							[element]="element"
							[mediaDataUrls]="mediaDataUrls()"
							[zIndex]="i"
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
	/** When true, clicking an element selects it and selection outlines show. */
	readonly editable = input<boolean>(false);
	/** Ids of currently-selected elements (drawn with a selection outline). */
	readonly selectedIds = input<readonly string[]>([]);

	/** Emitted when an element is clicked (with the additive-select modifier). */
	readonly elementSelect = output<{ id: string; additive: boolean }>();
	/** Emitted when empty stage space is clicked (deselect). */
	readonly backgroundClick = output<void>();

	readonly elements = computed(() => this.slide()?.elements ?? []);

	/** Bounding boxes (stage coords) for the selected elements. */
	readonly selectionBoxes = computed(() => {
		const selected = new Set(this.selectedIds());
		if (selected.size === 0) {
			return [];
		}
		return this.elements()
			.filter((el) => selected.has(el.id))
			.map((el) => ({ id: el.id, x: el.x, y: el.y, width: el.width, height: el.height }));
	});

	/** Resolve a click to an element id (event delegation) or the background. */
	onStageClick(event: MouseEvent): void {
		if (!this.editable()) {
			return;
		}
		const target = event.target as HTMLElement | null;
		const host = target?.closest('[data-element-id]') as HTMLElement | null;
		const id = host?.getAttribute('data-element-id');
		if (id) {
			this.elementSelect.emit({ id, additive: event.shiftKey || event.ctrlKey || event.metaKey });
		} else {
			this.backgroundClick.emit();
		}
	}

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
