/**
 * readonly-banner.component.ts: Read-only recommendation banner.
 *
 * Selector: `pptx-readonly-banner`
 *
 * Purely presentational: {@link LoadNoticesService} decides WHETHER a deck
 * recommends read-only (`p:modifyVerifier` / "Mark as Final", see shared's
 * `read-only-recommendation.ts`) and which message key to show; this
 * component only renders that decision and forwards the two button clicks.
 *
 * @module viewer/readonly-banner
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { ReadOnlyRecommendationKind } from '../internal/shared';

@Component({
	selector: 'pptx-readonly-banner',
	standalone: true,
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div
			class="pptx-ng-readonly-banner flex items-center gap-3 border-b border-amber-700/30 bg-amber-900/20 px-4 py-2"
			data-testid="pptx-readonly-banner"
			[attr.data-kind]="kind()"
			role="status"
		>
			<span class="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true">&#128274;</span>
			<p class="flex-1 text-xs text-amber-200">
				<strong>{{ 'pptx.readOnly.bannerTitle' | translate }}</strong
				>: {{ messageKey() | translate }}
			</p>
			<button
				type="button"
				data-testid="pptx-readonly-edit-anyway"
				class="shrink-0 rounded border border-amber-600/50 px-3 py-1 text-xs font-medium text-amber-100 transition-colors hover:bg-amber-700/30"
				(click)="editAnyway.emit()"
			>
				{{ 'pptx.readOnly.editAnyway' | translate }}
			</button>
			<button
				type="button"
				data-testid="pptx-readonly-dismiss"
				class="shrink-0 rounded border border-transparent px-2 py-1 text-xs text-amber-200/80 transition-colors hover:text-amber-100"
				(click)="dismiss.emit()"
			>
				{{ 'pptx.readOnly.dismiss' | translate }}
			</button>
		</div>
	`,
})
export class ReadOnlyBannerComponent {
	/** `ReadOnlyRecommendation.kind`; mirrored onto `data-kind` for the e2e spec. */
	readonly kind = input.required<ReadOnlyRecommendationKind>();
	/** `ReadOnlyRecommendation.messageKey`. */
	readonly messageKey = input.required<string>();
	/** "Edit anyway": lift the lock and hide the banner. */
	readonly editAnyway = output<void>();
	/** "Dismiss": hide the banner, keep the lock. */
	readonly dismiss = output<void>();
}
