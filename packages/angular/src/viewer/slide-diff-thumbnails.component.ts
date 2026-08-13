/**
 * slide-diff-thumbnails.component.ts: side-by-side "Current" / "Incoming"
 * thumbnails for one slide diff.
 *
 * Selector: `pptx-slide-diff-thumbnails`
 *
 * Split out of {@link SlideDiffRowComponent} to keep each file focused. Renders
 * the base and compare slides (when present) as fixed-width, non-interactive
 * {@link SlideCanvasComponent} thumbnails, tinting the incoming clip by status.
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { CanvasSize, SlideDiff } from '../internal/shared';
import { SlideCanvasComponent } from './slide-canvas.component';
import { thumbnailHeight, thumbnailZoom } from './slide-sorter-overlay-helpers';

/** Target pixel width of each side-by-side diff thumbnail. */
const THUMB_W = 180;

@Component({
	selector: 'pptx-slide-diff-thumbnails',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [SlideCanvasComponent, TranslatePipe],
	template: `
		<div class="pptx-ng-diff-thumbs">
			@if (diff().baseSlide; as base) {
				<div class="pptx-ng-diff-thumb-col">
					<div class="pptx-ng-diff-thumb-label">{{ 'pptx.compare.current' | translate }}</div>
					<div
						class="pptx-ng-diff-thumb-clip"
						[style.width.px]="THUMB_W"
						[style.height.px]="thumbH()"
					>
						<pptx-slide-canvas
							[slide]="base"
							[canvasSize]="canvasSize()"
							[mediaDataUrls]="mediaMap()"
							[zoom]="thumbZoom()"
							[editable]="false"
							[autoFit]="false"
							[interactive]="false"
							[exposeElementIds]="false"
							[templateElements]="[]"
						/>
					</div>
				</div>
			}
			@if (diff().compareSlide; as incoming) {
				<div class="pptx-ng-diff-thumb-col">
					<div class="pptx-ng-diff-thumb-label">{{ 'pptx.compare.incoming' | translate }}</div>
					<div
						class="pptx-ng-diff-thumb-clip"
						[attr.data-status]="diff().status"
						[style.width.px]="THUMB_W"
						[style.height.px]="thumbH()"
					>
						<pptx-slide-canvas
							[slide]="incoming"
							[canvasSize]="canvasSize()"
							[mediaDataUrls]="mediaMap()"
							[zoom]="thumbZoom()"
							[editable]="false"
							[autoFit]="false"
							[interactive]="false"
							[templateElements]="[]"
						/>
					</div>
				</div>
			}
		</div>
	`,
	styles: [
		`
			.pptx-ng-diff-thumbs {
				display: flex;
				gap: 0.5rem;
			}
			.pptx-ng-diff-thumb-col {
				flex: 1;
			}
			.pptx-ng-diff-thumb-label {
				margin-bottom: 0.25rem;
				font-size: 0.625rem;
				color: var(--pptx-muted-foreground, #9ca3af);
			}
			.pptx-ng-diff-thumb-clip {
				overflow: hidden;
				border: 1px solid var(--pptx-border, #374151);
				border-radius: 0.25rem;
			}
			.pptx-ng-diff-thumb-clip[data-status='added'] {
				border-color: rgba(21, 128, 61, 0.6);
			}
			.pptx-ng-diff-thumb-clip[data-status='changed'] {
				border-color: rgba(180, 83, 9, 0.6);
			}
			.pptx-ng-diff-thumb-clip ::ng-deep .pptx-ng-canvas-wrapper {
				margin: 0 !important;
			}
		`,
	],
})
export class SlideDiffThumbnailsComponent {
	/** Exposed to the template for the fixed thumbnail box width. */
	protected readonly THUMB_W = THUMB_W;

	readonly diff = input.required<SlideDiff>();
	readonly canvasSize = input.required<CanvasSize>();
	readonly mediaDataUrls = input<Record<string, string>>({});

	/** SlideCanvas expects a Map; convert the Record input once per change. */
	readonly mediaMap = computed(() => new Map(Object.entries(this.mediaDataUrls())));

	readonly thumbZoom = computed(() => thumbnailZoom(this.canvasSize().width, THUMB_W));

	readonly thumbH = computed(() =>
		thumbnailHeight(this.canvasSize().width, this.canvasSize().height, THUMB_W),
	);
}
