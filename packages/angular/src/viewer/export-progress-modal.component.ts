/**
 * export-progress-modal.component.ts: progress overlay shown while a multi-slide
 * export (PDF / GIF / WebM) runs.
 *
 * Selector: `pptx-export-progress-modal`
 *
 * Mirrors React's `ExportProgressModal` and the Vue `ExportProgressModal.vue`: a
 * centered card with a determinate progress bar, a status line, and a Cancel
 * button. It is deliberately NOT dismissable by backdrop click or Escape - an
 * export in flight should only end by completing, erroring, or the user pressing
 * Cancel (which emits `cancel`; the host aborts the `AbortController` the export
 * loop checks between slides and clears `open`).
 *
 * Usage:
 * ```html
 * <pptx-export-progress-modal
 *   [open]="exportModalOpen()"
 *   [title]="exportModalTitle()"
 *   [progress]="exportProgress()"
 *   [statusMessage]="exportStatusMessage()"
 *   (cancel)="onCancelExport()"
 * />
 * ```
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { clampPercent } from '../internal/shared';

@Component({
	selector: 'pptx-export-progress-modal',
	standalone: true,
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (open()) {
			<div
				class="pptx-ng-export-progress__backdrop"
				role="dialog"
				aria-modal="true"
				[attr.aria-label]="title()"
			>
				<div class="pptx-ng-export-progress">
					<h3 class="pptx-ng-export-progress__title">{{ title() }}</h3>

					<div class="pptx-ng-export-progress__track">
						<div class="pptx-ng-export-progress__fill" [style.width.%]="clampedProgress()"></div>
					</div>

					<div class="pptx-ng-export-progress__status">
						<span>{{ statusMessage() || ('pptx.export.processing' | translate) }}</span>
						<span class="pptx-ng-export-progress__pct">{{ clampedProgress() }}%</span>
					</div>

					<div class="pptx-ng-export-progress__actions">
						<button type="button" class="pptx-ng-export-progress__btn" (click)="cancel.emit()">
							{{ 'pptx.export.cancel' | translate }}
						</button>
					</div>
				</div>
			</div>
		}
	`,
	styles: [
		`
			.pptx-ng-export-progress__backdrop {
				position: fixed;
				inset: 0;
				z-index: 1200;
				display: flex;
				align-items: center;
				justify-content: center;
				background: rgba(0, 0, 0, 0.6);
				backdrop-filter: blur(2px);
			}

			.pptx-ng-export-progress {
				display: flex;
				flex-direction: column;
				width: min(92vw, 384px);
				padding: 1.5rem;
				border: 1px solid rgba(255, 255, 255, 0.12);
				border-radius: 0.75rem;
				background: #1e1e1e;
				color: #e5e5e5;
				box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
			}

			.pptx-ng-export-progress__title {
				margin: 0 0 1rem;
				font-size: 0.875rem;
				font-weight: 600;
				color: #ffffff;
			}

			.pptx-ng-export-progress__track {
				width: 100%;
				height: 0.625rem;
				margin-bottom: 0.75rem;
				overflow: hidden;
				border-radius: 9999px;
				background: rgba(255, 255, 255, 0.12);
			}

			.pptx-ng-export-progress__fill {
				height: 100%;
				border-radius: 9999px;
				background: #2563eb;
				transition: width 300ms ease-out;
			}

			.pptx-ng-export-progress__status {
				display: flex;
				align-items: center;
				justify-content: space-between;
				margin-bottom: 1rem;
				font-size: 0.75rem;
				color: rgba(255, 255, 255, 0.6);
			}

			.pptx-ng-export-progress__pct {
				font-variant-numeric: tabular-nums;
			}

			.pptx-ng-export-progress__actions {
				display: flex;
				justify-content: flex-end;
			}

			.pptx-ng-export-progress__btn {
				padding: 0.375rem 1rem;
				font-size: 0.75rem;
				color: #e5e5e5;
				border: 1px solid rgba(255, 255, 255, 0.16);
				border-radius: 0.375rem;
				background: rgba(255, 255, 255, 0.06);
				cursor: pointer;
				transition: background 150ms ease;
			}

			.pptx-ng-export-progress__btn:hover {
				background: rgba(255, 255, 255, 0.12);
			}
		`,
	],
})
export class ExportProgressModalComponent {
	/** Whether the overlay is visible. */
	readonly open = input<boolean>(false);
	/** Heading shown at the top (e.g. "Export as PDF"). */
	readonly title = input<string>('');
	/** Current progress, 0-100. */
	readonly progress = input<number>(0);
	/** Optional status line (e.g. "Rendering slide 3 of 10..."). */
	readonly statusMessage = input<string>('');

	/** Emitted when the user presses Cancel. */
	readonly cancel = output<void>();

	/** Progress clamped to the inclusive `[0, 100]` integer range for display. */
	readonly clampedProgress = computed(() => clampPercent(this.progress()));
}
