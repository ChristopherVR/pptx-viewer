/**
 * show-slides-fieldset.component.ts: Slide-subset selector for a slide show.
 *
 * Selector: `pptx-show-slides-fieldset`
 *
 * Angular port of the React `ShowSlidesFieldset`. Lets the user pick which
 * slides play: all slides, a from/to range, or (when the deck defines any) a
 * named custom show. Reads state from the `draft` presentation-properties input
 * plus the derived `showSlidesMode`, and emits a partial `patch` for the host
 * dialog to merge.
 */

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxCustomShow, PptxPresentationProperties } from 'pptx-viewer-core';

@Component({
	selector: 'pptx-show-slides-fieldset',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<fieldset class="pptx-ng-sss-fieldset">
			<legend class="pptx-ng-sss-legend">{{ 'pptx.slideShow.showSlides' | translate }}</legend>

			<!-- All -->
			<label class="pptx-ng-sss-option">
				<input
					type="radio"
					name="showSlides"
					class="pptx-ng-sss-radio"
					value="all"
					[checked]="showSlidesMode() === 'all'"
					(change)="patch.emit({ showSlidesMode: 'all' })"
				/>
				<span>{{ 'pptx.slideShow.allSlides' | translate }}</span>
			</label>

			<!-- Range -->
			<label class="pptx-ng-sss-option">
				<input
					type="radio"
					name="showSlides"
					class="pptx-ng-sss-radio"
					value="range"
					[checked]="showSlidesMode() === 'range'"
					(change)="onSelectRange()"
				/>
				<span>{{ 'pptx.slideShow.fromTo' | translate }}</span>
			</label>
			@if (showSlidesMode() === 'range') {
				<div class="pptx-ng-sss-range">
					<label class="pptx-ng-sss-range-field">
						<span class="pptx-ng-sss-range-label">{{ 'pptx.slideShow.from' | translate }}</span>
						<input
							type="number"
							class="pptx-ng-sss-number"
							[min]="1"
							[max]="slideCount()"
							[value]="draft().showSlidesFrom ?? 1"
							(input)="onFromInput($event)"
						/>
					</label>
					<label class="pptx-ng-sss-range-field">
						<span class="pptx-ng-sss-range-label">{{ 'pptx.slideShow.to' | translate }}</span>
						<input
							type="number"
							class="pptx-ng-sss-number"
							[min]="1"
							[max]="slideCount()"
							[value]="draft().showSlidesTo ?? slideCount()"
							(input)="onToInput($event)"
						/>
					</label>
				</div>
			}

			<!-- Custom show -->
			@if (customShows().length > 0) {
				<label class="pptx-ng-sss-option">
					<input
						type="radio"
						name="showSlides"
						class="pptx-ng-sss-radio"
						value="customShow"
						[checked]="showSlidesMode() === 'customShow'"
						(change)="onSelectCustomShow()"
					/>
					<span>{{ 'pptx.slideShow.customShow' | translate }}</span>
				</label>
				@if (showSlidesMode() === 'customShow') {
					<div class="pptx-ng-sss-custom">
						<select
							class="pptx-ng-sss-select"
							[value]="draft().showSlidesCustomShowId ?? customShows()[0]?.id ?? ''"
							(change)="onSelectCustomShowId($event)"
						>
							@for (cs of customShows(); track cs.id) {
								<option [value]="cs.id">{{ cs.name }}</option>
							}
						</select>
					</div>
				}
			}
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

			.pptx-ng-sss-range {
				display: flex;
				align-items: center;
				gap: 0.75rem;
				margin-left: 1.5rem;
			}

			.pptx-ng-sss-range-field {
				display: flex;
				align-items: center;
				gap: 0.375rem;
			}

			.pptx-ng-sss-range-label {
				color: var(--pptx-muted-foreground, #9ca3af);
			}

			.pptx-ng-sss-number {
				width: 3.5rem;
				padding: 0.125rem 0.375rem;
				border: 1px solid var(--pptx-border, #374151);
				border-radius: 0.25rem;
				background: var(--pptx-background, #030712);
				color: var(--pptx-foreground, #f3f4f6);
				font-size: 0.6875rem;
			}

			.pptx-ng-sss-custom {
				margin-left: 1.5rem;
			}

			.pptx-ng-sss-select {
				width: 100%;
				padding: 0.25rem 0.5rem;
				border: 1px solid var(--pptx-border, #374151);
				border-radius: 0.25rem;
				background: var(--pptx-background, #030712);
				color: var(--pptx-foreground, #f3f4f6);
				font-size: 0.6875rem;
			}
		`,
	],
})
export class ShowSlidesFieldsetComponent {
	/** Current slide-show properties draft. */
	readonly draft = input<PptxPresentationProperties>({});

	/** Derived active mode (falls back to 'all' upstream). */
	readonly showSlidesMode = input<'all' | 'customShow' | 'range'>('all');

	/** Total number of slides in the deck (clamps the range inputs). */
	readonly slideCount = input<number>(0);

	/** Named custom shows defined by the deck (may be empty). */
	readonly customShows = input<PptxCustomShow[]>([]);

	/** Emits a partial patch to merge into the host draft. */
	readonly patch = output<Partial<PptxPresentationProperties>>();

	protected onSelectRange(): void {
		const d = this.draft();
		this.patch.emit({
			showSlidesMode: 'range',
			showSlidesFrom: d.showSlidesFrom ?? 1,
			showSlidesTo: d.showSlidesTo ?? this.slideCount(),
		});
	}

	protected onFromInput(event: Event): void {
		const raw = Number.parseInt((event.target as HTMLInputElement).value, 10) || 1;
		this.patch.emit({ showSlidesFrom: Math.max(1, raw) });
	}

	protected onToInput(event: Event): void {
		const count = this.slideCount();
		const raw = Number.parseInt((event.target as HTMLInputElement).value, 10) || count;
		this.patch.emit({ showSlidesTo: Math.min(count, raw) });
	}

	protected onSelectCustomShow(): void {
		const d = this.draft();
		this.patch.emit({
			showSlidesMode: 'customShow',
			showSlidesCustomShowId: d.showSlidesCustomShowId ?? this.customShows()[0]?.id,
		});
	}

	protected onSelectCustomShowId(event: Event): void {
		this.patch.emit({ showSlidesCustomShowId: (event.target as HTMLSelectElement).value });
	}
}
