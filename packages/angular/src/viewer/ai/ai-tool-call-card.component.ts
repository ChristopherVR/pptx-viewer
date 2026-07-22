/**
 * AiToolCallCardComponent: a subtle, non-technical "activity" row describing one
 * thing the assistant did, e.g. "Looked at slide 5" / "Merged two tables", with
 * a friendly icon and a status (working / done / failed). The raw tool name +
 * arguments are hidden behind a collapsed "Details" disclosure for power users,
 * and no element ids are shown by default. Purely presentational; mirrors
 * React's round-3 `AiToolCallCard`.
 */
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
	LucideChartColumn,
	LucideCheck,
	LucideEye,
	LucideFilm,
	LucideLayoutTemplate,
	LucideLoaderCircle,
	LucideMove,
	LucideNavigation,
	LucidePalette,
	LucideSearch,
	LucideShapes,
	LucideStickyNote,
	LucideTable,
	LucideTrash2,
	LucideTriangleAlert,
	LucideType,
	LucideWrench,
} from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

import { describeToolActivity, summarizeToolArgs, toolLabel } from '../../internal/shared-ai';
import type { RenderableToolPart } from '../../internal/shared-ai';

@Component({
	selector: 'pptx-ai-tool-call-card',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		TranslatePipe,
		LucideWrench,
		LucideLoaderCircle,
		LucideCheck,
		LucideTriangleAlert,
		LucideEye,
		LucideType,
		LucideShapes,
		LucidePalette,
		LucideTable,
		LucideLayoutTemplate,
		LucideChartColumn,
		LucideMove,
		LucideTrash2,
		LucideSearch,
		LucideNavigation,
		LucideFilm,
		LucideStickyNote,
	],
	template: `
		<div class="text-[12px]">
			<div class="flex items-center gap-1.5">
				@switch (icon()) {
					@case ('view') {
						<svg lucideEye [class]="iconClass()"></svg>
					}
					@case ('text') {
						<svg lucideType [class]="iconClass()"></svg>
					}
					@case ('shape') {
						<svg lucideShapes [class]="iconClass()"></svg>
					}
					@case ('theme') {
						<svg lucidePalette [class]="iconClass()"></svg>
					}
					@case ('table') {
						<svg lucideTable [class]="iconClass()"></svg>
					}
					@case ('slide') {
						<svg lucideLayoutTemplate [class]="iconClass()"></svg>
					}
					@case ('chart') {
						<svg lucideChartColumn [class]="iconClass()"></svg>
					}
					@case ('move') {
						<svg lucideMove [class]="iconClass()"></svg>
					}
					@case ('delete') {
						<svg lucideTrash2 [class]="iconClass()"></svg>
					}
					@case ('search') {
						<svg lucideSearch [class]="iconClass()"></svg>
					}
					@case ('nav') {
						<svg lucideNavigation [class]="iconClass()"></svg>
					}
					@case ('animation') {
						<svg lucideFilm [class]="iconClass()"></svg>
					}
					@case ('notes') {
						<svg lucideStickyNote [class]="iconClass()"></svg>
					}
					@default {
						<svg lucideWrench [class]="iconClass()"></svg>
					}
				}
				<span [class]="failed() ? 'truncate text-destructive' : 'truncate text-foreground'">
					{{ activityLabel() }}
				</span>
				<span
					[class]="
						failed()
							? 'ml-auto inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] bg-destructive/15 text-destructive'
							: done()
								? 'ml-auto inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] bg-primary/10 text-primary'
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
			@if (failed() && part().errorText) {
				<div class="mt-1 pl-5 text-[11px] text-destructive">{{ part().errorText }}</div>
			}
			@if (rawSummary()) {
				<details class="group mt-0.5 pl-5">
					<summary
						class="cursor-pointer list-none text-[10px] text-muted-foreground/70 hover:text-muted-foreground"
					>
						{{ 'pptx.ai.toolDetails' | translate }}
					</summary>
					<div class="mt-0.5 break-words font-mono text-[10px] text-muted-foreground/80">
						{{ rawLabel() }}: {{ rawSummary() }}
					</div>
				</details>
			}
		</div>
	`,
})
export class AiToolCallCardComponent {
	readonly part = input.required<RenderableToolPart>();

	protected readonly failed = computed(() => this.part().state === 'output-error');
	protected readonly done = computed(() => this.part().state === 'output-available');
	protected readonly running = computed(() => !this.failed() && !this.done());

	/** Friendly, non-technical activity ("Looked at slide 5"); never leaks ids. */
	private readonly activity = computed(() =>
		describeToolActivity(
			this.part().toolName,
			this.part().input,
			this.running() ? 'present' : 'past',
		),
	);
	protected readonly icon = computed(() => this.activity().icon);
	protected readonly activityLabel = computed(() => this.activity().label);

	/** Raw tool name + arg summary, only shown inside the collapsed disclosure. */
	protected readonly rawSummary = computed(() => summarizeToolArgs(this.part().input));
	protected readonly rawLabel = computed(() => toolLabel(this.part().toolName));

	protected readonly iconClass = computed(() =>
		this.failed()
			? 'h-3.5 w-3.5 shrink-0 text-destructive'
			: 'h-3.5 w-3.5 shrink-0 text-muted-foreground',
	);

	protected readonly statusKey = computed(() =>
		this.failed() ? 'pptx.ai.toolFailed' : this.done() ? 'pptx.ai.toolDone' : 'pptx.ai.toolRunning',
	);
}
