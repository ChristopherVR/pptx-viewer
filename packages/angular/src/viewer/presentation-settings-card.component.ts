/**
 * presentation-settings-card.component.ts: PRESENTATION card of the default
 * (no-selection) inspector, mirroring React's `PresentationSettingsCard`
 * (PresentationSettingsCards.tsx): show type, loop, narration, animation,
 * frame-slides and slides-per-page controls over `PptxPresentationProperties`.
 *
 * Edits patch the loader's `presentationProperties` signal (the same object
 * `LoadContentService.saveSlides` serialises) and mark the editor dirty.
 */
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxPresentationProperties } from 'pptx-viewer-core';

import { EditorStateService } from './editor-state.service';
import { INSPECTOR_CARD_STYLES } from './inspector-card-styles';
import { LoadContentService } from './load-content.service';

@Component({
	selector: 'pptx-presentation-settings-card',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<section class="icard">
			<h3 class="icard__heading">{{ 'pptx.slideInspector.presentation' | translate }}</h3>
			<label class="icard__row">
				<span class="icard__label">{{ 'pptx.presentationSettings.showType' | translate }}</span>
				<select
					class="icard__select"
					[disabled]="!canEdit()"
					[value]="props().showType ?? 'presented'"
					(change)="onShowTypeChange($event)"
				>
					<option value="presented">
						{{ 'pptx.presentationSettings.showTypePresented' | translate }}
					</option>
					<option value="browsed">
						{{ 'pptx.presentationSettings.showTypeBrowsed' | translate }}
					</option>
					<option value="kiosk">
						{{ 'pptx.presentationSettings.showTypeKiosk' | translate }}
					</option>
				</select>
			</label>
			<label class="icard__row">
				<span class="icard__label">
					{{ 'pptx.presentationSettings.loopContinuously' | translate }}
				</span>
				<input
					type="checkbox"
					[disabled]="!canEdit()"
					[checked]="!!props().loopContinuously"
					(change)="onCheckbox($event, 'loopContinuously')"
				/>
			</label>
			<label class="icard__row">
				<span class="icard__label">
					{{ 'pptx.presentationSettings.showNarration' | translate }}
				</span>
				<input
					type="checkbox"
					[disabled]="!canEdit()"
					[checked]="props().showWithNarration !== false"
					(change)="onCheckbox($event, 'showWithNarration')"
				/>
			</label>
			<label class="icard__row">
				<span class="icard__label">
					{{ 'pptx.presentationSettings.showAnimation' | translate }}
				</span>
				<input
					type="checkbox"
					[disabled]="!canEdit()"
					[checked]="props().showWithAnimation !== false"
					(change)="onCheckbox($event, 'showWithAnimation')"
				/>
			</label>
			<label class="icard__row">
				<span class="icard__label">{{ 'pptx.presentationSettings.frameSlides' | translate }}</span>
				<input
					type="checkbox"
					[disabled]="!canEdit()"
					[checked]="!!props().printFrameSlides"
					(change)="onCheckbox($event, 'printFrameSlides')"
				/>
			</label>
			<label class="icard__row">
				<span class="icard__label">
					{{ 'pptx.presentationSettings.slidesPerPage' | translate }}
				</span>
				<input
					type="number"
					class="icard__input icard__input--number"
					min="1"
					max="16"
					[disabled]="!canEdit()"
					[value]="props().printSlidesPerPage ?? 1"
					(change)="onSlidesPerPageChange($event)"
				/>
			</label>
		</section>
	`,
	styles: [INSPECTOR_CARD_STYLES],
})
export class PresentationSettingsCardComponent {
	/** Whether the controls are enabled. */
	readonly canEdit = input<boolean>(true);

	private readonly loader = inject(LoadContentService);
	private readonly editor = inject(EditorStateService);

	protected readonly props = this.loader.presentationProperties;

	private patch(patch: Partial<PptxPresentationProperties>): void {
		this.loader.presentationProperties.update((current) => ({ ...current, ...patch }));
		this.editor.dirty.set(true);
	}

	protected onShowTypeChange(event: Event): void {
		const value = (event.target as HTMLSelectElement).value;
		this.patch({ showType: value as 'presented' | 'browsed' | 'kiosk' });
	}

	protected onCheckbox(
		event: Event,
		key: 'loopContinuously' | 'showWithNarration' | 'showWithAnimation' | 'printFrameSlides',
	): void {
		this.patch({ [key]: (event.target as HTMLInputElement).checked });
	}

	protected onSlidesPerPageChange(event: Event): void {
		const value = Number((event.target as HTMLInputElement).value);
		if (Number.isFinite(value) && value >= 1) {
			this.patch({ printSlidesPerPage: value });
		}
	}
}
