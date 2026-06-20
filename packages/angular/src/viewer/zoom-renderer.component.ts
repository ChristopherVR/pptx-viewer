import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';

import type { StyleMap } from './element-style';
import { buildZoomContainerStyle, buildZoomViewModel } from './zoom-renderer-helpers';
import type { ZoomViewModel } from './zoom-renderer-helpers';

/**
 * ZoomRendererComponent: Angular port of the Vue `ZoomRenderer.vue`
 * (and the React `ZoomElementRenderer`), static viewer-first subset.
 *
 * Renders a Slide-Zoom / Section-Zoom tile (`ZoomPptxElement`): the element's
 * own preview thumbnail (`imageData`) when available, otherwise a fallback tile
 * showing the target slide number. A small "Slide Zoom" / "Section Zoom" badge
 * is drawn in the corner.
 *
 * Navigation (click-to-jump in presentation mode) and live target-slide preview
 * rendering are NOT ported; this is a static link tile only (see PORTING.md).
 * The `slides` array is not threaded through, so the fallback uses the target
 * slide index rather than the real target background.
 *
 * All non-trivial pure computation lives in `zoom-renderer-helpers.ts` (no
 * Angular dependency) so it can be unit-tested without TestBed.
 */
@Component({
	selector: 'pptx-zoom-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle],
	template: `
		<div
			class="pptx-ng-element pptx-ng-zoom"
			[ngStyle]="containerStyle()"
			[attr.data-element-id]="element().id"
			[attr.data-zoom-type]="vm().zoomType"
			[attr.data-zoom-target]="vm().targetSlideIndex"
			[attr.aria-label]="vm().ariaLabel"
		>
			<div
				style="position:relative;width:100%;height:100%;overflow:hidden;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.15)"
			>
				@if (vm().previewSrc) {
					<img
						[src]="vm().previewSrc"
						[alt]="'Preview of slide ' + (vm().targetSlideIndex + 1)"
						draggable="false"
						style="width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none;display:block"
					/>
				} @else {
					<div
						style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background-color:#f0f0f0;border:1px solid rgba(0,0,0,0.1);box-sizing:border-box"
					>
						<div style="font-size:14px;font-weight:600;color:rgba(0,0,0,0.5);margin-bottom:4px">
							{{ vm().slideLabel }}
						</div>
						@if (vm().targetSectionId) {
							<div style="font-size:10px;color:rgba(0,0,0,0.4)">{{ vm().targetSectionId }}</div>
						}
					</div>
				}

				<div
					style="position:absolute;bottom:4px;right:4px;font-size:9px;padding:1px 4px;border-radius:2px;background-color:rgba(0,0,0,0.5);color:#fff;pointer-events:none;line-height:1.4"
				>
					{{ vm().badgeText }}
				</div>
			</div>
		</div>
	`,
})
export class ZoomRendererComponent {
	readonly element = input.required<PptxElement>();
	readonly zIndex = input<number>(0);
	readonly mediaDataUrls = input<Map<string, string>>(new Map());

	readonly containerStyle = computed<StyleMap>(() =>
		buildZoomContainerStyle(this.element(), this.zIndex()),
	);

	readonly vm = computed<ZoomViewModel>(() => buildZoomViewModel(this.element()));
}
