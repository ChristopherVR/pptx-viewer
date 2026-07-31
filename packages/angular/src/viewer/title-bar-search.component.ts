/**
 * title-bar-search.component.ts: the centred command-search box + results
 * dropdown of the editor title bar.
 *
 * Split out of {@link TitleBarComponent} because the search is the one part of
 * that row with its OWN state machine (query text, focus, blur-delay, Enter /
 * Escape handling) rather than being a pure projection of host inputs; keeping
 * it inline pushed the title bar over the repo's 300 LOC ceiling and mixed two
 * unrelated concerns in one template.
 *
 * The host element carries the positioning classes that the extracted `<div>`
 * used to, so the rendered box is structurally identical to before: no extra
 * wrapper, no `display: contents` (which has repeatedly regressed this chrome).
 */
import { NgClass } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	input,
	output,
	signal,
} from '@angular/core';
import { LucideSearch } from '@lucide/angular';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { filterCommands, TITLE_BAR_CLASSES } from '../internal/shared';
import type { CommandSearchEntry } from '../internal/shared';

/**
 * How long to keep the dropdown alive after the input blurs.
 *
 * The result rows commit on `mousedown`, which fires BEFORE the input's `blur`,
 * but the click that follows would otherwise land on an already-unmounted row.
 * A short grace window lets the press complete; it is deliberately a named
 * constant so the reason survives future tidying.
 */
const BLUR_GRACE_MS = 150;

@Component({
	selector: 'pptx-title-bar-search',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgClass, TranslatePipe, LucideSearch],
	host: { class: 'relative w-full max-w-md' },
	template: `
		<div
			[class]="tb.searchBox"
			[ngClass]="searchFocused() || findReplaceOpen() ? 'text-foreground bg-background' : ''"
		>
			<span [class]="tb.searchIcon" aria-hidden="true"
				><svg lucideSearch class="h-3.5 w-3.5"></svg
			></span>
			<input
				type="text"
				[value]="searchQuery()"
				(input)="searchQuery.set($any($event.target).value)"
				(focus)="searchFocused.set(true)"
				(blur)="onSearchBlur()"
				(keydown)="onSearchKeyDown($event)"
				class="flex-1 bg-transparent text-[11px] outline-none placeholder:text-muted-foreground/60"
				[placeholder]="'pptx.titleBar.searchPlaceholder' | translate"
				[attr.aria-label]="'pptx.titleBar.search' | translate"
			/>
		</div>
		@if (searchFocused() && searchQuery().trim()) {
			<div
				class="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-popover shadow-xl max-h-64 overflow-y-auto"
			>
				@if (commandResults().length > 0) {
					<div
						class="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider"
					>
						{{ 'pptx.titleBar.searchCommands' | translate }}
					</div>
					@for (entry of visibleResults(); track entry.command) {
						<button
							type="button"
							class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
							(mousedown)="selectCommand(entry)"
						>
							<span class="truncate">{{ entry.labelKey | translate }}</span>
							<span class="ml-auto text-[10px] text-muted-foreground capitalize">{{
								entry.category
							}}</span>
						</button>
					}
				} @else {
					<div class="px-3 py-2 text-xs text-muted-foreground">
						{{ 'pptx.titleBar.searchNoResults' | translate }}
					</div>
				}
				<div class="border-t border-border/60">
					<button
						type="button"
						class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
						(mousedown)="requestFindReplace()"
					>
						<svg lucideSearch class="h-3.5 w-3.5"></svg>
						<span
							>{{ 'pptx.titleBar.searchContent' | translate }} &ldquo;{{
								searchQuery()
							}}&rdquo;</span
						>
					</button>
				</div>
			</div>
		}
	`,
})
export class TitleBarSearchComponent {
	/** Whether the Find & Replace panel is open (drives the box's active look). */
	readonly findReplaceOpen = input<boolean>(false);

	/** A command was chosen from the palette (catalog command id). */
	readonly commandSearch = output<string>();
	/** The user asked to search slide CONTENT rather than commands. */
	readonly toggleFindReplace = output<void>();

	private readonly translate = inject(TranslateService);
	protected readonly tb = TITLE_BAR_CLASSES;

	protected readonly searchQuery = signal('');
	protected readonly searchFocused = signal(false);

	protected readonly commandResults = computed(() =>
		filterCommands(this.searchQuery(), (key) => this.translate.instant(key)),
	);

	/** The dropdown shows at most 8 rows so it never outgrows its max height. */
	protected readonly visibleResults = computed(() => this.commandResults().slice(0, 8));

	protected selectCommand(entry: CommandSearchEntry): void {
		this.commandSearch.emit(entry.command);
		this.reset();
	}

	protected requestFindReplace(): void {
		this.toggleFindReplace.emit();
		this.reset();
	}

	protected onSearchBlur(): void {
		setTimeout(() => this.searchFocused.set(false), BLUR_GRACE_MS);
	}

	protected onSearchKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Enter' && this.searchQuery().trim()) {
			const results = this.commandResults();
			if (results.length > 0) {
				this.selectCommand(results[0]);
			} else {
				this.requestFindReplace();
			}
		} else if (event.key === 'Escape') {
			this.reset();
		}
	}

	/** Clear the query and close the dropdown (shared by every commit path). */
	private reset(): void {
		this.searchQuery.set('');
		this.searchFocused.set(false);
	}
}
