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
 * The Options cluster is rendered from the shared `SLIDE_SHOW_OPTIONS`
 * descriptors. The two that map to real, saved `p:showPr` attributes
 * (Use Timings, Play Narrations) read the deck's presentation properties and
 * commit back to them; the two with no backing state anywhere in the viewer
 * (Keep Slides Updated, Show Media Controls) render disabled and unchecked
 * rather than hard-coded `checked` with a click that was swallowed, which is
 * what they used to do.
 */
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { SlideShowOptionId, ToolbarActionId } from '../internal/shared';
import { readSlideShowOption, SLIDE_SHOW_OPTIONS, slideShowOptionChange } from '../internal/shared';
import { LoadContentService } from './load-content.service';
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
		<!-- Presenter View. Deliberately NOT gated on slideCount(): no other
		     binding disables it, and e2e/ribbon-control-inventory.spec.ts diffs
		     exactly which controls each binding leaves usable. The label key is
		     pptx.slideShow.* for the same reason: the old pptx.ribbon.* key
		     happens to carry the same English, so the inventory's accessible-name
		     diff passed by luck and would have broken on any locale edit. -->
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.slideShow.presenterViewTooltip' | translate"
			(click)="presenter.emit()"
		>
			{{ 'pptx.slideShow.presenterView' | translate }}
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
		<!-- PowerPoint's Hide Slide: skip the ACTIVE slide during the show while
		     leaving it in the deck, the thumbnail rail and the sorter. -->
		<button
			type="button"
			class="pptx-rb-pill"
			[attr.aria-pressed]="activeSlideHidden()"
			(click)="toggleHideSlide.emit()"
		>
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
			@for (option of primaryOptions; track option.id) {
				<label class="pptx-rb-toggle">
					<input
						type="checkbox"
						class="h-3 w-3 accent-primary disabled:opacity-50"
						[disabled]="option.unsupported"
						[checked]="isOptionChecked(option.id)"
						(change)="onOptionChange(option.id, $event)"
					/>
					{{ option.labelKey | translate }}
				</label>
			}
		</div>
		<div class="flex flex-col justify-center gap-0.5">
			@for (option of secondaryOptions; track option.id) {
				<label class="pptx-rb-toggle">
					<input
						type="checkbox"
						class="h-3 w-3 accent-primary disabled:opacity-50"
						[disabled]="option.unsupported"
						[checked]="isOptionChecked(option.id)"
						(change)="onOptionChange(option.id, $event)"
					/>
					{{ option.labelKey | translate }}
				</label>
			}
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
	/** PowerPoint's Hide Slide toggle for the active slide. */
	readonly toggleHideSlide = output<void>();
	/** Whether the active slide is hidden, for Hide Slide's pressed state. */
	readonly activeSlideHidden = input<boolean>(false);
	readonly rehearseTimings = output<void>();
	readonly record = output<void>();
	readonly toggleSubtitles = output<void>();
	readonly openSubtitleSettings = output<void>();

	protected readonly toolbar = toolbarVisibility(this.hiddenActions);

	private readonly loader = inject(LoadContentService);

	/**
	 * The Options cluster, split across the two columns PowerPoint uses. Both
	 * halves come from the shared descriptor list, so the set and its order stay
	 * identical across bindings.
	 */
	protected readonly primaryOptions = SLIDE_SHOW_OPTIONS.slice(0, 3);
	protected readonly secondaryOptions = SLIDE_SHOW_OPTIONS.slice(3);

	/** Whether an Options checkbox reads as ticked for the loaded deck. */
	protected isOptionChecked(id: SlideShowOptionId): boolean {
		return readSlideShowOption(this.loader.presentationProperties(), id);
	}

	/**
	 * Commit a tick/untick onto the deck's presentation properties, the same
	 * signal the inspector's PRESENTATION card patches and the show path reads.
	 * Unsupported options return no change from shared and are rendered disabled,
	 * so this is a no-op for them even if a click somehow arrives.
	 */
	protected onOptionChange(id: SlideShowOptionId, event: Event): void {
		const checked = (event.target as HTMLInputElement).checked;
		const change = slideShowOptionChange(id, checked);
		if (!change) {
			return;
		}
		this.loader.presentationProperties.update((current) => ({ ...current, ...change }));
	}
}
