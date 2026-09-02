/**
 * AiFocusBarComponent: the strip under the panel header showing the assistant's
 * current focused targets as chips (live from the canvas selection, pinned, or
 * picked). Angular port of React's `AiFocusBar`.
 *
 * It also hosts the explicit "Point at a slide element" affordance: a crosshair
 * button that enters PICK MODE, after which the user clicks element(s) on the
 * canvas to hand them to the assistant (each pick is highlighted on the slide).
 * A one-click "Merge selected tables" directive surfaces when the focus is
 * exactly two tables. Reads/writes the shared {@link AiPanelStore}; emits the
 * merge directive up to the conversation so it routes through the chat send.
 */
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { LucideCrosshair, LucideGitMerge, LucidePin, LucidePinOff, LucideX } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxSlide } from 'pptx-viewer-core';

import { focusTargetChips, isTwoTableFocus, mergeTablesDirective } from '../../internal/shared-ai';
import { AiPanelStore } from './ai-panel-store';

@Component({
	selector: 'pptx-ai-focus-bar',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe, LucideCrosshair, LucideGitMerge, LucidePin, LucidePinOff, LucideX],
	template: `
		<div class="border-b border-border bg-secondary/30">
			<div class="flex flex-wrap items-center gap-1 px-2.5 py-1.5">
				<span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
					{{ 'pptx.ai.focusScope' | translate }}
				</span>
				@for (chip of chips(); track chip.key) {
					<span
						[class]="
							store.hasPicks() || store.isPinned()
								? 'inline-flex max-w-[10rem] items-center rounded-full px-2 py-0.5 text-[11px] bg-primary/15 text-primary'
								: 'inline-flex max-w-[10rem] items-center rounded-full px-2 py-0.5 text-[11px] bg-muted text-muted-foreground'
						"
						[title]="chip.title"
					>
						<span class="truncate">{{ chip.label }}</span>
					</span>
				}
				@if (store.isPinned()) {
					<span
						class="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary"
					>
						{{ 'pptx.ai.pinnedFocus' | translate }}
					</span>
				}
				<div class="ml-auto flex items-center gap-0.5">
					@if (twoTables(); as tt) {
						<button
							type="button"
							(click)="onMerge(tt)"
							class="inline-flex items-center gap-1 rounded-sm bg-primary/90 px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground hover:bg-primary"
						>
							<svg lucideGitMerge class="h-3 w-3"></svg>
							{{ 'pptx.ai.mergeSelectedTables' | translate }}
						</button>
					}
					<button
						type="button"
						(click)="store.pickMode() ? store.stopPicking() : store.startPicking()"
						[title]="'pptx.ai.pickElement' | translate"
						[attr.aria-label]="'pptx.ai.pickAria' | translate"
						[attr.aria-pressed]="store.pickMode()"
						[class]="
							store.pickMode()
								? 'rounded-sm p-1 bg-primary text-primary-foreground'
								: 'rounded-sm p-1 text-muted-foreground hover:bg-accent'
						"
					>
						<svg lucideCrosshair class="h-3.5 w-3.5"></svg>
					</button>
					@if (store.hasPicks()) {
						<button
							type="button"
							(click)="store.clearPicks()"
							[title]="'pptx.ai.pickClear' | translate"
							[attr.aria-label]="'pptx.ai.pickClear' | translate"
							class="rounded-sm p-1 text-muted-foreground hover:bg-accent"
						>
							<svg lucideX class="h-3.5 w-3.5"></svg>
						</button>
					} @else {
						<button
							type="button"
							(click)="store.isPinned() ? store.clearPinnedFocus() : store.pinFocus()"
							[title]="(store.isPinned() ? 'pptx.ai.clearFocus' : 'pptx.ai.pinFocus') | translate"
							[attr.aria-label]="
								(store.isPinned() ? 'pptx.ai.clearFocus' : 'pptx.ai.pinFocus') | translate
							"
							class="rounded-sm p-1 text-muted-foreground hover:bg-accent"
						>
							@if (store.isPinned()) {
								<svg lucidePinOff class="h-3.5 w-3.5"></svg>
							} @else {
								<svg lucidePin class="h-3.5 w-3.5"></svg>
							}
						</button>
					}
				</div>
			</div>
			@if (store.pickMode()) {
				<div class="flex items-center gap-2 border-t border-primary/20 bg-primary/5 px-2.5 py-1">
					<svg lucideCrosshair class="h-3.5 w-3.5 shrink-0 animate-pulse text-primary"></svg>
					<span class="text-[11px] font-medium text-primary">
						{{ 'pptx.ai.pickElementHint' | translate }}
					</span>
					<button
						type="button"
						(click)="store.stopPicking()"
						class="ml-auto rounded-sm bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
					>
						{{ 'pptx.ai.pickDone' | translate }}
					</button>
				</div>
			}
		</div>
	`,
})
export class AiFocusBarComponent {
	/** Live deck, for resolving element chip labels + the two-table detection. */
	readonly slides = input.required<readonly PptxSlide[]>();
	/** Emitted with a ready-to-send directive (e.g. the merge-tables request). */
	readonly sendDirective = output<string>();

	protected readonly store = inject(AiPanelStore);

	protected readonly chips = computed(() =>
		focusTargetChips(this.store.effectiveTargets(), this.slides()),
	);
	protected readonly twoTables = computed(() =>
		isTwoTableFocus(this.store.effectiveTargets(), this.slides()),
	);

	protected onMerge(tt: { slideIndex: number; elementIdA: string; elementIdB: string }): void {
		this.sendDirective.emit(mergeTablesDirective(tt.slideIndex, tt.elementIdA, tt.elementIdB));
	}
}
