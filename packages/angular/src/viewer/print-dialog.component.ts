/**
 * print-dialog.component.ts: Full-featured print dialog for the PPTX viewer.
 *
 * Selector: `pptx-print-dialog`
 *
 * Mirrors React's `PrintDialog`: a modal with the settings panel, a live page
 * estimate in the footer, and Cancel / Print actions. The dialog owns the
 * authoritative {@link PrintSettings} as a signal, seeded from optional
 * presentation defaults, and emits the resolved settings on confirm.
 *
 * Usage:
 * ```html
 * @if (print.isDialogOpen()) {
 *   <pptx-print-dialog
 *     [slides]="loader.slides()"
 *     [activeSlideIndex]="activeIndex()"
 *     [defaultSlidesPerPage]="props.slidesPerPage"
 *     [defaultFrameSlides]="props.frameSlides"
 *     (print)="onPrint($event)"
 *     (cancel)="print.closeDialog()"
 *   />
 * }
 * ```
 */

import {
	ChangeDetectionStrategy,
	Component,
	HostListener,
	computed,
	effect,
	inject,
	input,
	output,
	signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxSlide } from 'pptx-viewer-core';

import { IsMobileService } from './is-mobile';
import {
	DEFAULT_PRINT_SETTINGS,
	computeSlideIndices,
	estimatePageCount,
	normalizeSlidesPerPage,
	validatePrintSettings,
} from './print-helpers';
import type { PrintSettings } from './print-helpers';
import { PrintSettingsPanelComponent } from './print-settings-panel.component';

/**
 * Map the mobile flag to the print-dialog panel class list. Pure (no Angular /
 * DOM) so it can be unit-tested without TestBed. On mobile the dialog gains the
 * `is-mobile` modifier that turns it into a full-width bottom sheet.
 */
export function printDialogClass(isMobile: boolean): string {
	return isMobile ? 'pptx-ng-print-dialog is-mobile' : 'pptx-ng-print-dialog';
}

