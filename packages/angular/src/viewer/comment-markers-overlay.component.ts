/**
 * comment-markers-overlay.component.ts: numbered comment marker dots drawn
 * over the slide canvas.
 *
 * Selector: `pptx-comment-markers-overlay`
 *
 * Angular port of React's `canvas/CommentMarkersOverlay.tsx` / Vue's
 * `CommentMarkersOverlay.vue`. The descriptors (position clamped to the
 * slide or a 4-column grid fallback, 1-based numbering, and the
 * `"<author>: <text>"` tooltip) come from the shared `buildCommentMarkers`,
 * so the dots match every other binding.
 *
 * The host projects this INTO `pptx-slide-canvas` so the dots render inside
 * the scaled stage (the `aria-roledescription="slide"` region) in raw slide
 * coordinates, exactly like the collaboration overlays.
 */

import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { PptxComment } from 'pptx-viewer-core';

import type { CommentMarkerDescriptor } from '../internal/shared';
import { buildCommentMarkers, COMMENT_MARKER_SIZE } from '../internal/shared';

@Component({
	selector: 'pptx-comment-markers-overlay',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@for (marker of markers(); track marker.commentId) {
			<button
				type="button"
				class="pptx-ng-comment-marker"
				[style.left.px]="marker.x - half"
				[style.top.px]="marker.y - half"
				[style.width.px]="size"
				[style.height.px]="size"
				[title]="marker.title"
				(click)="onMarkerClick($event, marker.commentId)"
			>
				{{ marker.label }}
			</button>
		}
	`,
	styles: [
		`
			:host {
				position: absolute;
				inset: 0;
				pointer-events: none;
				z-index: 45;
			}
			.pptx-ng-comment-marker {
				position: absolute;
				display: flex;
				align-items: center;
				justify-content: center;
				padding: 0;
				pointer-events: auto;
				cursor: pointer;
				border-radius: 50%;
				background: rgba(255, 165, 0, 0.9);
				border: 2px solid #fff;
				box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
				font-size: 10px;
				font-weight: 700;
				line-height: 1;
				color: #fff;
			}
		`,
	],
})
export class CommentMarkersOverlayComponent {
	/** The active slide's comments (already filtered by the host). */
	readonly comments = input<PptxComment[]>([]);

	/** Unscaled slide canvas size, in px. */
	readonly canvasSize = input.required<{ width: number; height: number }>();

	/** Emits the clicked comment's id (the host opens its comments panel). */
	readonly markerClick = output<string>();

	private readonly translate = inject(TranslateService);

	protected readonly size = COMMENT_MARKER_SIZE;
	protected readonly half = COMMENT_MARKER_SIZE / 2;

	protected readonly markers = computed<CommentMarkerDescriptor[]>(() =>
		buildCommentMarkers(
			this.comments(),
			this.canvasSize().width,
			this.canvasSize().height,
			this.translate.instant('pptx.comments.unknownAuthor'),
		),
	);

	protected onMarkerClick(event: MouseEvent, commentId: string): void {
		event.stopPropagation();
		this.markerClick.emit(commentId);
	}
}
