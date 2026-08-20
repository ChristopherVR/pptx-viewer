/**
 * print-settings-panel.component.ts: Settings form for the print dialog.
 *
 * Selector: `pptx-print-settings-panel`
 *
 * Mirrors React's `PrintSettingsPanel`: print-what / handout slides-per-page /
 * slide range / orientation / colour mode / frame slides. Emits a single
 * `settingsChange` whenever any field changes; the parent dialog owns the
 * authoritative {@link PrintSettings} state.
 *
 * Usage:
 * ```html
 * <pptx-print-settings-panel
 *   [settings]="settings()"
 *   [totalSlides]="slides().length"
 *   [activeSlideIndex]="activeIndex()"
 *   (settingsChange)="patch($event)"
 * />
 * ```
 */

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { HANDOUT_OPTIONS } from './print-helpers';
import type {
	HandoutSlidesPerPage,
	PrintColorMode,
	PrintOrientation,
	PrintSettings,
	PrintWhat,
} from './print-helpers';

@Component({
	selector: 'pptx-print-settings-panel',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<div class="pptx-ng-print-settings">
			<!-- Print What -->
			<fieldset class="pptx-ng-print-settings__group">
				<legend class="pptx-ng-print-settings__legend">
					{{ 'pptx.print.printWhat' | translate }}
				</legend>
				<div class="pptx-ng-print-settings__grid2">
					@for (opt of printWhatOptions; track opt.value) {
						<button
							type="button"
							class="pptx-ng-print-settings__card"
							[class.pptx-ng-print-settings__card--active]="settings().printWhat === opt.value"
							(click)="emit({ printWhat: opt.value })"
						>
							{{ opt.labelKey | translate }}
						</button>
					}
				</div>
			</fieldset>

			<!-- Handout slides per page -->
			@if (settings().printWhat === 'handouts') {
				<fieldset class="pptx-ng-print-settings__group">
					<legend class="pptx-ng-print-settings__legend">
						{{ 'pptx.print.slidesPerPage' | translate }}
					</legend>
					<div class="pptx-ng-print-settings__chips">
						@for (n of handoutOptions; track n) {
							<button
								type="button"
								class="pptx-ng-print-settings__chip"
								[class.pptx-ng-print-settings__chip--active]="settings().slidesPerPage === n"
								(click)="emit({ slidesPerPage: n })"
							>
								{{ n }}
							</button>
						}
					</div>
				</fieldset>
			}

			<!-- Slide range -->
			<fieldset class="pptx-ng-print-settings__group">
				<legend class="pptx-ng-print-settings__legend">
					{{ 'pptx.print.slideRange' | translate }}
				</legend>
				<div class="pptx-ng-print-settings__stack">
					<button
						type="button"
						class="pptx-ng-print-settings__card pptx-ng-print-settings__card--wide"
						[class.pptx-ng-print-settings__card--active]="settings().slideRange === 'all'"
						(click)="emit({ slideRange: 'all' })"
					>
						{{ 'pptx.print.allSlides' | translate }} ({{ totalSlides() }})
					</button>
					<button
						type="button"
						class="pptx-ng-print-settings__card pptx-ng-print-settings__card--wide"
						[class.pptx-ng-print-settings__card--active]="settings().slideRange === 'current'"
						(click)="emit({ slideRange: 'current' })"
					>
						{{ 'pptx.print.currentSlide' | translate }} ({{ activeSlideIndex() + 1 }})
					</button>
					<button
						type="button"
						class="pptx-ng-print-settings__card pptx-ng-print-settings__card--wide"
						[class.pptx-ng-print-settings__card--active]="settings().slideRange === 'custom'"
						(click)="emit({ slideRange: 'custom' })"
					>
						{{ 'pptx.print.customRange' | translate }}
					</button>
					@if (settings().slideRange === 'custom') {
						<div class="pptx-ng-print-settings__range">
							<span class="pptx-ng-print-settings__range-label">{{
								'pptx.print.from' | translate
							}}</span>
							<input
								class="pptx-ng-print-settings__number"
								type="number"
								min="1"
								[max]="totalSlides()"
								[value]="settings().customRangeFrom"
								(change)="onRangeChange($event, 'from')"
							/>
							<span class="pptx-ng-print-settings__range-label">{{
								'pptx.print.to' | translate
							}}</span>
							<input
								class="pptx-ng-print-settings__number"
								type="number"
								min="1"
								[max]="totalSlides()"
								[value]="settings().customRangeTo"
								(change)="onRangeChange($event, 'to')"
							/>
						</div>
					}
				</div>
			</fieldset>

			<!-- Orientation (full-page slides only) -->
			@if (settings().printWhat === 'slides') {
				<fieldset class="pptx-ng-print-settings__group">
					<legend class="pptx-ng-print-settings__legend">
						{{ 'pptx.print.orientation' | translate }}
					</legend>
					<div class="pptx-ng-print-settings__chips">
						@for (o of orientationOptions; track o.value) {
							<button
								type="button"
								class="pptx-ng-print-settings__card"
								[class.pptx-ng-print-settings__card--active]="settings().orientation === o.value"
								(click)="emit({ orientation: o.value })"
							>
								{{ o.labelKey | translate }}
							</button>
						}
					</div>
				</fieldset>
			}

			<!-- Colour mode -->
			<fieldset class="pptx-ng-print-settings__group">
				<legend class="pptx-ng-print-settings__legend">
					{{ 'pptx.print.colorMode' | translate }}
				</legend>
				<div class="pptx-ng-print-settings__chips">
					@for (c of colorModeOptions; track c.value) {
						<button
							type="button"
							class="pptx-ng-print-settings__card"
							[class.pptx-ng-print-settings__card--active]="settings().colorMode === c.value"
							(click)="emit({ colorMode: c.value })"
						>
							{{ c.labelKey | translate }}
						</button>
					}
				</div>
			</fieldset>

			<!-- Frame slides -->
			<label class="pptx-ng-print-settings__check">
				<input
					type="checkbox"
					[checked]="settings().frameSlides"
					(change)="onFrameChange($event)"
				/>
				<span>{{ 'pptx.print.frameSlides' | translate }}</span>
			</label>
		</div>
	`,
	styles: [
		`
			:host {
				display: block;
				flex: 1;
				min-width: 0;
			}

			.pptx-ng-print-settings {
				display: flex;
				flex-direction: column;
				gap: 1.25rem;
			}

			.pptx-ng-print-settings__group {
				margin: 0;
				padding: 0;
				border: 0;
			}

			.pptx-ng-print-settings__legend {
				padding: 0;
				margin-bottom: 0.5rem;
				font-size: 0.6875rem;
				font-weight: 500;
				text-transform: uppercase;
				letter-spacing: 0.04em;
				color: rgba(255, 255, 255, 0.5);
			}

			.pptx-ng-print-settings__grid2 {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: 0.5rem;
			}

			.pptx-ng-print-settings__stack {
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
			}

			.pptx-ng-print-settings__chips {
				display: flex;
				flex-wrap: wrap;
				gap: 0.375rem;
			}

			.pptx-ng-print-settings__card {
				display: inline-flex;
				align-items: center;
				gap: 0.5rem;
				padding: 0.5rem 0.75rem;
				border: 1px solid rgba(255, 255, 255, 0.15);
				border-radius: 0.5rem;
				background: rgba(255, 255, 255, 0.04);
				color: rgba(255, 255, 255, 0.65);
				font-size: 0.8125rem;
				cursor: pointer;
				transition:
					border-color 0.12s,
					background 0.12s,
					color 0.12s;
			}

			.pptx-ng-print-settings__card--wide {
				width: 100%;
				justify-content: flex-start;
			}

			.pptx-ng-print-settings__card:hover {
				border-color: rgba(59, 130, 246, 0.5);
			}

			.pptx-ng-print-settings__card--active {
				border-color: #3b82f6;
				background: rgba(59, 130, 246, 0.12);
				color: #ffffff;
			}

			.pptx-ng-print-settings__chip {
				min-width: 2.25rem;
				padding: 0.375rem 0.75rem;
				border: 1px solid rgba(255, 255, 255, 0.15);
				border-radius: 0.375rem;
				background: rgba(255, 255, 255, 0.04);
				color: rgba(255, 255, 255, 0.65);
				font-size: 0.8125rem;
				font-weight: 500;
				cursor: pointer;
				transition:
					border-color 0.12s,
					background 0.12s,
					color 0.12s;
			}

			.pptx-ng-print-settings__chip:hover {
				border-color: rgba(59, 130, 246, 0.5);
			}

			.pptx-ng-print-settings__chip--active {
				border-color: #3b82f6;
				background: rgba(59, 130, 246, 0.12);
				color: #ffffff;
			}

			.pptx-ng-print-settings__range {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				padding-left: 1.5rem;
			}

			.pptx-ng-print-settings__range-label {
				font-size: 0.75rem;
				color: rgba(255, 255, 255, 0.5);
			}

			.pptx-ng-print-settings__number {
				width: 4rem;
				padding: 0.25rem 0.5rem;
				border: 1px solid rgba(255, 255, 255, 0.15);
				border-radius: 0.25rem;
				background: rgba(255, 255, 255, 0.06);
				color: #e5e5e5;
				font-size: 0.8125rem;
				outline: none;
			}

			.pptx-ng-print-settings__number:focus {
				border-color: #3b82f6;
			}

			.pptx-ng-print-settings__check {
				display: inline-flex;
				align-items: center;
				gap: 0.5rem;
				color: #e5e5e5;
				font-size: 0.8125rem;
				cursor: pointer;
			}
		`,
	],
})
export class PrintSettingsPanelComponent {
	/** Current print settings (parent-owned). */
	readonly settings = input.required<PrintSettings>();

	/** Total number of slides in the presentation. */
	readonly totalSlides = input.required<number>();

	/** Zero-based index of the active slide (for the "current" range label). */
	readonly activeSlideIndex = input.required<number>();

	/** Emits a partial patch whenever the user changes a field. */
	readonly settingsChange = output<Partial<PrintSettings>>();

	protected readonly handoutOptions: HandoutSlidesPerPage[] = HANDOUT_OPTIONS;

	protected readonly printWhatOptions: { value: PrintWhat; labelKey: string }[] = [
		{ value: 'slides', labelKey: 'pptx.print.fullPageSlides' },
		{ value: 'handouts', labelKey: 'pptx.print.handouts' },
		{ value: 'notes', labelKey: 'pptx.print.notesPages' },
		{ value: 'outline', labelKey: 'pptx.print.outline' },
	];

	protected readonly orientationOptions: { value: PrintOrientation; labelKey: string }[] = [
		{ value: 'landscape', labelKey: 'pptx.print.landscape' },
		{ value: 'portrait', labelKey: 'pptx.print.portrait' },
	];

	protected readonly colorModeOptions: { value: PrintColorMode; labelKey: string }[] = [
		{ value: 'color', labelKey: 'pptx.print.color' },
		{ value: 'grayscale', labelKey: 'pptx.print.grayscale' },
		{ value: 'blackAndWhite', labelKey: 'pptx.print.blackAndWhite' },
	];

	/** Emit a settings patch. */
	emit(patch: Partial<PrintSettings>): void {
		this.settingsChange.emit(patch);
	}

	onRangeChange(event: Event, edge: 'from' | 'to'): void {
		const target = event.target as HTMLInputElement;
		const value = Math.max(1, parseInt(target.value, 10) || 1);
		this.settingsChange.emit(
			edge === 'from' ? { customRangeFrom: value } : { customRangeTo: value },
		);
	}

	onFrameChange(event: Event): void {
		const target = event.target as HTMLInputElement;
		this.settingsChange.emit({ frameSlides: target.checked });
	}
}
