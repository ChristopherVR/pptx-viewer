/**
 * AiProposalCardComponent: a single staged, not-yet-applied change the assistant
 * is suggesting. Reads like a human suggestion: a clear title, a plain-language
 * description of what will happen ({@link humanizeDiffLine}), and friendly Apply
 * / Discard buttons. The full description is shown (never truncated); long lists
 * scroll rather than clip. Purely presentational; the accept/reject outputs
 * route through the proposal store. Mirrors React's round-3 `AiProposalCard`.
 */
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideCheck, LucideX } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

import { humanizeDiffLine } from '../../internal/shared-ai';
import type { ProposalView } from '../../internal/shared-ai';

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
			@if (lines().length > 0) {
				<ul class="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-[11px] text-muted-foreground">
					@for (line of lines(); track $index) {
						<li class="break-words">{{ line }}</li>
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

	/** Plain-language description of every staged change (never truncated). */
	protected readonly lines = computed(() => this.proposal().summary.map(humanizeDiffLine));
}
