import { ChangeDetectionStrategy, Component, output } from '@angular/core';

@Component({
	selector: 'pptx-ribbon-record-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	template: `
		<div class="flex items-center gap-1">
			<button type="button" class="pptx-rb-pill" (click)="recordFromBeginning.emit()">
				From Beginning
			</button>
			<button type="button" class="pptx-rb-pill" (click)="recordFromCurrent.emit()">
				From Current Slide
			</button>
		</div>
	`,
})
export class RibbonRecordSectionComponent {
	readonly recordFromBeginning = output<void>();
	readonly recordFromCurrent = output<void>();
}
