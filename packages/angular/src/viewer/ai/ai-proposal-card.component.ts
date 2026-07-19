/**
 * AiProposalCardComponent: a single staged, not-yet-applied write from the
 * assistant. Shows a short diff summary with Accept / Reject controls. Purely
 * presentational; the accept/reject outputs route through the proposal store.
 * Mirrors React's `AiProposalCard`.
 */
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideCheck, LucideX } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

import type { ProposalView } from '../../internal/shared-ai';

const MAX_SUMMARY_LINES = 4;

@Component({
	selector: 'pptx-ai-proposal-card',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe, LucideCheck, LucideX],
	template: `
		<div class="rounded-md border border-primary/40 bg-primary/5 p-2.5">
			<div class="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
				{{ 'pptx.ai.proposedChange' | translate }}
			</div>
			<div class="text-[12px] font-medium text-foreground">{{ proposal().label }}</div>
			@if (shown().length > 0) {
				<ul class="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
					@for (line of shown(); track $index) {
						<li class="truncate" [title]="line">{{ line }}</li>
					}
					@if (extra() > 0) {
						<li class="italic">
							{{ 'pptx.ai.moreChanges' | translate: { count: extra() } }}
						</li>
					}
				</ul>
			}
			<div class="mt-2 flex items-center gap-2">
				<button
					type="button"
					(click)="accept.emit(proposal().id)"
					class="inline-flex items-center gap-1 rounded-sm bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
				>
					<svg lucideCheck class="h-3.5 w-3.5"></svg>
					{{ 'pptx.ai.accept' | translate }}
				</button>
				<button
					type="button"
					(click)="reject.emit(proposal().id)"
					class="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent"
				>
					<svg lucideX class="h-3.5 w-3.5"></svg>
					{{ 'pptx.ai.reject' | translate }}
				</button>
			</div>
		</div>
	`,
})
export class AiProposalCardComponent {
	readonly proposal = input.required<ProposalView>();
	readonly accept = output<string>();
	readonly reject = output<string>();

	protected readonly shown = computed(() => this.proposal().summary.slice(0, MAX_SUMMARY_LINES));
	protected readonly extra = computed(() => this.proposal().summary.length - this.shown().length);
}
