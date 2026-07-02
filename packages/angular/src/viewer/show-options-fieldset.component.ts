/**
 * show-options-fieldset.component.ts: Slide-show option checkboxes.
 *
 * Selector: `pptx-show-options-fieldset`
 *
 * Angular port of the React `ShowOptionsFieldset`. Renders the "Show options"
 * fieldset with the loop / narration / animation / subtitles toggles. Reads the
 * current values from the `draft` presentation-properties input and emits a
 * partial `patch` for the host dialog to merge.
 */

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxPresentationProperties } from 'pptx-viewer-core';

@Component({
	selector: 'pptx-show-options-fieldset',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<fieldset class="pptx-ng-sss-fieldset">
			<legend class="pptx-ng-sss-legend">{{ 'pptx.slideShow.showOptions' | translate }}</legend>

			<label class="pptx-ng-sss-option">
				<input
					type="checkbox"
					class="pptx-ng-sss-radio"
					[checked]="!!draft().loopContinuously"
					(change)="patch.emit({ loopContinuously: isChecked($event) })"
				/>
				<span>{{ 'pptx.slideShow.loopContinuously' | translate }}</span>
			</label>

			<label class="pptx-ng-sss-option">
				<input
					type="checkbox"
					class="pptx-ng-sss-radio"
					[checked]="draft().showWithNarration === false"
					(change)="patch.emit({ showWithNarration: !isChecked($event) })"
				/>
				<span>{{ 'pptx.slideShow.showWithoutNarration' | translate }}</span>
			</label>

			<label class="pptx-ng-sss-option">
				<input
					type="checkbox"
					class="pptx-ng-sss-radio"
					[checked]="draft().showWithAnimation === false"
					(change)="patch.emit({ showWithAnimation: !isChecked($event) })"
				/>
				<span>{{ 'pptx.slideShow.showWithoutAnimation' | translate }}</span>
			</label>

			<label class="pptx-ng-sss-option">
				<input
					type="checkbox"
					class="pptx-ng-sss-radio"
					[checked]="!!draft().showSubtitles"
					(change)="patch.emit({ showSubtitles: isChecked($event) })"
				/>
				<span>{{ 'pptx.slideShow.showSubtitles' | translate }}</span>
			</label>
		</fieldset>
	`,
	styles: [
		`
			.pptx-ng-sss-fieldset {
				display: flex;
				flex-direction: column;
				gap: 0.375rem;
				margin: 0;
				padding: 0;
				border: none;
			}

			.pptx-ng-sss-legend {
				margin-bottom: 0.25rem;
				padding: 0;
				font-size: 0.6875rem;
				font-weight: 500;
				text-transform: uppercase;
				letter-spacing: 0.03em;
				color: var(--pptx-muted-foreground, #9ca3af);
			}

			.pptx-ng-sss-option {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				font-size: 0.75rem;
				color: var(--pptx-foreground, #f3f4f6);
				cursor: pointer;
			}

			.pptx-ng-sss-radio {
				accent-color: var(--pptx-primary, #6366f1);
			}
		`,
	],
})
export class ShowOptionsFieldsetComponent {
	/** Current slide-show properties draft (source of the checkbox states). */
	readonly draft = input<PptxPresentationProperties>({});

	/** Emits a partial patch to merge into the host draft. */
	readonly patch = output<Partial<PptxPresentationProperties>>();

	protected isChecked(event: Event): boolean {
		return (event.target as HTMLInputElement).checked;
	}
}
