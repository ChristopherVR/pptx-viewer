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
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import {
	LucideColumns2,
	LucideMinus,
	LucideMonitor,
	LucidePlus,
	LucidePresentation,
	LucideStickyNote,
} from '@lucide/angular';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import type { ToolbarActionId } from '../internal/shared';
import type { AutosaveStatus } from './autosave.service';
import { toolbarVisibility } from './toolbar-visibility';

@Component({
	selector: 'pptx-status-bar',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		NgClass,
		TranslatePipe,
		LucideStickyNote,
		LucideMonitor,
		LucideColumns2,
		LucidePresentation,
		LucideMinus,
		LucidePlus,
	],
	template: `
		<div
			class="flex w-full items-center gap-1 border-t border-border bg-secondary/50 px-2 py-0.5 text-[10px] text-muted-foreground"
		>
			<!-- Left: slide counter + language + save state -->
			<span class="shrink-0">
				{{
					slideCount() > 0
						? ('pptx.statusBar.slideOf'
							| translate: { current: min(slideIndex() + 1, slideCount()), total: slideCount() })
						: ('pptx.statusBar.noSlides' | translate)
				}}
			</span>

			<div class="mx-1 h-3 w-px bg-border/40 max-md:hidden"></div>
			<span class="shrink-0 text-[10px] max-md:hidden">{{
				'pptx.statusBar.language' | translate
			}}</span>

			<div class="mx-1 h-3 w-px bg-border/60 max-md:hidden"></div>
			<span class="shrink-0 max-md:hidden" [ngClass]="saveStateClass()">{{
				saveStatusText()
			}}</span>

			<!-- Center spacer -->
			<div class="flex-1"></div>

			<!-- Notes toggle -->
			@if (!toolbar.isHidden('notes')) {
				<button
					type="button"
					class="flex items-center gap-1 rounded-sm p-1 text-[10px] text-muted-foreground transition-colors hover:bg-accent/60"
					[ngClass]="notesOpen() ? 'text-primary' : ''"
					[title]="'pptx.statusBar.toggleNotes' | translate"
					[attr.aria-label]="'pptx.statusBar.toggleNotes' | translate"
					(click)="toggleNotes.emit()"
				>
					<svg lucideStickyNote class="h-3 w-3"></svg>
					<span>{{ 'pptx.notes.title' | translate }}</span>
				</button>
			}

			<div class="mx-0.5 h-3 w-px bg-border/60"></div>

			<!-- View-mode toggles: Normal / Slide Sorter / Slide Show -->
			<div class="flex items-center gap-0.5">
				<button
					type="button"
					class="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent/60"
					[ngClass]="isNormal() ? 'text-primary' : ''"
					[title]="'pptx.statusBar.normalView' | translate"
					[attr.aria-label]="'pptx.statusBar.normalView' | translate"
					(click)="normalView.emit()"
				>
					<svg lucideMonitor class="h-3.5 w-3.5"></svg>
				</button>
				<button
					type="button"
					class="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent/60"
					[ngClass]="sorterActive() ? 'text-primary' : ''"
					[title]="'pptx.statusBar.slideSorter' | translate"
					[attr.aria-label]="'pptx.statusBar.slideSorter' | translate"
					(click)="openSorter.emit()"
				>
					<svg lucideColumns2 class="h-3.5 w-3.5"></svg>
				</button>
				@if (!toolbar.isHidden('fullscreen')) {
					<button
						type="button"
						class="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent/60"
						[ngClass]="presenting() ? 'text-primary' : ''"
						[title]="'pptx.statusBar.slideShow' | translate"
						[attr.aria-label]="'pptx.statusBar.slideShow' | translate"
						(click)="slideShow.emit()"
					>
						<svg lucidePresentation class="h-3.5 w-3.5"></svg>
					</button>
				}
			</div>

			<!--
				Collaboration status slot (React parity: sits between the view-mode
				cluster and the zoom cluster). Exposed for hosts / the viewer to
				project a connection-status indicator via [pptxCollabStatus].
			-->
			<ng-content select="[pptxCollabStatus]"></ng-content>

			<!-- Zoom controls -->
			@if (!toolbar.isHidden('zoom')) {
				<div class="mx-0.5 h-3 w-px bg-border/60"></div>
				<div class="flex items-center gap-0.5">
					<button
						type="button"
						class="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent/60"
						[title]="'pptx.statusBar.zoomOut' | translate"
						[attr.aria-label]="'pptx.statusBar.zoomOut' | translate"
						(click)="zoomOut.emit()"
					>
						<svg lucideMinus class="h-3 w-3"></svg>
					</button>
					<button
						type="button"
						class="min-w-[3rem] rounded-sm px-1.5 py-0.5 text-center text-[10px] tabular-nums text-muted-foreground transition-colors hover:bg-accent/60"
						[title]="'pptx.statusBar.zoomToFit' | translate"
						(click)="zoomReset.emit()"
					>
						{{ zoomPercent() }}%
					</button>
					<button
						type="button"
						class="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent/60"
						[title]="'pptx.statusBar.zoomIn' | translate"
						[attr.aria-label]="'pptx.statusBar.zoomIn' | translate"
						(click)="zoomIn.emit()"
					>
						<svg lucidePlus class="h-3 w-3"></svg>
					</button>
				</div>
			}
		</div>
	`,
})
export class StatusBarComponent {
	readonly slideIndex = input<number>(0);
	readonly slideCount = input<number>(0);
	readonly canEdit = input<boolean>(false);
	readonly dirty = input<boolean>(false);
	/** Current autosave engine status; drives the save-state text + colour. */
	readonly autosaveStatus = input<AutosaveStatus | undefined>(undefined);
	readonly notesOpen = input<boolean>(false);
	readonly zoomPercent = input<number>(100);
	/** True when the slide-sorter overlay is open (active-state styling). */
	readonly sorterActive = input<boolean>(false);
	/** True when the presentation overlay is open (active-state styling). */
	readonly presenting = input<boolean>(false);
	/** Toolbar buttons the host wants hidden (notes/fullscreen/zoom independently). */
	readonly hiddenActions = input<ToolbarActionId[]>([]);

