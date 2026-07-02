/**
 * ribbon-primary-row.component.ts: the quick-access (top) row of the editor
 * chrome, at parity with React's `toolbar/ToolbarPrimaryRow.tsx`.
 *
 * Layout (mirrors React):
 *   LEFT  : slides-pane toggle, Undo, Redo, Find
 *   RIGHT : Comments (with count), Present split-button + dropdown
 *           (From Beginning / Presenter View / Broadcast), +Show (custom
 *           shows), Share, Inspector toggle, overflow "..." menu (exports /
 *           print / properties / accessibility / save).
 *
 * Slide navigation and zoom intentionally live in the bottom status bar (see
 * {@link StatusBarComponent}), matching React. Undo/redo bind straight to the
 * shared {@link EditorStateService}; everything else is an `output()` the
 * {@link PowerPointViewerComponent} already handles.
 */
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { EditorStateService } from './editor-state.service';

@Component({
	selector: 'pptx-ribbon-primary-row',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgClass, TranslatePipe],
	template: `
		<div class="flex items-center gap-0.5 px-1.5 py-0.5">
			<!-- Left: slides pane toggle + undo/redo + find -->
			<button
				type="button"
				class="pptx-rb-icon"
				[ngClass]="sidebarCollapsed() ? 'text-muted-foreground' : 'text-foreground'"
				[title]="'pptx.toolbar.toggleSlidesPanel' | translate"
				[attr.aria-label]="'pptx.toolbar.toggleSlidesPanel' | translate"
				(click)="toggleSidebar.emit()"
			>
				⫐
			</button>
			<span class="mx-1 h-5 w-px self-center bg-border/50"></span>
			<button
				type="button"
				class="pptx-rb-icon"
				[attr.aria-label]="'pptx.toolbar.undo' | translate"
				[disabled]="!canEdit() || !editor.canUndo()"
				(click)="editor.undo()"
			>
				↶
			</button>
			<button
				type="button"
				class="pptx-rb-icon"
				[attr.aria-label]="'pptx.toolbar.redo' | translate"
				[disabled]="!canEdit() || !editor.canRedo()"
				(click)="editor.redo()"
			>
				↷
			</button>
			<button
				type="button"
				class="pptx-rb-icon"
				[ngClass]="findOpen() ? 'text-foreground' : 'text-muted-foreground'"
				[title]="'pptx.toolbar.findAndReplace' | translate"
				[attr.aria-label]="'pptx.toolbar.findAndReplace' | translate"
				(click)="toggleFind.emit()"
			>
				⌕
			</button>

			<!-- Center spacer -->
			<div class="min-w-2 flex-1"></div>

			<!-- Right: comments + present + show + share + inspector + overflow -->
			<button
				type="button"
				class="pptx-rb-icon relative"
				[ngClass]="commentsOpen() ? 'text-foreground' : 'text-muted-foreground'"
				[title]="'pptx.toolbar.comments' | translate"
				[attr.aria-label]="'pptx.toolbar.comments' | translate"
				(click)="toggleComments.emit()"
			>
				💬
				@if (commentCount() > 0) {
					<span
						class="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] leading-none text-white"
						>{{ commentCount() }}</span
					>
				}
			</button>

			<!-- Present split-button + dropdown -->
			<div class="relative inline-flex items-center">
				<button
					type="button"
					class="pptx-rb-pill rounded-r-none"
					[disabled]="slideCount() === 0"
					(click)="present.emit()"
				>
					▶ {{ 'pptx.toolbar.present' | translate }}
				</button>
				<button
					type="button"
					class="pptx-rb-pill rounded-l-none border-l border-border/40 px-1"
					[attr.aria-expanded]="presentMenuOpen()"
					[title]="'pptx.ribbon.slideShowOptions' | translate"
					[attr.aria-label]="'pptx.ribbon.slideShowOptions' | translate"
					(click)="presentMenuOpen.set(!presentMenuOpen())"
				>
					▾
				</button>
				@if (presentMenuOpen()) {
					<div class="absolute right-0 top-full z-50 w-48 pt-1">
						<div class="rounded-lg border border-border bg-popover py-1 shadow-2xl">
							<button
								type="button"
								class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
								[disabled]="slideCount() === 0"
								(click)="present.emit(); presentMenuOpen.set(false)"
							>
								{{ 'pptx.ribbon.fromBeginning' | translate }}
							</button>
							<button
								type="button"
								class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
								[disabled]="slideCount() === 0"
								(click)="presenter.emit(); presentMenuOpen.set(false)"
							>
								{{ 'pptx.ribbon.presenterView' | translate }}
							</button>
							<button
								type="button"
								class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
								(click)="broadcast.emit(); presentMenuOpen.set(false)"
							>
								{{ 'pptx.ribbon.broadcast' | translate }}
							</button>
						</div>
					</div>
				}
			</div>

			<button
				type="button"
				class="pptx-rb-pill"
				[title]="'pptx.ribbon.customShows' | translate"
				[attr.aria-label]="'pptx.ribbon.customShows' | translate"
				(click)="openCustomShows.emit()"
			>
				＋ {{ 'pptx.ribbon.show' | translate }}
			</button>

			<span class="mx-1 h-5 w-px self-center bg-border/50"></span>

			<button
				type="button"
				class="inline-flex items-center gap-1 rounded-sm px-2.5 py-1 text-[11px] font-medium text-white transition-colors"
				[ngClass]="
					collabConnected() ? 'bg-green-600 hover:bg-green-500' : 'bg-primary hover:bg-primary/90'
				"
				[title]="'pptx.ribbon.shareForCollaboration' | translate"
				[attr.aria-label]="'pptx.toolbar.share' | translate"
				(click)="share.emit()"
			>
				⇪
				{{
					collabConnected()
						? ('pptx.toolbar.sharingCount' | translate: { count: connectedCount() })
						: ('pptx.toolbar.share' | translate)
				}}
			</button>

			<button
				type="button"
				class="pptx-rb-icon"
				[ngClass]="inspectorOpen() ? 'text-foreground' : 'text-muted-foreground'"
				[title]="'pptx.toolbar.toggleInspector' | translate"
				[attr.aria-label]="'pptx.toolbar.toggleInspector' | translate"
				(click)="toggleInspector.emit()"
			>
				⫏
			</button>

			<!-- Overflow menu -->
			<div class="relative inline-flex items-center">
				<button
					type="button"
					class="pptx-rb-icon text-muted-foreground"
					[attr.aria-expanded]="overflowOpen()"
					[title]="'pptx.ribbon.moreActions' | translate"
					[attr.aria-label]="'pptx.ribbon.moreActions' | translate"
					(click)="overflowOpen.set(!overflowOpen())"
				>
					⋯
				</button>
				@if (overflowOpen()) {
					<div class="absolute right-0 top-full z-50 w-52 pt-1">
						<div class="rounded-lg border border-border bg-popover py-1 shadow-2xl">
							@for (item of overflowItems; track item.key) {
								@if (item.key.startsWith('---')) {
									<div class="my-1 h-px bg-border/60"></div>
								} @else {
									<button
										type="button"
										class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-40"
										[disabled]="item.needsSlides && slideCount() === 0"
										(click)="onOverflow(item.key)"
									>
										{{ item.labelKey | translate }}
									</button>
								}
							}
						</div>
					</div>
				}
			</div>
		</div>
	`,
})
export class RibbonPrimaryRowComponent {
	protected readonly editor = inject(EditorStateService);

