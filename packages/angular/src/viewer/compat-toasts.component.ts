/**
 * compat-toasts.component.ts: Compatibility-warning toast stack.
 *
 * Selector: `pptx-compat-toasts`
 *
 * Purely presentational: {@link LoadNoticesService} turns
 * `handler.getCompatibilityWarnings()` output into the toast list (shared's
 * `compatibility-warning-toasts.ts`) and owns the dismissed-id state; this
 * component only renders the list bottom-right and forwards dismiss clicks.
 * Toasts are load diagnostics, so they never auto-hide.
 *
 * @module viewer/compat-toasts
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { CompatibilityWarningToast } from '../internal/shared';
import { compatToastStackStyleAttr } from '../internal/shared';

@Component({
	selector: 'pptx-compat-toasts',
	standalone: true,
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (toasts().length > 0) {
			<div
				class="pptx-ng-compat-toasts max-h-[70vh] overflow-y-auto"
				data-testid="pptx-compat-toasts"
				[style]="stackStyle"
			>
				<div class="flex items-center justify-between px-1" style="pointer-events:auto">
					<span class="text-xs font-semibold text-foreground">{{
						'pptx.compatibility.toastTitle' | translate
					}}</span>
					@if (toasts().length > 0) {
						<button
							type="button"
							data-testid="pptx-compat-toasts-dismiss-all"
							class="text-xs text-muted-foreground transition-colors hover:text-foreground"
							(click)="dismissAll.emit()"
						>
							{{ 'pptx.compatibility.dismissAll' | translate }}
						</button>
					}
				</div>
				@for (toast of toasts(); track toast.id) {
					<div
						class="pptx-ng-compat-toast rounded border border-border bg-card px-3 py-2 text-xs shadow-lg"
						data-testid="pptx-compat-toast"
						[attr.data-code]="toast.code"
						[attr.data-severity]="toast.severity"
						role="status"
						style="pointer-events:auto"
					>
						<div class="flex items-start justify-between gap-2">
							<p class="flex-1 text-foreground">{{ toast.messageKey | translate: toast.params }}</p>
							<button
								type="button"
								data-testid="pptx-compat-toast-dismiss"
								class="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
								[attr.aria-label]="'pptx.compatibility.dismiss' | translate"
								(click)="dismissOne.emit(toast.id)"
							>
								&times;
							</button>
						</div>
					</div>
				}
			</div>
		}
	`,
})
export class CompatToastsComponent {
	/** The dismiss-filtered toast list ({@link LoadNoticesService.visibleToasts}). */
	readonly toasts = input.required<readonly CompatibilityWarningToast[]>();
	/** Dismiss one toast by id. */
	readonly dismissOne = output<string>();
	/** Dismiss every visible toast. */
	readonly dismissAll = output<void>();

	/**
	 * The stack's position/size/z-index, from shared's `COMPAT_TOAST_METRICS`
	 * rather than a Tailwind `fixed bottom-* right-*` class. Anchored to the
	 * VIEWER ROOT (`.pptx-ng-viewer`, which is `position: relative`, the same
	 * containing block the dialogs use), bottom-inset above the status bar so
	 * a toast can never cover the status bar's "Slide show" button.
	 */
	readonly stackStyle = compatToastStackStyleAttr();
}