	readonly toggleNotes = output<void>();
	readonly normalView = output<void>();
	readonly openSorter = output<void>();
	readonly slideShow = output<void>();
	readonly zoomIn = output<void>();
	readonly zoomOut = output<void>();
	readonly zoomReset = output<void>();

	private readonly translate = inject(TranslateService);
	protected readonly toolbar = toolbarVisibility(this.hiddenActions);

	/** "Normal" is active when neither the sorter nor the slideshow is showing. */
	protected isNormal(): boolean {
		return !this.sorterActive() && !this.presenting();
	}

	protected min(a: number, b: number): number {
		return Math.min(a, b);
	}

	/**
	 * Save-state text next to the slide counter, mirroring React's StatusBar:
	 * autosave saving/saved-time/error take precedence, then the dirty flag, then
	 * "All saved".
	 */
	protected saveStatusText(): string {
		const status = this.autosaveStatus();
		if (status?.state === 'saving') {
			return this.translate.instant('pptx.autosave.saving');
		}
		if (status?.state === 'saved') {
			return this.translate.instant('pptx.autosave.saved', {
				time: this.formatAutosaveAge(status.timestamp),
			});
		}
		if (status?.state === 'error') {
			return this.translate.instant('pptx.autosave.error');
		}
		return this.translate.instant(
			this.dirty() ? 'pptx.statusBar.unsavedChanges' : 'pptx.statusBar.allSaved',
		);
	}

	/** Colour override for the save-state text while saving (yellow) / errored (red). */
	protected saveStateClass(): string {
		const state = this.autosaveStatus()?.state;
		if (state === 'error') {
			return 'text-red-400';
		}
		if (state === 'saving') {
			return 'text-yellow-400';
		}
		return '';
	}

	/** Relative age label for a saved timestamp ("just now" / "N min ago"). */
	private formatAutosaveAge(timestamp: number): string {
		const minutes = Math.floor((Date.now() - timestamp) / 60_000);
		if (minutes < 1) {
			return this.translate.instant('pptx.autosave.justNow');
		}
		if (minutes === 1) {
			return this.translate.instant('pptx.autosave.oneMinAgo');
		}
		return this.translate.instant('pptx.autosave.minutesAgo', { count: minutes });
	}
}
