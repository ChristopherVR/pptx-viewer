import { NgClass } from '@angular/common';
/**
 * status-bar.component.ts: bottom status bar for the Angular editor chrome,
 * at parity with React's `viewer/components/StatusBar.tsx`.
 *
 * Layout (mirrors React):
 *   LEFT  : "Slide X of Y" | language | save state ("All saved" / "Unsaved...")
 *   RIGHT : Notes toggle | view-mode toggles (Normal / Slide Sorter / Slide
 *           Show) | zoom-out / percent / zoom-in
 *
 * Purely presentational + `OnPush`; every action is an `output()` the
 * {@link PowerPointViewerComponent} already has handlers for. Slide-nav and
 * zoom live here (not in the top bar), matching React.
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
	selector: 'pptx-status-bar',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgClass],
	template: `
		<div
			class="flex w-full items-center gap-1 border-t border-border bg-secondary/50 px-2 py-0.5 text-[10px] text-muted-foreground"
		>
			<!-- Left: slide counter + language + save state -->
			<span class="shrink-0">
				{{
					slideCount() > 0
						? 'Slide ' + min(slideIndex() + 1, slideCount()) + ' of ' + slideCount()
						: 'No slides'
				}}
			</span>

			<div class="mx-1 h-3 w-px bg-border/40"></div>
			<span class="shrink-0 text-[10px]">English (U.S.)</span>

			@if (canEdit()) {
				<div class="mx-1 h-3 w-px bg-border/60"></div>
				<span class="shrink-0">{{ dirty() ? 'Unsaved changes' : 'All saved' }}</span>
			}

			<!-- Center spacer -->
			<div class="flex-1"></div>

			<!-- Notes toggle -->
			<button
				type="button"
				class="flex items-center gap-1 rounded-sm p-1 text-[10px] text-muted-foreground transition-colors hover:bg-accent/60"
				[ngClass]="notesOpen() ? 'text-primary' : ''"
				title="Speaker notes"
				aria-label="Toggle speaker notes"
				(click)="toggleNotes.emit()"
			>
				<span aria-hidden="true">🗒</span>
				<span>Notes</span>
			</button>

			<div class="mx-0.5 h-3 w-px bg-border/60"></div>

			<!-- View-mode toggles: Normal / Slide Sorter / Slide Show -->
			<div class="flex items-center gap-0.5">
				<button
					type="button"
					class="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent/60"
					[ngClass]="isNormal() ? 'text-primary' : ''"
					title="Normal view"
					aria-label="Normal view"
					(click)="normalView.emit()"
				>
					<span aria-hidden="true">🖵</span>
				</button>
				<button
					type="button"
					class="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent/60"
					[ngClass]="sorterActive() ? 'text-primary' : ''"
					title="Slide sorter"
					aria-label="Slide sorter"
					(click)="openSorter.emit()"
				>
					<span aria-hidden="true">▦</span>
				</button>
				<button
					type="button"
					class="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent/60"
					[ngClass]="presenting() ? 'text-primary' : ''"
					[disabled]="slideCount() === 0"
					title="Slide show"
					aria-label="Slide show"
					(click)="slideShow.emit()"
				>
					<span aria-hidden="true">▶</span>
				</button>
			</div>

			<!-- Zoom controls -->
			<div class="mx-0.5 h-3 w-px bg-border/60"></div>
			<div class="flex items-center gap-0.5">
				<button
					type="button"
					class="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent/60"
					title="Zoom out"
					aria-label="Zoom out"
					(click)="zoomOut.emit()"
				>
					<span aria-hidden="true">−</span>
				</button>
				<button
					type="button"
					class="min-w-[3rem] rounded-sm px-1.5 py-0.5 text-center text-[10px] tabular-nums text-muted-foreground transition-colors hover:bg-accent/60"
					title="Reset zoom"
					(click)="zoomReset.emit()"
				>
					{{ zoomPercent() }}%
				</button>
				<button
					type="button"
					class="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent/60"
					title="Zoom in"
					aria-label="Zoom in"
					(click)="zoomIn.emit()"
				>
					<span aria-hidden="true">+</span>
				</button>
			</div>
		</div>
	`,
})
export class StatusBarComponent {
	readonly slideIndex = input<number>(0);
	readonly slideCount = input<number>(0);
	readonly canEdit = input<boolean>(false);
	readonly dirty = input<boolean>(false);
	readonly notesOpen = input<boolean>(false);
	readonly zoomPercent = input<number>(100);
	/** True when the slide-sorter overlay is open (active-state styling). */
	readonly sorterActive = input<boolean>(false);
	/** True when the presentation overlay is open (active-state styling). */
	readonly presenting = input<boolean>(false);

	readonly toggleNotes = output<void>();
	readonly normalView = output<void>();
	readonly openSorter = output<void>();
	readonly slideShow = output<void>();
	readonly zoomIn = output<void>();
	readonly zoomOut = output<void>();
	readonly zoomReset = output<void>();

	/** "Normal" is active when neither the sorter nor the slideshow is showing. */
	protected isNormal(): boolean {
		return !this.sorterActive() && !this.presenting();
	}

	protected min(a: number, b: number): number {
		return Math.min(a, b);
	}
}
