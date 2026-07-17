/**
 * ribbon-slideshow-section.component.ts: the Slide Show ribbon tab (From
 * Beginning, Presenter View, Broadcast, Custom Shows, Set Up Show). Split out of
 * {@link RibbonComponent}; behaviour and markup are unchanged.
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { ToolbarActionId } from '../internal/shared';
import { toolbarVisibility } from './toolbar-visibility';

@Component({
	selector: 'pptx-ribbon-slideshow-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [TranslatePipe],
	template: `
		<button
			type="button"
			class="pptx-rb-pill"
			[disabled]="slideCount() === 0"
			(click)="presentFromBeginning.emit()"
		>
			{{ 'pptx.ribbon.fromBeginning' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[disabled]="slideCount() === 0"
			(click)="presentFromCurrent.emit()"
		>
			{{ 'pptx.slideShow.fromCurrent' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[disabled]="slideCount() === 0"
			(click)="presenter.emit()"
		>
			{{ 'pptx.ribbon.presenterView' | translate }}
		</button>
		<button type="button" class="pptx-rb-pill" (click)="rehearseTimings.emit()">
			{{ 'pptx.slideShow.rehearseTimings' | translate }}
		</button>
		<button type="button" class="pptx-rb-pill" (click)="record.emit()">
			{{ 'pptx.titleBar.record' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[class.is-active]="showSubtitles()"
			[attr.aria-pressed]="showSubtitles()"
			(click)="toggleSubtitles.emit()"
		>
			{{ 'pptx.slideShow.subtitles' | translate }}
		</button>
		<button type="button" class="pptx-rb-pill" (click)="openSubtitleSettings.emit()">
			Subtitle Settings
		</button>
		@if (!toolbar.isHidden('broadcast')) {
			<button type="button" class="pptx-rb-pill" (click)="broadcast.emit()">
				{{ 'pptx.ribbon.broadcast' | translate }}
			</button>
		}
		<button type="button" class="pptx-rb-pill" (click)="openCustomShows.emit()">
			{{ 'pptx.ribbon.customShowsButton' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.ribbon.setUpShowTitle' | translate"
			(click)="openSetUpSlideShow.emit()"
		>
			{{ 'pptx.ribbon.setUpShow' | translate }}
		</button>
	`,
})
export class RibbonSlideshowSectionComponent {
	readonly slideCount = input<number>(0);
	readonly showSubtitles = input<boolean>(false);
	/** Toolbar buttons the host wants hidden (gates Broadcast). */
	readonly hiddenActions = input<ToolbarActionId[]>([]);

	readonly presentFromBeginning = output<void>();
	readonly presentFromCurrent = output<void>();
	readonly presenter = output<void>();
	readonly broadcast = output<void>();
	readonly openCustomShows = output<void>();
	readonly openSetUpSlideShow = output<void>();
	readonly rehearseTimings = output<void>();
	readonly record = output<void>();
	readonly toggleSubtitles = output<void>();
	readonly openSubtitleSettings = output<void>();

	protected readonly toolbar = toolbarVisibility(this.hiddenActions);
}
