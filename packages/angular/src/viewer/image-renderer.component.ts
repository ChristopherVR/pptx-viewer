import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { SafeHtml } from '@angular/platform-browser';
import { DomSanitizer } from '@angular/platform-browser';
import type { PptxElement } from 'pptx-viewer-core';

import { getImageOverflow } from '../internal/shared';
import { ColorChangedImageComponent } from './color-changed-image.component';
import { getContainerStyle, getImageSrc } from './element-style';
import { buildAngularImageRenderView } from './image-renderer-helpers';

@Component({
	selector: 'pptx-image-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, ColorChangedImageComponent],
	template: `
		<div
			class="pptx-ng-element pptx-ng-image"
			[ngStyle]="containerStyle()"
			[style.pointer-events]="rootPointerEvents()"
			[attr.data-element-id]="element().id"
			[attr.data-pptx-element]="interactive() || marked() ? 'true' : null"
		>
			@for (filter of safeFilters(); track filter.id) {
				<svg
					width="0"
					height="0"
					aria-hidden="true"
					style="position:absolute;width:0;height:0;overflow:hidden"
				>
					<defs>
						<filter
							[attr.id]="filter.id"
							color-interpolation-filters="sRGB"
							[innerHTML]="filter.markup"
						></filter>
					</defs>
				</svg>
			}
			@if (view().tilingStyle; as tilingStyle) {
				<!-- a:blipFill/a:tile is a repeating texture, painted as a background
				     layer because an img element cannot repeat. -->
				<div class="pptx-ng-image-tile" [ngStyle]="tilingStyle"></div>
			} @else if (imageSrc(); as src) {
				@if (view().clrChange; as clrChange) {
					<pptx-color-changed-image
						[src]="src"
						[clrChange]="clrChange"
						[imgStyle]="view().imageStyle"
						alt=""
						imgClass="pptx-ng-img"
					/>
				} @else {
					<img [src]="src" alt="" class="pptx-ng-img" [ngStyle]="view().imageStyle" />
				}
			}
			@if (view().colorWashStyle; as washStyle) {
				<div class="pptx-ng-image-color-wash" [ngStyle]="washStyle"></div>
			}
		</div>
	`,
})
export class ImageRendererComponent {
	readonly element = input.required<PptxElement>();
	readonly mediaDataUrls = input<Map<string, string>>(new Map());
	readonly zIndex = input<number>(0);
	readonly interactive = input<boolean>(false);
	/** Keep the data-pptx-element marker on interaction-locked template elements. */
	readonly marked = input<boolean>(false);

	/**
	 * `pointer-events: none` while not interactive, mirroring React's
	 * `pointer-events-none` class. {@link marked} keeps the element findable via
	 * `data-pptx-element` even while locked (e.g. a template/master picture with
	 * `editTemplateMode` off); this is what actually stops it from being clicked
	 * or dragged.
	 */
	readonly rootPointerEvents = computed<'none' | null>(() => (this.interactive() ? null : 'none'));

	private readonly sanitizer = inject(DomSanitizer);

	// The clip is load-bearing, not cosmetic: a cropped picture is rendered by
	// scaling the source up and translating the cropped-away part out of the
	// frame, so without it the discarded region paints over its neighbours.
	readonly containerStyle = computed(() => ({
		...getContainerStyle(this.element(), this.zIndex()),
		overflow: getImageOverflow(this.element()),
	}));
	readonly imageSrc = computed(() => getImageSrc(this.element(), this.mediaDataUrls()));
	readonly view = computed(() => buildAngularImageRenderView(this.element()));
	readonly safeFilters = computed<Array<{ id: string; markup: SafeHtml }>>(() =>
		this.view().svgFilters.map((filter) => ({
			id: filter.id,
			markup: this.sanitizer.bypassSecurityTrustHtml(filter.markup),
		})),
	);
}
