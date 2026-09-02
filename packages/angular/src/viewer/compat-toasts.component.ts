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

@Component({
	selector: 'pptx-compat-toasts',
	standalone: true,
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (toasts().length > 0) {
			<div
				class="pptx-ng-compat-toasts fixed bottom-4 right-4 z-50 flex max-h-[70vh] w-80 flex-col gap-2 overflow-y-auto"
				data-testid="pptx-compat-toasts"
			>
				<div class="flex items-center justify-between px-1">
					<span class="text-xs font-semibold text-foreground">{{
						'pptx.compatibility.toastTitle' | translate
					}}</span>
					@if (toasts().length > 1) {
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
}
