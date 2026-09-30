import {
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
	inject,
	input,
	output,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import type {
	RibbonCommandRequestEvent,
	SlideShowOptionsChangeEvent,
	ToolbarActionId,
} from '../internal/shared';
import { SLIDE_SHOW_COMMAND_GROUPS, SLIDE_SHOW_OPTIONS } from '../internal/shared';
import { LoadContentService } from './load-content.service';
import { SubtitleSettingsControlComponent } from './subtitle-settings-control.component';
import { toolbarVisibility } from './toolbar-visibility';

@Component({
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	selector: 'pptx-ribbon-slideshow-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [TranslatePipe, SubtitleSettingsControlComponent],
	template: `
		@for (group of groups; track group.id) {
			<pptx-ui-ribbon-group
				[attr.label]="group.labelKey | translate"
				[attr.data-ribbon-group]="group.id"
			>
				@for (command of group.commands; track command.id) {
					@if (command.id !== 'slideShow.present.broadcast' || !toolbar.isHidden('broadcast')) {
						<pptx-ui-ribbon-command
							[attr.label]="command.labelKey | translate"
							[attr.icon]="command.icon"
							[attr.data-ribbon-control]="command.id"
							[attr.title]="command.tooltipKey ?? command.labelKey | translate"
							[attr.disabled]="
								command.unsupported ||
								((command.id === 'slideShow.startSlideShow.fromBeginning' ||
									command.id === 'slideShow.startSlideShow.fromCurrent') &&
									slideCount() === 0)
									? ''
									: null
							"
							[attr.active]="
								command.id === 'slideShow.setUp.hideSlide' && activeSlideHidden() ? '' : null
							"
							[attr.pressed]="
								command.id === 'slideShow.setUp.hideSlide' ? activeSlideHidden() : null
							"
							(command-request)="onCommand($event)"
						/>
					}
				}
			</pptx-ui-ribbon-group>
		}
		<pptx-ui-ribbon-group [attr.label]="'pptx.slideShow.options' | translate">
			<pptx-ui-slide-show-options
				[presentationProperties]="loader.presentationProperties()"
				[labels]="optionLabels()"
				(show-options-change)="onOptionsChange($event)"
			>
				<span class="contents" data-ribbon-group="slideShow.captions">
					<pptx-ui-ribbon-toggle
						data-ribbon-control="slideShow.captions.subtitles"
						[attr.label]="'pptx.slideShow.subtitles' | translate"
						[attr.checked]="showSubtitles() ? '' : null"
						[attr.title]="'pptx.slideShow.subtitlesTooltip' | translate"
						(toggle-request)="toggleSubtitles.emit()"
					/>
					<pptx-subtitle-settings-control />
				</span>
			</pptx-ui-slide-show-options>
		</pptx-ui-ribbon-group>
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

	protected readonly groups = SLIDE_SHOW_COMMAND_GROUPS;
	protected readonly loader = inject(LoadContentService);
	private readonly translate = inject(TranslateService);
	protected optionLabels(): Record<string, string> {
		return Object.fromEntries(
			SLIDE_SHOW_OPTIONS.map((option) => [option.id, this.translate.instant(option.labelKey)]),
		);
	}
	protected onCommand(event: Event): void {
		const actions = {
			'slideShow.startSlideShow.fromBeginning': this.presentFromBeginning,
			'slideShow.startSlideShow.fromCurrent': this.presentFromCurrent,
			'slideShow.present.presenterView': this.presenter,
			'slideShow.startSlideShow.customShow': this.openCustomShows,
			'slideShow.present.broadcast': this.broadcast,
			'slideShow.setUp.setUpSlideShow': this.openSetUpSlideShow,
			'slideShow.setUp.hideSlide': this.toggleHideSlide,
			'slideShow.setUp.rehearseTimings': this.rehearseTimings,
			'slideShow.setUp.record': this.record,
		};
		const id = (event as RibbonCommandRequestEvent).detail.id;
		actions[id as keyof typeof actions]?.emit();
	}

	protected onOptionsChange(event: Event): void {
		const change = (event as SlideShowOptionsChangeEvent).detail;
		this.loader.presentationProperties.update((current) => ({ ...current, ...change }));
	}
}
