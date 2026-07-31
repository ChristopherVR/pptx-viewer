/**
 * ribbon-record-section.component.ts: the Record ribbon tab (Camera, Record,
 * Manage and Help groups).
 *
 * Only the two Record commands do anything today; Cameo, Clear, Reset to Cameo
 * and Learn More are rendered disabled because there is no camera-overlay
 * feature behind them yet. They are listed rather than omitted so the tab reads
 * the same in every binding and a user can see what the group will hold.
 */
import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
	selector: 'pptx-ribbon-record-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [TranslatePipe],
	template: `
		<div class="flex items-center gap-1">
			<button type="button" class="pptx-rb-pill" disabled>
				{{ 'pptx.record.cameo' | translate }}
			</button>
			<span class="pptx-rb-sep"></span>
			<button type="button" class="pptx-rb-pill" (click)="recordFromBeginning.emit()">
				{{ 'pptx.slideShow.fromBeginning' | translate }}
			</button>
			<button type="button" class="pptx-rb-pill" (click)="recordFromCurrent.emit()">
				{{ 'pptx.slideShow.fromCurrent' | translate }}
			</button>
			<span class="pptx-rb-sep"></span>
			<button type="button" class="pptx-rb-pill" disabled>
				{{ 'pptx.record.clear' | translate }}
			</button>
			<button type="button" class="pptx-rb-pill" disabled>
				{{ 'pptx.record.resetToCameo' | translate }}
			</button>
			<span class="pptx-rb-sep"></span>
			<button type="button" class="pptx-rb-pill" disabled>
				{{ 'pptx.record.learnMore' | translate }}
			</button>
		</div>
	`,
})
export class RibbonRecordSectionComponent {
	readonly recordFromBeginning = output<void>();
	readonly recordFromCurrent = output<void>();
}
