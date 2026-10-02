import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { RECORD_COMMAND_GROUPS } from '../internal/shared';

@Component({
	selector: 'pptx-ribbon-record-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	imports: [TranslatePipe],
	template: `
		@for (group of groups; track group.id) {
			<pptx-ui-ribbon-group
				[attr.label]="group.labelKey | translate"
				[attr.data-ribbon-group]="group.id"
			>
				@for (command of group.commands; track command.id) {
					<pptx-ui-ribbon-command
						[attr.label]="command.labelKey | translate"
						[attr.icon]="command.icon"
						[attr.disabled]="command.unsupported ? '' : null"
						[attr.data-ribbon-control]="command.id"
						(command-request)="request(command.id)"
					></pptx-ui-ribbon-command>
				}
			</pptx-ui-ribbon-group>
		}
	`,
})
export class RibbonRecordSectionComponent {
	protected readonly groups = RECORD_COMMAND_GROUPS;
	readonly recordFromBeginning = output<void>();
	readonly recordFromCurrent = output<void>();
	protected request(id: string): void {
		if (id === 'record.record.fromBeginning') {
			this.recordFromBeginning.emit();
		} else if (id === 'record.record.fromCurrent') {
			this.recordFromCurrent.emit();
		}
	}
}
