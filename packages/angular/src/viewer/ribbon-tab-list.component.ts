/**
 * ribbon-tab-list.component.ts: the ribbon's tab strip row, split out of
 * {@link RibbonComponent} (which was well over this repo's 300-LOC file cap).
 *
 * Renders: the scrollable tab strip (File/Home/Insert/.../Help, filtered by
 * `hiddenActions`), the pinned Record + Share actions (tab-row right side),
 * and the ribbon expand/collapse toggle. Behaviour and markup are unchanged
 * from the original inline tab-bar `<div>` in `ribbon.component.ts`.
 */
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { LucideChevronDown, LucideChevronUp, LucideShare2 } from '@lucide/angular';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { filterVisibleTabs, TAB_ROW_ACTION_CLASSES, TOOLBAR_TABS } from '../internal/shared';
import type { ToolbarActionId, ToolbarTabId } from '../internal/shared';
import type { RibbonTab } from './ribbon-types';
import { toolbarVisibility } from './toolbar-visibility';
import { ViewerOptionsService } from './viewer-options.service';

@Component({
	selector: 'pptx-ribbon-tab-list',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgClass, TranslatePipe, LucideShare2, LucideChevronUp, LucideChevronDown],
	template: `
		<div role="tablist" class="flex items-center border-b border-border/60 px-1">
			<!-- Scrollable tab strip: on narrow widths the tabs scroll instead of
			     clipping (mirrors React's max-md:overflow-x-auto scrollbar-none),
			     while the Record/Share actions and collapse toggle stay pinned. -->
			<div class="flex min-w-0 flex-1 items-center overflow-x-auto pptx-scrollbar-none">
				@for (t of visibleTabs(); track t.id) {
					<button
						type="button"
						role="tab"
						[attr.aria-selected]="activeTab() === t.id"
						[title]="tabTip(t.labelKey)"
						(click)="selectTab.emit(t.id)"
						class="relative whitespace-nowrap px-3.5 py-2 text-[12px] font-medium transition-colors"
						[ngClass]="
							activeTab() === t.id
								? t.id === 'file'
									? 'text-white bg-primary/80 rounded-sm'
									: 'text-foreground after:absolute after:-bottom-px after:left-0 after:right-0 after:h-[2.5px] after:bg-primary'
								: t.id === 'file'
									? 'text-primary hover:bg-primary/15 rounded-sm'
									: 'text-muted-foreground hover:bg-accent/30 hover:text-foreground'
						"
					>
						{{ t.labelKey | translate }}
					</button>
				}
			</div>

			<!-- Tab-row right actions (Record + Share), mirroring React's TabRowActions -->
			<div class="flex shrink-0 items-center gap-1 pr-1">
				@if (canEdit() && !toolbar.isHidden('record')) {
					<button
						type="button"
						[class]="tra.record"
						[title]="'pptx.titleBar.record' | translate"
						[attr.aria-label]="'pptx.titleBar.record' | translate"
						(click)="record.emit()"
					>
						<span [class]="tra.recordDot" aria-hidden="true"></span>
						<span>{{ 'pptx.titleBar.record' | translate }}</span>
					</button>
				}
				@if (!toolbar.isHidden('share')) {
					<div
						role="status"
						[attr.aria-label]="
							collabConnected()
								? ('pptx.collaboration.statusAriaLabel'
									| translate: { status: 'pptx.collaboration.status.connected' | translate })
								: null
						"
					>
						<button
							type="button"
							class="relative inline-flex items-center gap-1 whitespace-nowrap rounded-sm px-2.5 py-1 text-[11px] font-medium text-white transition-colors"
							[ngClass]="
								collabConnected()
									? 'bg-green-600 hover:bg-green-500'
									: 'bg-primary hover:bg-primary/90'
							"
							[title]="
								collabConnected()
									? ('pptx.toolbar.sharingUsers' | translate: { count: connectedCount() })
									: ('pptx.toolbar.share' | translate)
							"
							[attr.aria-label]="'pptx.toolbar.share' | translate"
							(click)="share.emit()"
						>
							<svg lucideShare2 class="h-3.5 w-3.5"></svg>
							<span>{{
								collabConnected()
									? ('pptx.toolbar.sharingCount' | translate: { count: connectedCount() })
									: ('pptx.toolbar.share' | translate)
							}}</span>
						</button>
					</div>
				}
			</div>

			<button
				type="button"
				class="mr-1 shrink-0 rounded px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
				[attr.aria-pressed]="!ribbonExpanded()"
				[title]="
					(ribbonExpanded() ? 'pptx.ribbon.collapseRibbon' : 'pptx.ribbon.expandRibbon') | translate
				"
				(click)="toggleRibbonExpanded.emit()"
			>
				@if (ribbonExpanded()) {
					<svg lucideChevronUp class="h-3.5 w-3.5"></svg>
				} @else {
					<svg lucideChevronDown class="h-3.5 w-3.5"></svg>
				}
			</button>
		</div>
	`,
})
export class RibbonTabListComponent {
	readonly activeTab = input.required<RibbonTab>();
	readonly canEdit = input<boolean>(false);
	readonly collabConnected = input<boolean>(false);
	readonly connectedCount = input<number>(0);
	readonly ribbonExpanded = input<boolean>(true);
	/** Toolbar tabs/buttons the host wants hidden (filters the tab strip; gates Record/Share). */
	readonly hiddenActions = input<ToolbarActionId[]>([]);

	readonly selectTab = output<ToolbarTabId>();
	readonly record = output<void>();
	readonly share = output<void>();
	readonly toggleRibbonExpanded = output<void>();

	protected readonly toolbar = toolbarVisibility(this.hiddenActions);
	protected readonly tra = TAB_ROW_ACTION_CLASSES;
	protected readonly visibleTabs = computed(() =>
		filterVisibleTabs(TOOLBAR_TABS, this.hiddenActions()),
	);

	private readonly translate = inject(TranslateService);
	/** Optional so the tab strip renders outside a full viewer host too. */
	private readonly viewerOpts = inject(ViewerOptionsService, { optional: true });

	/** ScreenTip-styled tab tooltip (null suppresses the title attribute). */
	protected tabTip(labelKey: string): string | null {
		const label = this.translate.instant(labelKey) as string;
		return this.viewerOpts ? (this.viewerOpts.screenTip(label) ?? null) : label;
	}
}