@Component({
	selector: 'pptx-print-dialog',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [PrintSettingsPanelComponent, TranslatePipe],
	providers: [IsMobileService],
	template: `
		<div
			class="pptx-ng-print-dialog__backdrop"
			[class.is-mobile]="mobile.isMobile()"
			role="dialog"
			aria-modal="true"
			[attr.aria-label]="'pptx.print.title' | translate"
			(click)="onBackdropClick($event)"
		>
			<div [class]="dialogClass()">
				<!-- Header -->
				<div class="pptx-ng-print-dialog__header">
					<h2 class="pptx-ng-print-dialog__title">{{ 'pptx.print.title' | translate }}</h2>
					<button
						type="button"
						class="pptx-ng-print-dialog__icon-btn"
						[attr.aria-label]="'pptx.common.close' | translate"
						(click)="onCancel()"
					>
						&#10005;
					</button>
				</div>

				<!-- Body -->
				<div class="pptx-ng-print-dialog__body">
					<pptx-print-settings-panel
						[settings]="settings()"
						[totalSlides]="slides().length"
						[activeSlideIndex]="activeSlideIndex()"
						(settingsChange)="patch($event)"
					/>
				</div>

				<!-- Footer -->
				<div class="pptx-ng-print-dialog__footer">
					<span class="pptx-ng-print-dialog__estimate">
						{{
							'pptx.print.pageEstimate' | translate: { pages: pageCount(), slides: slideCount() }
						}}
					</span>
					<div class="pptx-ng-print-dialog__actions">
						<button type="button" class="pptx-ng-print-dialog__btn" (click)="onCancel()">
							{{ 'pptx.common.cancel' | translate }}
						</button>
						<button
							type="button"
							class="pptx-ng-print-dialog__btn pptx-ng-print-dialog__btn--primary"
							(click)="onConfirm()"
						>
							{{ 'pptx.print.printButton' | translate }}
						</button>
					</div>
				</div>
			</div>
		</div>
	`,
	styles: [
		`
			.pptx-ng-print-dialog__backdrop {
				position: fixed;
				inset: 0;
				z-index: 1200;
				display: flex;
				align-items: center;
				justify-content: center;
				background: rgba(0, 0, 0, 0.6);
				backdrop-filter: blur(2px);
			}

			.pptx-ng-print-dialog {
				display: flex;
				flex-direction: column;
				width: 780px;
				max-width: calc(100vw - 2rem);
				max-height: 90vh;
				border: 1px solid rgba(255, 255, 255, 0.12);
				border-radius: 0.75rem;
				background: #1e1e1e;
				color: #e5e5e5;
				box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
			}

			.pptx-ng-print-dialog__header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 1rem 1.25rem;
				border-bottom: 1px solid rgba(255, 255, 255, 0.1);
			}

			.pptx-ng-print-dialog__title {
				margin: 0;
				font-size: 0.875rem;
				font-weight: 600;
				color: #ffffff;
			}

			.pptx-ng-print-dialog__icon-btn {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 1.75rem;
				height: 1.75rem;
				padding: 0;
				border: 0;
				border-radius: 0.25rem;
				background: transparent;
				color: rgba(255, 255, 255, 0.6);
				font-size: 0.75rem;
				cursor: pointer;
				transition:
					background 0.12s,
					color 0.12s;
			}

			.pptx-ng-print-dialog__icon-btn:hover {
				background: rgba(255, 255, 255, 0.1);
				color: #ffffff;
			}

			.pptx-ng-print-dialog__body {
				flex: 1;
				overflow-y: auto;
				padding: 1rem 1.25rem;
			}

			.pptx-ng-print-dialog__footer {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 0.75rem 1.25rem;
				border-top: 1px solid rgba(255, 255, 255, 0.1);
			}

			.pptx-ng-print-dialog__estimate {
				font-size: 0.75rem;
				color: rgba(255, 255, 255, 0.5);
			}

			.pptx-ng-print-dialog__actions {
				display: flex;
				gap: 0.5rem;
			}

			.pptx-ng-print-dialog__btn {
				padding: 0.5rem 1rem;
				border: 1px solid rgba(255, 255, 255, 0.15);
				border-radius: 0.5rem;
				background: rgba(255, 255, 255, 0.04);
				color: rgba(255, 255, 255, 0.7);
				font-size: 0.8125rem;
				cursor: pointer;
				transition:
					background 0.12s,
					color 0.12s,
					border-color 0.12s;
			}

			.pptx-ng-print-dialog__btn:hover {
				background: rgba(255, 255, 255, 0.1);
				color: #ffffff;
			}

			.pptx-ng-print-dialog__btn--primary {
				border-color: #3b82f6;
				background: #3b82f6;
				color: #ffffff;
			}

			.pptx-ng-print-dialog__btn--primary:hover {
				background: #2f6fd6;
			}

			/*
			 * Mobile: dock the dialog full-width at the bottom as a sheet (rounded
			 * top, dvh-capped height with internal scroll, safe-area padding) so
			 * the 780px desktop card never overflows a phone. Driven by the
			 * .is-mobile class (IsMobileService 768px breakpoint) and mirrored by a
			 * media query as a no-JS fallback.
			 */
			.pptx-ng-print-dialog__backdrop.is-mobile {
				align-items: flex-end;
			}

			.pptx-ng-print-dialog.is-mobile {
				width: 100%;
				max-width: none;
				max-height: 88dvh;
				border-left: none;
				border-right: none;
				border-bottom: none;
				border-top-left-radius: 1rem;
				border-top-right-radius: 1rem;
				border-bottom-left-radius: 0;
				border-bottom-right-radius: 0;
				padding-bottom: max(env(safe-area-inset-bottom), 0px);
			}

			@media (max-width: 767px), (pointer: coarse) {
				.pptx-ng-print-dialog__backdrop {
					align-items: flex-end;
				}

				.pptx-ng-print-dialog {
					width: 100%;
					max-width: none;
					max-height: 88dvh;
					border-left: none;
					border-right: none;
					border-bottom: none;
					border-top-left-radius: 1rem;
					border-top-right-radius: 1rem;
					border-bottom-left-radius: 0;
					border-bottom-right-radius: 0;
					padding-bottom: max(env(safe-area-inset-bottom), 0px);
				}
			}
		`,
	],
})
export class PrintDialogComponent {
	// -------------------------------------------------------------------------
	// Inputs / outputs
	// -------------------------------------------------------------------------

