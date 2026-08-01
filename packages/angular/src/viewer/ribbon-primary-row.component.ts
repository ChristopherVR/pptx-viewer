/**
 * ribbon-primary-row.component.ts: the quick-access (top) row of the editor
 * chrome, at parity with React's `toolbar/ToolbarPrimaryRow.tsx`.
 *
 * Layout (mirrors React):
 *   LEFT  : slides-pane toggle
 *   RIGHT : Comments (with count), Present split-button + dropdown
 *           (From Beginning / Presenter View / Broadcast), +Show (custom
 *           shows), Inspector toggle, Settings cog, overflow "..." menu
 *           (exports / print / properties / accessibility / save).
 *
 * Undo/Redo/Find and Save moved up to the title bar; Record and Share moved to
 * the ribbon tab row (both mirroring React). Slide navigation and zoom live in
 * the bottom status bar (see {@link StatusBarComponent}). Everything here is an
 * `output()` the {@link PowerPointViewerComponent} already handles.
 */
import { NgClass } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	ElementRef,
	HostListener,
	input,
	output,
	signal,
	viewChild,
} from '@angular/core';
import {
	LucideChevronDown,
	LucideEllipsis,
	LucideMessageSquare,
	LucidePanelLeft,
	LucidePanelRight,
	LucidePlay,
	LucidePlus,
	LucideSettings,
	LucideSparkles,
} from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

import { isActionHidden } from '../internal/shared';
import type { ToolbarActionId } from '../internal/shared';
import { toolbarVisibility } from './toolbar-visibility';

