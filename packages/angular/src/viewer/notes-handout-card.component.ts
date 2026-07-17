/**
 * notes-handout-card.component.ts: NOTES & HANDOUT card of the default
 * (no-selection) inspector, mirroring React's `NotesHandoutCard`: read-only
 * notes-page size and notes/handout master placeholder counts.
 */
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { INSPECTOR_CARD_STYLES } from './inspector-card-styles';
import { LoadContentService } from './load-content.service';

@Component({
	selector: 'pptx-notes-handout-card',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<section class="icard">
			<h3 class="icard__heading">
				{{ 'pptx.documentProperties.notesHandoutHeading' | translate }}
			</h3>
			<div class="icard__row">
				<span class="icard__label">{{ 'pptx.documentProperties.notesSize' | translate }}</span>
				<span class="icard__value">{{ notesSizeText() }}</span>
			</div>
			<div class="icard__row">
				<span class="icard__label">{{ 'pptx.master.notesMasterTitle' | translate }}</span>
				<span class="icard__value">{{ notesMasterText() }}</span>
			</div>
			<div class="icard__row">
				<span class="icard__label">{{ 'pptx.master.handoutMasterTitle' | translate }}</span>
				<span class="icard__value">{{ handoutMasterText() }}</span>
			</div>
		</section>
	`,
	styles: [INSPECTOR_CARD_STYLES],
})
export class NotesHandoutCardComponent {
	private readonly loader = inject(LoadContentService);
	private readonly translate = inject(TranslateService);

	private notAvailable(): string {
		return this.translate.instant('pptx.digitalSignatures.notAvailable');
	}

	private placeholders(count: number): string {
		return `${count} ${this.translate.instant('pptx.notesMaster.placeholders')}`;
	}

	protected readonly notesSizeText = computed(() => {
		const size = this.loader.notesCanvasSize();
		return size ? `${size.width} × ${size.height}px` : this.notAvailable();
	});

	protected readonly notesMasterText = computed(() => {
		const master = this.loader.notesMaster();
		return master ? this.placeholders(master.placeholders?.length ?? 0) : this.notAvailable();
	});

	protected readonly handoutMasterText = computed(() => {
		const master = this.loader.handoutMaster();
		return master ? this.placeholders(master.placeholders?.length ?? 0) : this.notAvailable();
	});
}