	/** All slides in the current presentation. */
	readonly slides = input.required<PptxSlide[]>();

	/** Zero-based index of the active slide. */
	readonly activeSlideIndex = input.required<number>();

	/** Default slides-per-page from presentation properties. */
	readonly defaultSlidesPerPage = input<number | undefined>(undefined);

	/** Default frame-slides from presentation properties. */
	readonly defaultFrameSlides = input<boolean | undefined>(undefined);

	/** Emits the resolved, validated settings when the user clicks Print. */
	readonly print = output<PrintSettings>();

	/** Emits when the dialog is dismissed (Cancel / Escape / backdrop). */
	readonly cancel = output<void>();

	/** Reactive viewport / pointer flags (drives the bottom-sheet layout). */
	protected readonly mobile = inject(IsMobileService);

	/**
	 * Dialog class list: gains the `is-mobile` bottom-sheet modifier under the
	 * mobile breakpoint. See {@link printDialogClass}.
	 */
	protected readonly dialogClass = computed(() => printDialogClass(this.mobile.isMobile()));

	// -------------------------------------------------------------------------
	// State
	// -------------------------------------------------------------------------

	/** Authoritative print settings, seeded from defaults. */
	readonly settings = signal<PrintSettings>({ ...DEFAULT_PRINT_SETTINGS });

	private _seeded = false;

	constructor() {
		// Seed settings from presentation defaults once, then leave user edits
		// untouched. Custom-range "to" defaults to the last slide.
		effect(() => {
			if (this._seeded) {
				return;
			}
			this._seeded = true;
			const total = this.slides().length;
			this.settings.set({
				...DEFAULT_PRINT_SETTINGS,
				slidesPerPage: normalizeSlidesPerPage(this.defaultSlidesPerPage()),
				frameSlides: this.defaultFrameSlides() ?? false,
				customRangeFrom: 1,
				customRangeTo: Math.max(1, total),
			});
		});
	}

	// -------------------------------------------------------------------------
	// Derived
	// -------------------------------------------------------------------------

	/** Number of slides selected by the current range. */
	readonly slideCount = computed<number>(() => {
		const s = this.settings();
		return computeSlideIndices(
			s.slideRange,
			this.activeSlideIndex(),
			this.slides().length,
			s.customRangeFrom,
			s.customRangeTo,
		).length;
	});

	/** Estimated printed page count for the current settings. */
	readonly pageCount = computed<number>(() => {
		const s = this.settings();
		return estimatePageCount(s.printWhat, this.slideCount(), s.slidesPerPage);
	});

	// -------------------------------------------------------------------------
	// Handlers
	// -------------------------------------------------------------------------

	/** Apply a partial patch from the settings panel and re-validate. */
	patch(partial: Partial<PrintSettings>): void {
		const next = validatePrintSettings({ ...this.settings(), ...partial }, this.slides().length);
		this.settings.set(next);
	}

	onConfirm(): void {
		this.print.emit(validatePrintSettings(this.settings(), this.slides().length));
	}

	onCancel(): void {
		this.cancel.emit();
	}

	onBackdropClick(event: MouseEvent): void {
		// Only dismiss when the backdrop itself (not the dialog) is clicked.
		if (event.target === event.currentTarget) {
			this.onCancel();
		}
	}

	@HostListener('document:keydown', ['$event'])
	onKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			this.onCancel();
		}
	}
}
