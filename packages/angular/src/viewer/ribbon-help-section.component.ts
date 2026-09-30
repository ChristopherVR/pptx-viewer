import {
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
	inject,
	output,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { HELP_RIBBON_COMMANDS } from '../internal/shared';
import { ViewerCustomizationService } from './viewer-customization.service';

@Component({
	selector: 'pptx-ribbon-help-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	imports: [TranslatePipe],
	template: `
		<pptx-ui-ribbon-group
			[attr.label]="'pptx.ribbon.tab.help' | translate"
			data-ribbon-group="help.help"
		>
			@for (command of commands; track command.id) {
				@if (
					command.id !== 'help.help.options' || customization?.dialogAvailable('options') !== false
				) {
					<pptx-ui-ribbon-command
						[attr.label]="command.labelKey | translate"
						[attr.icon]="command.icon"
						[attr.data-ribbon-control]="command.id"
						compact
						(command-request)="request(command.id)"
					></pptx-ui-ribbon-command>
				}
			}
		</pptx-ui-ribbon-group>
	`,
})
export class RibbonHelpSectionComponent {
	protected readonly customization = inject(ViewerCustomizationService, { optional: true });
	protected readonly commands = HELP_RIBBON_COMMANDS;
	readonly openSettings = output<void>();
	readonly openShortcuts = output<void>();
	readonly a11y = output<void>();
	protected request(id: string): void {
		if (id === 'help.help.options') {
			this.openSettings.emit();
		} else if (id === 'help.help.keyboardShortcuts') {
			this.openShortcuts.emit();
		} else if (id === 'help.help.accessibility') {
			this.a11y.emit();
		}
	}
}