/** Overflow menu items (mirrors React's File/overflow actions that exist here). */
const ALL_OVERFLOW_ITEMS: ReadonlyArray<{
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

/** png/pdf/video/gif are the export overflow rows; dropped when 'export' is hidden. */
const EXPORT_OVERFLOW_KEYS = new Set(['png', 'pdf', 'video', 'gif']);

/** Pure, testable filter: the overflow items visible for a given `hiddenActions` list. */
export function visibleOverflowItems(
	hiddenActions: readonly ToolbarActionId[] | undefined,
): typeof ALL_OVERFLOW_ITEMS {
	return ALL_OVERFLOW_ITEMS.filter(
		(item) => !EXPORT_OVERFLOW_KEYS.has(item.key) || !isActionHidden('export', hiddenActions),
	);
}

@Component({
	selector: 'pptx-ribbon-primary-row',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		NgClass,
		TranslatePipe,
		LucidePanelLeft,
		LucidePanelRight,
		LucideMessageSquare,
		LucidePlay,
		LucideChevronDown,
		LucidePlus,
		LucideEllipsis,
		LucideSettings,
		LucideSparkles,
	],
	template: `
		<div class="flex items-center gap-0.5 px-1.5 py-0.5">
			<!-- Left: slides pane toggle (undo/redo/find moved to the title bar) -->
			<button
				type="button"
				class="pptx-rb-icon"
				[ngClass]="sidebarCollapsed() ? 'text-muted-foreground' : 'text-foreground'"
				[title]="'pptx.toolbar.toggleSlidesPanel' | translate"
				[attr.aria-label]="'pptx.toolbar.toggleSlidesPanel' | translate"
				(click)="toggleSidebar.emit()"
			>
				<svg lucidePanelLeft class="h-4 w-4"></svg>
			</button>

			<!-- Center spacer -->
			<div class="min-w-2 flex-1"></div>

			<!-- Right: comments + present + show + inspector + overflow -->
			<button
				type="button"
				class="pptx-rb-icon relative"
				[ngClass]="commentsOpen() ? 'text-foreground' : 'text-muted-foreground'"
				[title]="'pptx.toolbar.comments' | translate"
				[attr.aria-label]="'pptx.toolbar.comments' | translate"
				(click)="toggleComments.emit()"
			>
				<svg lucideMessageSquare class="h-3.5 w-3.5"></svg>
				@if (commentCount() > 0) {
					<span
						class="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] leading-none text-white"
						>{{ commentCount() }}</span
					>
				}
			</button>

			<!-- Present split-button + dropdown -->
			<div class="relative inline-flex items-center" #presentRoot>
				<button
					type="button"
					class="pptx-rb-pill rounded-r-none"
					[disabled]="slideCount() === 0"
					(click)="present.emit()"
				>
					<svg lucidePlay class="h-3.5 w-3.5"></svg> {{ 'pptx.toolbar.present' | translate }}
				</button>
				<button
					type="button"
					class="pptx-rb-pill rounded-l-none border-l border-border/40 px-1"
					[attr.aria-expanded]="presentMenuOpen()"
					[title]="'pptx.ribbon.slideShowOptions' | translate"
					[attr.aria-label]="'pptx.ribbon.slideShowOptions' | translate"
					(click)="presentMenuOpen.set(!presentMenuOpen())"
				>
					<svg lucideChevronDown class="h-3 w-3"></svg>
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
								<!-- Same key as the Slide Show tab and the other four bindings. -->
								{{ 'pptx.slideShow.presenterView' | translate }}
							</button>
							@if (!toolbar.isHidden('broadcast')) {
								<button
									type="button"
									class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
									(click)="broadcast.emit(); presentMenuOpen.set(false)"
								>
									{{ 'pptx.ribbon.broadcast' | translate }}
								</button>
							}
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
				<svg lucidePlus class="h-3.5 w-3.5"></svg> {{ 'pptx.ribbon.show' | translate }}
			</button>

			<span class="mx-1 h-5 w-px self-center bg-border/50"></span>

			<button
				type="button"
				class="pptx-rb-icon"
				[ngClass]="inspectorOpen() ? 'text-foreground' : 'text-muted-foreground'"
				[title]="'pptx.toolbar.toggleInspector' | translate"
				[attr.aria-label]="'pptx.toolbar.toggleInspector' | translate"
				(click)="toggleInspector.emit()"
			>
				<svg lucidePanelRight class="h-4 w-4"></svg>
			</button>

			<!-- AI assistant toggle (only when the host passes an 'ai' config). -->
			@if (aiEnabled()) {
				<button
					type="button"
					class="pptx-rb-icon"
					[ngClass]="aiPanelOpen() ? 'text-primary' : 'text-muted-foreground'"
					[title]="'pptx.toolbar.toggleAiAssistant' | translate"
					[attr.aria-label]="'pptx.toolbar.toggleAiAssistant' | translate"
					[attr.aria-pressed]="aiPanelOpen()"
					(click)="toggleAiPanel.emit()"
				>
					<svg lucideSparkles class="h-4 w-4"></svg>
				</button>
			}

			<!-- Settings (mirrors React: between the panel toggle and the overflow "...") -->
			<button
				type="button"
				class="pptx-rb-icon text-muted-foreground"
				[title]="'pptx.toolbar.settingsShortcuts' | translate"
				[attr.aria-label]="'pptx.toolbar.settings' | translate"
				(click)="openSettings.emit()"
			>
				<svg lucideSettings class="h-3.5 w-3.5"></svg>
			</button>

			<!-- Overflow menu -->
			<div class="relative inline-flex items-center" #overflowRoot>
				<button
					type="button"
					class="pptx-rb-icon text-muted-foreground"
					[attr.aria-expanded]="overflowOpen()"
					[title]="'pptx.ribbon.moreActions' | translate"
					[attr.aria-label]="'pptx.ribbon.moreActions' | translate"
					(click)="overflowOpen.set(!overflowOpen())"
				>
					<svg lucideEllipsis class="h-3.5 w-3.5"></svg>
				</button>
				@if (overflowOpen()) {
					<div class="absolute right-0 top-full z-50 w-52 pt-1">
						<div class="rounded-lg border border-border bg-popover py-1 shadow-2xl">
							@for (item of overflowItems(); track item.key) {
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
	readonly slideCount = input<number>(0);
	readonly sidebarCollapsed = input<boolean>(false);
	readonly inspectorOpen = input<boolean>(false);
	readonly commentsOpen = input<boolean>(false);
	readonly commentCount = input<number>(0);
	/** Toolbar buttons the host wants hidden (gates Broadcast + the export overflow items). */
	readonly hiddenActions = input<ToolbarActionId[]>([]);
	/** Whether the host enabled the AI assistant (shows the Sparkles toggle). */
	readonly aiEnabled = input<boolean>(false);
	/** Whether the AI assistant panel is currently open (toggle active state). */
	readonly aiPanelOpen = input<boolean>(false);

	readonly toggleSidebar = output<void>();
	/** Emitted when the user clicks the AI assistant Sparkles toggle. */
	readonly toggleAiPanel = output<void>();
	readonly toggleComments = output<void>();
	readonly present = output<void>();
	readonly presenter = output<void>();
	readonly broadcast = output<void>();
	readonly openCustomShows = output<void>();
	readonly toggleInspector = output<void>();
	/** Emitted when the user clicks the Settings cog (opens the Settings dialog). */
	readonly openSettings = output<void>();
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
	protected readonly toolbar = toolbarVisibility(this.hiddenActions);
	protected readonly overflowItems = computed(() => visibleOverflowItems(this.hiddenActions()));

	private readonly presentRoot = viewChild<ElementRef<HTMLElement>>('presentRoot');
	private readonly overflowRoot = viewChild<ElementRef<HTMLElement>>('overflowRoot');

	/** Escape dismisses any open dropdown (Present options / overflow). */
	@HostListener('document:keydown.escape')
	protected onDocumentEscape(): void {
		this.presentMenuOpen.set(false);
		this.overflowOpen.set(false);
	}

	/** A pointerdown outside a dropdown's trigger + panel dismisses it. */
	@HostListener('document:pointerdown', ['$event'])
	protected onDocumentPointerDown(event: PointerEvent): void {
		const target = event.target;
		if (!(target instanceof Node)) {
			return;
		}
		if (this.presentMenuOpen() && !this.presentRoot()?.nativeElement.contains(target)) {
			this.presentMenuOpen.set(false);
		}
		if (this.overflowOpen() && !this.overflowRoot()?.nativeElement.contains(target)) {
			this.overflowOpen.set(false);
		}
	}

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
