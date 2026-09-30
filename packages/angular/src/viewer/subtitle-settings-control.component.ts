import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import {
	subtitleSettingsFromOptions,
	subtitleSettingsLabels,
	updateSubtitleSettings,
} from '../internal/shared';
import type { SubtitleSettingsChangeEvent } from '../internal/shared';
import { ViewerOptionsService } from './viewer-options.service';

@Component({
	selector: 'pptx-subtitle-settings-control',
	standalone: true,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	template: `<pptx-ui-subtitle-settings
		data-ribbon-control="slideShow.captions.subtitleSettings"
		[settings]="settings()"
		[labels]="labels()"
		[languageDisabled]="options.store.isLocked('accessibility', 'subtitleLanguage')"
		(subtitle-settings-change)="commit($event)"
	></pptx-ui-subtitle-settings>`,
})
export class SubtitleSettingsControlComponent {
	protected readonly options =
		inject(ViewerOptionsService, { optional: true }) ?? new ViewerOptionsService();
	private readonly translate = inject(TranslateService);
	protected settings() {
		return subtitleSettingsFromOptions(this.options.options());
	}
	protected labels() {
		return subtitleSettingsLabels((key) => this.translate.instant(key));
	}
	protected commit(event: Event): void {
		updateSubtitleSettings(this.options.store, (event as SubtitleSettingsChangeEvent).detail);
	}
}
