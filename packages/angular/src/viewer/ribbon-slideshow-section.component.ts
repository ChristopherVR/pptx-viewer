/**
 * ribbon-slideshow-section.component.ts: the Slide Show ribbon tab (From
 * Beginning, Presenter View, Broadcast, Custom Shows, Set Up Show). Split out of
 * {@link RibbonComponent}; behaviour and markup are unchanged.
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
	selector: 'pptx-ribbon-slideshow-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<button
			type="button"
			class="pptx-rb-pill"
			[disabled]="slideCount() === 0"
			(click)="present.emit()"
		>
			{{ 'pptx.ribbon.fromBeginning' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[disabled]="slideCount() === 0"
			(click)="presenter.emit()"
		>
			{{ 'pptx.ribbon.presenterView' | translate }}
		</button>
		<button type="button" class="pptx-rb-pill" (click)="broadcast.emit()">
			{{ 'pptx.ribbon.broadcast' | translate }}
		</button>
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

	readonly present = output<void>();
	readonly presenter = output<void>();
	readonly broadcast = output<void>();
	readonly openCustomShows = output<void>();
	readonly openSetUpSlideShow = output<void>();
}
