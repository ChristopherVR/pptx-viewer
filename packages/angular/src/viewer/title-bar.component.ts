/**
 * title-bar.component.ts: PowerPoint-style top chrome row for the Angular
 * editor, at parity with React's `viewer/components/toolbar/TitleBar.tsx`.
 *
 * Renders (left to right): the square "P" app mark, an AutoSave label + switch
 * toggle + On/Off text, quick-access Save/Undo/Redo icon buttons, the open
 * document's name + a save-location status (resolved via the shared
 * {@link resolveTitleBarStatusKey}), and a centred search button that opens
 * Find & Replace. Rendered ABOVE and OUTSIDE the ribbon's `role="toolbar"`
 * container so the toolbar height stays measurable for the e2e parity spec.
 *
 * Purely presentational + `OnPush`: every action is an `output()` the
 * {@link PowerPointViewerComponent} already has handlers for. Class tokens come
 * verbatim from the shared {@link TITLE_BAR_CLASSES} so the three bindings stay
 * pixel-identical. The host is a plain block (no `display:contents`) so the row
 * renders as one 36px flex strip.
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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import {
	filterCommands,
	resolveTitleBarStatusKey,
	TITLE_BAR_CLASSES,
	TITLE_BAR_DEFAULT_FILE_KEY,
} from '../internal/shared';
import type { CommandSearchEntry } from '../internal/shared';
import type { AutosaveStatus } from './autosave.service';

@Component({
	selector: 'pptx-title-bar',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgClass, TranslatePipe],
	template: `
		<div [class]="tb.container" data-pptx-title-bar>
			<span [class]="tb.logo" aria-hidden="true">P</span>

			@if (canEdit()) {
				<span [class]="tb.autosaveGroup">
					<span [class]="tb.autosaveLabel">{{ 'pptx.titleBar.autoSave' | translate }}</span>
					<button
						type="button"
						role="switch"
						[attr.aria-checked]="autosaveEnabled()"
						[class]="tb.toggleTrack"
						[ngClass]="autosaveEnabled() ? tb.toggleTrackOn : tb.toggleTrackOff"
						[title]="'pptx.titleBar.toggleAutoSave' | translate"
						[attr.aria-label]="'pptx.titleBar.toggleAutoSave' | translate"
						(click)="toggleAutosave.emit()"
					>
						<span
							[class]="tb.toggleKnob"
							[ngClass]="autosaveEnabled() ? tb.toggleKnobOn : tb.toggleKnobOff"
						></span>
					</button>
					<span [class]="tb.autosaveLabel">{{
						(autosaveEnabled() ? 'pptx.titleBar.autoSaveOn' : 'pptx.titleBar.autoSaveOff')
							| translate
					}}</span>
				</span>

				<div [class]="tb.separator"></div>

				<button
					type="button"
					[class]="tb.quickButton"
					[title]="'pptx.titleBar.save' | translate"
					[attr.aria-label]="'pptx.titleBar.save' | translate"
					(click)="save.emit()"
				>
					💾
				</button>
				<button
					type="button"
					[class]="tb.quickButton"
					[disabled]="!canUndo()"
					[title]="
						undoLabel()
							? ('pptx.toolbar.undoAction' | translate: { action: undoLabel() })
							: ('pptx.toolbar.undo' | translate)
					"
					[attr.aria-label]="'pptx.toolbar.undo' | translate"
					(click)="undo.emit()"
				>
					↶
				</button>
				<button
					type="button"
					[class]="tb.quickButton"
					[disabled]="!canRedo()"
					[title]="
						redoLabel()
							? ('pptx.toolbar.redoAction' | translate: { action: redoLabel() })
							: ('pptx.toolbar.redo' | translate)
					"
					[attr.aria-label]="'pptx.toolbar.redo' | translate"
					(click)="redo.emit()"
				>
					↷
				</button>

				<div [class]="tb.separator"></div>
			}

			<span [class]="tb.fileGroup">
				<span [class]="tb.fileName">{{ fileName() || (defaultFileKey | translate) }}</span>
				@if (canEdit()) {
					<span [class]="tb.statusDot" aria-hidden="true">&bull;</span>
					<span [class]="tb.statusText" [ngClass]="statusStateClass()">{{
						statusKey() | translate
					}}</span>
				}
			</span>

			<span [class]="tb.searchWrap">
				@if (canEdit()) {
					<div class="relative w-full max-w-md">
						<div
							[class]="tb.searchBox"
							[ngClass]="
								searchFocused() || findReplaceOpen() ? 'text-foreground bg-background' : ''
							"
						>
							<span [class]="tb.searchIcon" aria-hidden="true">⌕</span>
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
									@for (entry of commandResults().slice(0, 8); track entry.command) {
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
										(mousedown)="openFindReplace()"
									>
										<span aria-hidden="true">⌕</span>
										<span
											>{{ 'pptx.titleBar.searchContent' | translate }} &ldquo;{{
												searchQuery()
											}}&rdquo;</span
										>
									</button>
								</div>
							</div>
						}
					</div>
				}
			</span>

			<span [class]="tb.rightSpacer"></span>
		</div>
	`,
})
export class TitleBarComponent {
	/** Whether the deck is editable (gates the autosave/quick-access/search chrome). */
	readonly canEdit = input<boolean>(false);
	/** Display name of the open document (host-supplied). */
	readonly fileName = input<string | undefined>(undefined);
	/** Whether the document has unsaved changes. */
	readonly isDirty = input<boolean>(false);
	/** Current autosave engine status (drives the save-location text). */
	readonly autosaveStatus = input<AutosaveStatus | undefined>(undefined);
	/** Whether the AutoSave toggle is on. */
	readonly autosaveEnabled = input<boolean>(true);
	readonly canUndo = input<boolean>(false);
	readonly canRedo = input<boolean>(false);
	readonly undoLabel = input<string | undefined>(undefined);
	readonly redoLabel = input<string | undefined>(undefined);
	/** Whether the Find & Replace panel is open (search-button active state). */
	readonly findReplaceOpen = input<boolean>(false);

	readonly toggleAutosave = output<void>();
	readonly save = output<void>();
	readonly undo = output<void>();
	readonly redo = output<void>();
	readonly toggleFindReplace = output<void>();
	readonly commandSearch = output<string>();

	private readonly translate = inject(TranslateService);
	protected readonly tb = TITLE_BAR_CLASSES;
	protected readonly defaultFileKey = TITLE_BAR_DEFAULT_FILE_KEY;

	protected readonly searchQuery = signal('');
	protected readonly searchFocused = signal(false);

	protected readonly commandResults = computed(() =>
		filterCommands(this.searchQuery(), (key) => this.translate.instant(key)),
	);

	/** The i18n key for the save-location status text (next to the file name). */
	protected readonly statusKey = computed(() => {
		const status = this.autosaveStatus();
		return resolveTitleBarStatusKey({
			autosaveState: status?.state ?? 'idle',
			isDirty: this.isDirty(),
			autosaveEnabled: this.autosaveEnabled(),
			disabledReason: status?.state === 'disabled' ? status.reason : undefined,
		});
	});

	/** Colour override for the status text on saving/error (when autosave is on). */
	protected readonly statusStateClass = computed(() => {
		const state = this.autosaveStatus()?.state;
		if (!this.autosaveEnabled()) {
			return '';
		}
		if (state === 'error') {
			return this.tb.statusError;
		}
		if (state === 'saving') {
			return this.tb.statusSaving;
		}
		return '';
	});

	protected selectCommand(entry: CommandSearchEntry): void {
		this.commandSearch.emit(entry.command);
		this.searchQuery.set('');
		this.searchFocused.set(false);
	}

	protected openFindReplace(): void {
		this.toggleFindReplace.emit();
		this.searchFocused.set(false);
		this.searchQuery.set('');
	}

	protected onSearchBlur(): void {
		// Delay to allow mousedown on dropdown items to fire first.
		setTimeout(() => this.searchFocused.set(false), 150);
	}

	protected onSearchKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Enter' && this.searchQuery().trim()) {
			const results = this.commandResults();
			if (results.length > 0) {
				this.selectCommand(results[0]);
			} else {
				this.openFindReplace();
			}
		} else if (event.key === 'Escape') {
			this.searchQuery.set('');
			this.searchFocused.set(false);
		}
	}
}
