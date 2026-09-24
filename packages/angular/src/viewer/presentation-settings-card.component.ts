/**
 * presentation-settings-card.component.ts: PRESENTATION card of the default
 * (no-selection) inspector, mirroring React's `PresentationSettingsCard`
 * (PresentationSettingsCards.tsx): show type, loop, narration, animation,
 * frame-slides and slides-per-page controls over `PptxPresentationProperties`.
 *
 * Edits patch the loader's `presentationProperties` signal (the same object
 * `LoadContentService.saveSlides` serialises) and mark the editor dirty.
 */
import {
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
	computed,
	inject,
	input,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxPresentationProperties } from 'pptx-viewer-core';

import {
	printPropertiesFrameSlides,
	printPropertiesSlidesPerPage,
	withFrameSlides,
	withSlidesPerPage,
} from '../internal/shared-src/render/presentation-print-settings';
import { EditorStateService } from './editor-state.service';
import { INSPECTOR_CARD_STYLES } from './inspector-card-styles';
import { LoadContentService } from './load-content.service';

@Component({
	selector: 'pptx-presentation-settings-card',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `
		<section class="icard">
			<h3 class="icard__heading">{{ 'pptx.slideInspector.presentation' | translate }}</h3>
			<label class="icard__row">
				<span class="icard__label">{{ 'pptx.presentationSettings.showType' | translate }}</span>
				<pptx-ui-select
					[attr.aria-label]="'pptx.presentationSettings.showType' | translate"
					class="icard__web-select"
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
				</pptx-ui-select>
			</label>
			<label class="icard__row">
				<span class="icard__label">
					{{ 'pptx.presentationSettings.loopContinuously' | translate }}
				</span>
				<pptx-ui-checkbox
					[attr.aria-label]="'pptx.presentationSettings.loopContinuously' | translate"
					[disabled]="!canEdit()"
					[checked]="!!props().loopContinuously"
					(change)="onCheckbox($event, 'loopContinuously')"
				/>
			</label>
			<label class="icard__row">
				<span class="icard__label">
					{{ 'pptx.presentationSettings.showNarration' | translate }}
				</span>
				<pptx-ui-checkbox
					[attr.aria-label]="'pptx.presentationSettings.showNarration' | translate"
					[disabled]="!canEdit()"
					[checked]="props().showWithNarration !== false"
					(change)="onCheckbox($event, 'showWithNarration')"
				/>
			</label>
			<label class="icard__row">
				<span class="icard__label">
					{{ 'pptx.presentationSettings.showAnimation' | translate }}
				</span>
				<pptx-ui-checkbox
					[attr.aria-label]="'pptx.presentationSettings.showAnimation' | translate"
					[disabled]="!canEdit()"
					[checked]="props().showWithAnimation !== false"
					(change)="onCheckbox($event, 'showWithAnimation')"
				/>
			</label>
			<label class="icard__row">
				<span class="icard__label">{{ 'pptx.presentationSettings.frameSlides' | translate }}</span>
				<pptx-ui-checkbox
					[attr.aria-label]="'pptx.presentationSettings.frameSlides' | translate"
					[disabled]="!canEdit()"
					[checked]="frameSlides()"
					(change)="onFrameSlidesChange($event)"
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
					[value]="slidesPerPage()"
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

	protected readonly frameSlides = computed(() =>
		printPropertiesFrameSlides(this.props().printProperties),
	);
	protected readonly slidesPerPage = computed(() =>
		printPropertiesSlidesPerPage(this.props().printProperties),
	);

	private patch(patch: Partial<PptxPresentationProperties>): void {
		this.loader.presentationProperties.update((current) => ({ ...current, ...patch }));
		this.editor.dirty.set(true);
	}

	protected onShowTypeChange(event: Event): void {
		const value = (event.target as HTMLElement & { value: string }).value;
		this.patch({ showType: value as 'presented' | 'browsed' | 'kiosk' });
	}

	protected onCheckbox(
		event: Event,
		key: 'loopContinuously' | 'showWithNarration' | 'showWithAnimation',
	): void {
		this.patch({ [key]: (event.target as HTMLElement & { checked: boolean }).checked });
	}

	protected onFrameSlidesChange(event: Event): void {
		const checked = (event.target as HTMLElement & { checked: boolean }).checked;
		this.patch({ printProperties: withFrameSlides(this.props().printProperties, checked) });
	}

	protected onSlidesPerPageChange(event: Event): void {
		const value = Number((event.target as HTMLInputElement).value);
		if (Number.isFinite(value) && value >= 1) {
			this.patch({ printProperties: withSlidesPerPage(this.props().printProperties, value) });
		}
	}
}
