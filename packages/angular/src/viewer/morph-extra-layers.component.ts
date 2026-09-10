import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { PptxSlide } from 'pptx-viewer-core';

import type { CanvasSize } from '../internal/shared';
import type { StyleMap } from './element-style';
import type { MorphCrossfadeGroupSlides } from './presentation-transition-overlay-morph';
import { SlideCanvasComponent } from './slide-canvas.component';

/**
 * The two morph-only layers `PresentationTransitionOverlayComponent` paints
 * ABOVE its outgoing/incoming pair, split out to keep that file under the
 * project's per-file LOC budget:
 *
 *  - the **lifted** layer: arriving shapes a ghost above them would
 *    otherwise hide for the whole morph, painted here so they dissolve in
 *    where a viewer can see them (issue #146). Their copy on the incoming
 *    layer is held invisible by the plan, so nothing composites twice.
 *  - the **crossfade groups**: pairs the overlay paints BOTH halves of, each
 *    as one isolated group so the halves are SUMMED rather than stacked
 *    (issue #161).
 *
 * Selector: `pptx-morph-extra-layers`.
 */
@Component({
	selector: 'pptx-morph-extra-layers',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, SlideCanvasComponent],
	styles: `
		.pptx-ng-transition-layer {
			position: absolute;
			inset: 0;
			display: flex;
			align-items: center;
			justify-content: center;
		}
	`,
	template: `
		<!-- The arriving shapes that dissolve in ABOVE a departing one. They are on
		     the live stage below this overlay, where the departing layer hides them
		     for the whole morph, so they are painted again here. -->
		@if (liftedSlide(); as lifted) {
			<div
				class="pptx-ng-transition-layer"
				data-pptx-transition-layer="lifted"
				data-pptx-morph-lifted="true"
				[ngStyle]="{ 'z-index': '41' }"
			>
				<div [ngStyle]="slideBoxStyle()">
					<pptx-slide-canvas
						[slide]="lifted"
						[canvasSize]="canvasSize()"
						[mediaDataUrls]="mediaDataUrls()"
						[zoom]="zoom()"
						[autoFit]="false"
						[interactive]="false"
						[transparentBackground]="true"
					/>
				</div>
			</div>
		}

		<!-- A pair dissolving in place, painted as ONE isolated group whose two
		     halves sum instead of stacking (issue #161). -->
		@for (group of crossfadeGroups(); track group.key) {
			<div [attr.data-pptx-morph-crossfade]="group.key" [ngStyle]="group.style">
				<div
					class="pptx-ng-transition-layer"
					data-pptx-transition-layer="outgoing"
					data-pptx-morph-outgoing="true"
					[ngStyle]="group.outgoingStyle"
				>
					<div [ngStyle]="slideBoxStyle()">
						<pptx-slide-canvas
							[slide]="group.outgoing"
							[canvasSize]="canvasSize()"
							[mediaDataUrls]="mediaDataUrls()"
							[zoom]="zoom()"
							[autoFit]="false"
							[interactive]="false"
							[transparentBackground]="true"
						/>
					</div>
				</div>
				<div
					class="pptx-ng-transition-layer"
					data-pptx-transition-layer="lifted"
					data-pptx-morph-lifted="true"
					[ngStyle]="group.incomingStyle"
				>
					<div [ngStyle]="slideBoxStyle()">
						<pptx-slide-canvas
							[slide]="group.incoming"
							[canvasSize]="canvasSize()"
							[mediaDataUrls]="mediaDataUrls()"
							[zoom]="zoom()"
							[autoFit]="false"
							[interactive]="false"
							[transparentBackground]="true"
						/>
					</div>
				</div>
			</div>
		}
	`,
})
export class MorphExtraLayersComponent {
	readonly liftedSlide = input<PptxSlide | undefined>(undefined);
	readonly crossfadeGroups = input<readonly MorphCrossfadeGroupSlides[]>([]);
	readonly canvasSize = input.required<CanvasSize>();
	readonly mediaDataUrls = input<Map<string, string>>(new Map());
	readonly zoom = input<number>(1);
	/** Slide box sized to the zoomed slide footprint; computed once by the parent. */
	readonly slideBoxStyle = input.required<StyleMap>();
}