	readonly slideCount = input<number>(0);
	readonly canEdit = input<boolean>(false);
	readonly sidebarCollapsed = input<boolean>(false);
	readonly inspectorOpen = input<boolean>(false);
	readonly commentsOpen = input<boolean>(false);
	readonly commentCount = input<number>(0);
	readonly findOpen = input<boolean>(false);
	readonly collabConnected = input<boolean>(false);
	readonly connectedCount = input<number>(0);

	readonly toggleSidebar = output<void>();
	readonly toggleFind = output<void>();
	readonly toggleComments = output<void>();
	readonly present = output<void>();
	readonly presenter = output<void>();
	readonly broadcast = output<void>();
	readonly openCustomShows = output<void>();
	readonly share = output<void>();
	readonly toggleInspector = output<void>();
	readonly exportPng = output<void>();
	readonly exportPdf = output<void>();
	readonly exportGif = output<void>();
	readonly exportVideo = output<void>();
	readonly print = output<void>();
	readonly info = output<void>();
	readonly a11y = output<void>();
	readonly save = output<void>();

	protected readonly presentMenuOpen = signal(false);
	protected readonly overflowOpen = signal(false);

	/** Overflow menu items (mirrors React's File/overflow actions that exist here). */
	protected readonly overflowItems: ReadonlyArray<{
		key: string;
		labelKey: string;
		needsSlides?: boolean;
	}> = [
		{ key: 'png', labelKey: 'pptx.ribbon.exportPng', needsSlides: true },
		{ key: 'pdf', labelKey: 'pptx.ribbon.exportPdf', needsSlides: true },
		{ key: 'video', labelKey: 'pptx.ribbon.exportVideo', needsSlides: true },
		{ key: 'gif', labelKey: 'pptx.ribbon.exportGif', needsSlides: true },
		{ key: 'save', labelKey: 'pptx.ribbon.savePptx', needsSlides: true },
		{ key: '---0', labelKey: '' },
		{ key: 'print', labelKey: 'pptx.print.printButton' },
		{ key: 'info', labelKey: 'pptx.ribbon.documentProperties' },
		{ key: 'a11y', labelKey: 'pptx.ribbon.accessibilityCheck' },
	];

	protected onOverflow(key: string): void {
		this.overflowOpen.set(false);
		switch (key) {
			case 'png':
				this.exportPng.emit();
				break;
			case 'pdf':
				this.exportPdf.emit();
				break;
			case 'video':
				this.exportVideo.emit();
				break;
			case 'gif':
				this.exportGif.emit();
				break;
			case 'save':
				this.save.emit();
				break;
			case 'print':
				this.print.emit();
				break;
			case 'info':
				this.info.emit();
				break;
			case 'a11y':
				this.a11y.emit();
				break;
			default:
				break;
		}
	}
}
