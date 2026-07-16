import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement } from 'pptx-viewer-core';
import { buildSummaryZoomView } from 'pptx-viewer-shared';

import type { StyleMap } from './element-style';
import { ZoomNavigationService } from './zoom-navigation.service';
import {
	buildZoomContainerStyle,
	buildZoomViewModel,
	isZoomActivationKey,
	zoomTargetSlideIndex,
} from './zoom-renderer-helpers';
import type { ZoomViewModel } from './zoom-renderer-helpers';
import { ZoomTargetService } from './zoom-target.service';

/**
 * ZoomRendererComponent: Angular port of the Vue `ZoomRenderer.vue`
 * (and the React `ZoomElementRenderer`), static viewer-first subset.
 *
 * Renders a Slide-Zoom / Section-Zoom tile (`ZoomPptxElement`): the element's
 * own preview thumbnail (`imageData`) when available, otherwise a fallback tile
 * showing the target slide number. A small "Slide Zoom" / "Section Zoom" badge
 * is drawn in the corner.
 *
 * In presentation mode the overlay provides a {@link ZoomNavigationService}, so
 * clicking (or Enter/Space) jumps to the target slide. Outside presentation mode
 * the service is not provided (optional injection yields `null`) and the tile
 * stays a static link, exactly as before.
 *
 * The fallback thumbnail (no embedded preview image) matches React's
 * `ZoomSlideThumbnail`: when a {@link ZoomTargetService} is provided (by the
 * viewer), it looks up the target slide and uses that slide's real background
 * colour, its own 1-based number, and its friendly section name. A live
 * mini-rendering of the target slide is intentionally NOT drawn. When the
 * service is absent the tile keeps the neutral grey / index / section-GUID
 * fallback.
 *
 * All non-trivial pure computation lives in `zoom-renderer-helpers.ts` (no
 * Angular dependency) so it can be unit-tested without TestBed.
 */
@Component({
	selector: 'pptx-zoom-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, TranslatePipe],
	styles: `
		.pptx-ng-zoom-interactive {
			cursor: pointer;
		}

		.pptx-ng-zoom-interactive:focus-visible {
			outline: 2px solid #2563eb;
			outline-offset: 2px;
		}
	`,
	template: `
		<div
			class="pptx-ng-element pptx-ng-zoom"
			[class.pptx-ng-zoom-interactive]="interactive()"
			[ngStyle]="containerStyle()"
			[attr.data-element-id]="element().id"
			[attr.data-zoom-type]="vm().zoomType"
			[attr.data-zoom-target]="vm().targetSlideIndex"
			[attr.aria-label]="summaryView()?.ariaLabel ?? vm().ariaLabel"
			[attr.role]="summaryView() ? 'group' : interactive() ? 'button' : null"
			[attr.tabindex]="!summaryView() && interactive() ? 0 : null"
			(click)="onClick($event)"
			(keydown)="onKeydown($event)"
		>
			<div
				style="position:relative;width:100%;height:100%;overflow:hidden;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.15)"
			>
				@if (summaryView(); as summary) {
					<div [ngStyle]="summary.containerStyle">
						@for (tile of summary.tiles; track tile.key) {
							<div
								[ngStyle]="tile.style"
								[style.background-color]="tile.backgroundColor"
								[attr.data-zoom-target]="tile.targetSlideIndex"
								[attr.data-section-id]="tile.sectionId"
								[attr.aria-label]="tile.ariaLabel"
								[attr.role]="interactive() ? 'button' : null"
								[attr.tabindex]="interactive() ? 0 : null"
								(click)="activateSummary($event, tile.targetSlideIndex)"
								(keydown)="activateSummary($event, tile.targetSlideIndex)"
								style="overflow:hidden;border:1px solid rgba(0,0,0,0.12)"
							>
								@if (tile.imageSrc) {
									<img
										[src]="tile.imageSrc"
										[alt]="tile.ariaLabel"
										style="width:100%;height:100%;object-fit:contain"
									/>
								} @else {
									<div>{{ tile.label }}</div>
									<div>{{ tile.slideLabel }}</div>
								}
							</div>
						}
						<div style="position:absolute;right:4px;bottom:4px;font-size:9px">Summary Zoom</div>
					</div>
				} @else if (vm().previewSrc) {
					<img
						[src]="vm().previewSrc"
						[alt]="'pptx.zoom.slidePreviewAlt' | translate: { number: vm().targetSlideIndex + 1 }"
						draggable="false"
						style="width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none;display:block"
					/>
				} @else {
					<div
						style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid rgba(0,0,0,0.1);box-sizing:border-box"
						[style.background-color]="vm().thumbnailBackground"
					>
						<div style="font-size:14px;font-weight:600;color:rgba(0,0,0,0.5);margin-bottom:4px">
							{{ vm().slideLabel }}
						</div>
						@if (vm().sectionCaption) {
							<div style="font-size:10px;color:rgba(0,0,0,0.4)">{{ vm().sectionCaption }}</div>
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

	/**
	 * Target-slide lookup, provided by the viewer. `null` in trees that do not
	 * provide it (e.g. isolated component tests), where the fallback thumbnail
	 * stays on the neutral grey / index / section-GUID placeholder.
	 */
	private readonly zoomTarget = inject(ZoomTargetService, { optional: true });

	readonly vm = computed<ZoomViewModel>(() => {
		const element = this.element();
		const targetSlideIndex = zoomTargetSlideIndex(element);
		return buildZoomViewModel(element, this.zoomTarget?.lookup(targetSlideIndex));
	});
	readonly summaryView = computed(() => {
		const zoom = this.vm().zoom;
		return zoom ? buildSummaryZoomView(zoom, (index) => this.zoomTarget?.lookup(index)) : undefined;
	});

	/**
	 * Zoom-navigation context, present only inside a running presentation (the
	 * overlay provides it). `null` in the editor tree, where the tile stays
	 * static.
	 */
	private readonly zoomNavigation = inject(ZoomNavigationService, { optional: true });

	/** Interactive (click-to-jump) only when navigation is available for a zoom. */
	protected readonly interactive = computed<boolean>(() =>
		Boolean(this.zoomNavigation && this.vm().zoom),
	);

	/** Navigate to the zoom target; no-op when the tile is not interactive. */
	private activate(target = this.vm().targetSlideIndex): void {
		const vm = this.vm();
		if (!this.zoomNavigation || !vm.zoom) {
			return;
		}
		this.zoomNavigation.navigateToZoomTarget(target);
	}

	protected activateSummary(event: Event, target: number): void {
		if (!this.interactive()) {
			return;
		}
		if (event instanceof KeyboardEvent && !isZoomActivationKey(event.key)) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		this.activate(target);
	}

	protected onClick(event: MouseEvent): void {
		if (!this.interactive()) {
			return;
		}
		// Stop the stage's click-to-advance from also firing.
		event.stopPropagation();
		this.activate();
	}

	protected onKeydown(event: KeyboardEvent): void {
		if (!this.interactive() || !isZoomActivationKey(event.key)) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		this.activate();
	}
}
