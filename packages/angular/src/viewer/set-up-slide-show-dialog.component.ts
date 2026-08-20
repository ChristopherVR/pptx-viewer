/**
 * set-up-slide-show-dialog.component.ts: Configure slide-show playback.
 *
 * Selector: `pptx-set-up-slide-show-dialog`
 *
 * Angular port of the React `SetUpSlideShowDialog`. A modal for configuring how
 * the deck plays back: show type, which slides, advance mode, and the assorted
 * loop / narration / animation / subtitle options. Composes the reusable
 * {@link ModalDialogComponent} and the two fieldset sub-components
 * ({@link ShowSlidesFieldsetComponent}, {@link ShowOptionsFieldsetComponent}).
 *
 * The host owns the `open` flag and the persisted `properties`; this dialog
 * keeps an internal `draft` (seeded when it opens) and emits `save` with the
 * final draft on OK.
 */

import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	input,
	output,
	signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxCustomShow, PptxPresentationProperties } from 'pptx-viewer-core';

import { ModalDialogComponent } from './modal-dialog.component';
import { ShowOptionsFieldsetComponent } from './show-options-fieldset.component';
import { ShowSlidesFieldsetComponent } from './show-slides-fieldset.component';

@Component({
	selector: 'pptx-set-up-slide-show-dialog',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		ModalDialogComponent,
		ShowSlidesFieldsetComponent,
		ShowOptionsFieldsetComponent,
		TranslatePipe,
	],
	template: `
		<pptx-modal-dialog
			[open]="open()"
			[title]="'pptx.slideShow.setUpTitle' | translate"
			(close)="onClose()"
		>
			<div class="pptx-ng-sss-body">
				<!-- Show type -->
				<fieldset class="pptx-ng-sss-fieldset">
					<legend class="pptx-ng-sss-legend">{{ 'pptx.slideShow.showType' | translate }}</legend>
					<label class="pptx-ng-sss-option">
						<input
							type="radio"
							name="showType"
							class="pptx-ng-sss-radio"
							value="presented"
							[checked]="showType() === 'presented'"
							(change)="update({ showType: 'presented' })"
						/>
						<span>{{ 'pptx.slideShow.presentedBySpeaker' | translate }}</span>
					</label>
					<label class="pptx-ng-sss-option">
						<input
							type="radio"
							name="showType"
							class="pptx-ng-sss-radio"
							value="browsed"
							[checked]="showType() === 'browsed'"
							(change)="update({ showType: 'browsed' })"
						/>
						<span>{{ 'pptx.slideShow.browsedByIndividual' | translate }}</span>
					</label>
					<label class="pptx-ng-sss-option">
						<input
							type="radio"
							name="showType"
							class="pptx-ng-sss-radio"
							value="kiosk"
							[checked]="showType() === 'kiosk'"
							(change)="update({ showType: 'kiosk', loopContinuously: true })"
						/>
						<span>{{ 'pptx.slideShow.browsedAtKiosk' | translate }}</span>
					</label>
				</fieldset>

				<pptx-show-slides-fieldset
					[draft]="draft()"
					[showSlidesMode]="showSlidesMode()"
					[slideCount]="slideCount()"
					[customShows]="customShows()"
					(patch)="update($event)"
				/>

				<!-- Advance slides -->
				<fieldset class="pptx-ng-sss-fieldset">
					<legend class="pptx-ng-sss-legend">
						{{ 'pptx.slideShow.advanceSlides' | translate }}
					</legend>
					<label class="pptx-ng-sss-option">
						<input
							type="radio"
							name="advanceMode"
							class="pptx-ng-sss-radio"
							value="manual"
							[checked]="draft().advanceMode === 'manual'"
							(change)="update({ advanceMode: 'manual' })"
						/>
						<span>{{ 'pptx.slideShow.manually' | translate }}</span>
					</label>
					<label class="pptx-ng-sss-option">
						<input
							type="radio"
							name="advanceMode"
							class="pptx-ng-sss-radio"
							value="useTimings"
							[checked]="(draft().advanceMode ?? 'useTimings') === 'useTimings'"
							(change)="update({ advanceMode: 'useTimings' })"
						/>
						<span>{{ 'pptx.slideShow.useTimings' | translate }}</span>
					</label>
				</fieldset>

				<pptx-show-options-fieldset [draft]="draft()" (patch)="update($event)" />
			</div>

			<div footer>
				<button type="button" class="pptx-ng-sss-btn" (click)="onClose()">
					{{ 'pptx.common.cancel' | translate }}
				</button>
				<button type="button" class="pptx-ng-sss-btn pptx-ng-sss-btn-primary" (click)="onOk()">
					{{ 'pptx.common.ok' | translate }}
				</button>
			</div>
		</pptx-modal-dialog>
	`,
	styles: [
		`
			.pptx-ng-sss-body {
				display: flex;
				flex-direction: column;
				gap: 1.25rem;
				font-size: 0.75rem;
				color: var(--pptx-foreground, #f3f4f6);
			}

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

			.pptx-ng-sss-btn {
				padding: 0.375rem 0.75rem;
				border: 1px solid var(--pptx-border, #374151);
				border-radius: 0.375rem;
				background: var(--pptx-card, #111827);
				color: var(--pptx-foreground, #f3f4f6);
				font-size: 0.75rem;
				cursor: pointer;
				white-space: nowrap;
				transition: background 0.15s ease;
			}

			.pptx-ng-sss-btn:hover {
				background: var(--pptx-border, #374151);
			}

			.pptx-ng-sss-btn-primary {
				border-color: var(--pptx-primary, #6366f1);
				background: var(--pptx-primary, #6366f1);
				color: #ffffff;
			}

			.pptx-ng-sss-btn-primary:hover {
				background: var(--pptx-primary, #6366f1);
				filter: brightness(1.1);
			}
		`,
	],
})
export class SetUpSlideShowDialogComponent {
	/** Whether the dialog is visible. */
	readonly open = input<boolean>(false);

	/** Persisted slide-show properties used to seed the draft on open. */
	readonly properties = input<PptxPresentationProperties>({});

	/** Named custom shows defined by the deck (may be empty). */
	readonly customShows = input<PptxCustomShow[]>([]);

	/** Total number of slides in the deck (clamps the range inputs). */
	readonly slideCount = input<number>(0);

	/** Fired with the final draft when the user confirms with OK. */
	readonly save = output<PptxPresentationProperties>();

	/** Fired when the dialog is dismissed (Cancel, backdrop, Escape). */
	readonly close = output<void>();

	/** Working copy of the properties; seeded from `properties` on open. */
	readonly draft = signal<PptxPresentationProperties>({});

	readonly showType = computed(() => this.draft().showType ?? 'presented');
	readonly showSlidesMode = computed(() => this.draft().showSlidesMode ?? 'all');

	constructor() {
		// Reseed the draft each time the dialog opens (matches broadcast-dialog).
		effect(() => {
			if (this.open()) {
				this.draft.set({ ...this.properties() });
			}
		});
	}

	/** Merge a partial patch into the current draft. */
	update(patch: Partial<PptxPresentationProperties>): void {
		this.draft.update((prev) => ({ ...prev, ...patch }));
	}

	onClose(): void {
		this.close.emit();
	}

	onOk(): void {
		this.save.emit(this.draft());
		this.close.emit();
	}
}
