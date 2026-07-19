/**
 * AiToolCallCardComponent: a compact card describing one tool the assistant
 * invoked, with a human summary of its arguments and a state chip (running /
 * done / failed). Purely presentational; mirrors React's `AiToolCallCard`.
 */
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
	LucideCheck,
	LucideLoaderCircle,
	LucideTriangleAlert,
	LucideWrench,
} from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

import { summarizeToolArgs, toolLabel } from '../../internal/shared-ai';
import type { RenderableToolPart } from '../../internal/shared-ai';

@Component({
	selector: 'pptx-ai-tool-call-card',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe, LucideWrench, LucideLoaderCircle, LucideCheck, LucideTriangleAlert],
	template: `
		<div
			[class]="
				failed()
					? 'rounded-md border px-2.5 py-1.5 text-[12px] border-destructive/50 bg-destructive/5'
					: 'rounded-md border px-2.5 py-1.5 text-[12px] border-border bg-secondary/40'
			"
		>
			<div class="flex items-center gap-1.5">
				<svg lucideWrench class="h-3.5 w-3.5 shrink-0 text-muted-foreground"></svg>
				<span class="font-medium text-foreground">{{ label() }}</span>
				<span
					[class]="
						failed()
							? 'ml-auto inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] bg-destructive/15 text-destructive'
							: done()
								? 'ml-auto inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] bg-primary/15 text-primary'
								: 'ml-auto inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground'
					"
				>
					@if (running()) {
						<svg lucideLoaderCircle class="h-3 w-3 animate-spin"></svg>
					}
					@if (done()) {
						<svg lucideCheck class="h-3 w-3"></svg>
					}
					@if (failed()) {
						<svg lucideTriangleAlert class="h-3 w-3"></svg>
					}
					{{ statusKey() | translate }}
				</span>
			</div>
			@if (summary()) {
				<div class="mt-1 truncate font-mono text-[11px] text-muted-foreground" [title]="summary()">
					{{ summary() }}
				</div>
			}
			@if (failed() && part().errorText) {
				<div class="mt-1 text-[11px] text-destructive">{{ part().errorText }}</div>
			}
		</div>
	`,
})
export class AiToolCallCardComponent {
	readonly part = input.required<RenderableToolPart>();

	protected readonly failed = computed(() => this.part().state === 'output-error');
	protected readonly done = computed(() => this.part().state === 'output-available');
	protected readonly running = computed(() => !this.failed() && !this.done());
	protected readonly label = computed(() => toolLabel(this.part().toolName));
	protected readonly summary = computed(() => summarizeToolArgs(this.part().input));
	protected readonly statusKey = computed(() =>
		this.failed() ? 'pptx.ai.toolFailed' : this.done() ? 'pptx.ai.toolDone' : 'pptx.ai.toolRunning',
	);
}
