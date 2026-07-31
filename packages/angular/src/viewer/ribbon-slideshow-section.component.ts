/**
 * ribbon-slideshow-section.component.ts: the Slide Show ribbon tab (Start Slide
 * Show, Present, Set Up and Options groups). Split out of
 * {@link RibbonComponent}.
 *
 * Two controls here are deliberate stand-ins rather than omissions, and are
 * rendered disabled: Rehearse Coach and Hide Slide. Showing a disabled control
 * tells a user the concept exists and where it will appear; omitting it tells
 * them nothing, and leaves the tab reading differently from every other
 * binding.
 *
 * Custom Show used to be a third. It is not: the viewer already owns the whole
 * custom-show manager (`CustomShowsComponent`), it was simply only reachable
 * from the quick-access row above the tabs, where PowerPoint users do not look
 * for it. The button opens that dialog, which stays closed until asked.
 *
 * The Options toggles reflect show settings that are not yet host-editable, so
 * they render in their effective state and swallow the click instead of
 * pretending to persist a change.
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
		<span class="pptx-rb-sep"></span>
		<button
			type="button"
			class="pptx-rb-pill"
			[disabled]="slideCount() === 0"
			(click)="presenter.emit()"
		>
			{{ 'pptx.ribbon.presenterView' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.customShows.customShowTooltip' | translate"
			(click)="openCustomShows.emit()"
		>
			{{ 'pptx.slideShow.customShow' | translate }}
		</button>
		@if (!toolbar.isHidden('broadcast')) {
			<button type="button" class="pptx-rb-pill" (click)="broadcast.emit()">
				{{ 'pptx.ribbon.broadcast' | translate }}
			</button>
		}
		<span class="pptx-rb-sep"></span>
		<!-- Speaker Coach has no local speech-analysis backend yet. -->
		<button type="button" class="pptx-rb-pill" disabled>
			{{ 'pptx.slideShow.rehearseCoach' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.ribbon.setUpShowTitle' | translate"
			(click)="openSetUpSlideShow.emit()"
		>
			{{ 'pptx.slideShow.setUp' | translate }}
		</button>
		<!-- Per-slide "skip in show" is not part of the slide model yet. -->
		<button type="button" class="pptx-rb-pill" disabled>
			{{ 'pptx.slideShow.hideSlide' | translate }}
		</button>
		<button type="button" class="pptx-rb-pill" (click)="rehearseTimings.emit()">
			{{ 'pptx.slideShow.rehearseTimings' | translate }}
		</button>
		<button type="button" class="pptx-rb-pill" (click)="record.emit()">
			{{ 'pptx.titleBar.record' | translate }}
		</button>
		<span class="pptx-rb-sep"></span>
		<div class="flex flex-col justify-center gap-0.5">
			<label class="pptx-rb-toggle">
				<input type="checkbox" class="h-3 w-3 accent-primary" disabled />
				{{ 'pptx.slideShow.keepUpdated' | translate }}
			</label>
			<label class="pptx-rb-toggle">
				<input
					type="checkbox"
					class="h-3 w-3 accent-primary"
					checked
					(click)="$event.preventDefault()"
				/>
				{{ 'pptx.slideShow.useTimings' | translate }}
			</label>
			<label class="pptx-rb-toggle">
				<input
					type="checkbox"
					class="h-3 w-3 accent-primary"
					checked
					(click)="$event.preventDefault()"
				/>
				{{ 'pptx.slideShow.playNarrations' | translate }}
			</label>
		</div>
		<div class="flex flex-col justify-center gap-0.5">
			<label class="pptx-rb-toggle">
				<input
					type="checkbox"
					class="h-3 w-3 accent-primary"
					checked
					(click)="$event.preventDefault()"
				/>
				{{ 'pptx.slideShow.mediaControls' | translate }}
			</label>
			<label class="pptx-rb-toggle">
				<input
					type="checkbox"
					class="h-3 w-3 accent-primary"
					[checked]="showSubtitles()"
					[title]="'pptx.slideShow.subtitlesTooltip' | translate"
					(change)="toggleSubtitles.emit()"
				/>
				{{ 'pptx.slideShow.subtitles' | translate }}
			</label>
			<button
				type="button"
				class="pptx-rb-toggle hover:bg-accent"
				(click)="openSubtitleSettings.emit()"
			>
				{{ 'pptx.slideShow.subtitleSettings' | translate }}
			</button>
		</div>
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
	/** "Custom show"; the host opens the custom-show manager dialog. */
	readonly openCustomShows = output<void>();
	readonly openSetUpSlideShow = output<void>();
	readonly rehearseTimings = output<void>();
	readonly record = output<void>();
	readonly toggleSubtitles = output<void>();
	readonly openSubtitleSettings = output<void>();

	protected readonly toolbar = toolbarVisibility(this.hiddenActions);
}
