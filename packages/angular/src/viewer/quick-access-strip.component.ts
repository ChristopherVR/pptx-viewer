/**
 * quick-access-strip.component.ts: the Quick Access Toolbar strip driven by
 * File > Options > Quick Access Toolbar.
 *
 * Renders the ordered {@link QUICK_ACCESS_COMMAND_CATALOG} commands from
 * `options.quickAccess.commandIds` as icon buttons (optionally with labels),
 * emitting the pressed command id; the host maps ids onto its existing
 * handlers. Replaces the title bar's previously hardcoded Save/Undo/Redo
 * trio, and is also rendered below the ribbon when the position option is
 * `below`. Tooltips honour the ScreenTip style via {@link ViewerOptionsService}.
 */
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import {
	LucideFileDown,
	LucidePlay,
	LucidePlus,
	LucidePrinter,
	LucideRedo,
	LucideSave,
	LucideSearch,
	LucideUndo,
	LucideZoomIn,
	LucideZoomOut,
} from '@lucide/angular';
import { TranslateService } from '@ngx-translate/core';

import { getQuickAccessCommand, TITLE_BAR_CLASSES } from '../internal/shared';
import type { ViewerQuickAccessOptions } from '../internal/shared';
import { ViewerOptionsService } from './viewer-options.service';

/** One resolved strip entry (known catalog ids only, in configured order). */
export interface QuickAccessStripItem {
	id: string;
	icon: string;
	labelKey: string;
}

/** Resolve the configured command ids to renderable strip entries. */
export function resolveQuickAccessItems(commandIds: readonly string[]): QuickAccessStripItem[] {
	const items: QuickAccessStripItem[] = [];
	for (const id of commandIds) {
		const command = getQuickAccessCommand(id);
		if (command) {
			items.push({ id, icon: command.icon, labelKey: command.labelKey });
		}
	}
	return items;
}

@Component({
	selector: 'pptx-quick-access-strip',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		LucideSave,
		LucideUndo,
		LucideRedo,
		LucidePlay,
		LucidePrinter,
		LucideFileDown,
		LucidePlus,
		LucideSearch,
		LucideZoomIn,
		LucideZoomOut,
	],
	template: `
		@for (item of items(); track item.id) {
			<button
				type="button"
				[class]="tb.quickButton"
				[disabled]="isDisabled(item.id)"
				[attr.title]="tip(item)"
				[attr.aria-label]="label(item)"
				(click)="command.emit(item.id)"
			>
				@switch (item.icon) {
					@case ('save') {
						<svg lucideSave class="h-3.5 w-3.5"></svg>
					}
					@case ('undo') {
						<svg lucideUndo class="h-3.5 w-3.5"></svg>
					}
					@case ('redo') {
						<svg lucideRedo class="h-3.5 w-3.5"></svg>
					}
					@case ('play') {
						<svg lucidePlay class="h-3.5 w-3.5"></svg>
					}
					@case ('printer') {
						<svg lucidePrinter class="h-3.5 w-3.5"></svg>
					}
					@case ('fileDown') {
						<svg lucideFileDown class="h-3.5 w-3.5"></svg>
					}
					@case ('plus') {
						<svg lucidePlus class="h-3.5 w-3.5"></svg>
					}
					@case ('spellCheck') {
						<svg lucideSearch class="h-3.5 w-3.5"></svg>
					}
					@case ('zoomIn') {
						<svg lucideZoomIn class="h-3.5 w-3.5"></svg>
					}
					@default {
						<svg lucideZoomOut class="h-3.5 w-3.5"></svg>
					}
				}
				@if (quickAccess().showCommandLabels) {
					<span class="pptx-ng-qat-label">{{ label(item) }}</span>
				}
			</button>
		}
	`,
	styles: [
		`
			:host {
				display: inline-flex;
				align-items: center;
				gap: 2px;
			}
			.pptx-ng-qat-label {
				margin-left: 4px;
				font-size: 11px;
				white-space: nowrap;
			}
		`,
	],
})
export class QuickAccessStripComponent {
	/** The live Quick Access options group (visibility is gated by the host). */
	readonly quickAccess = input.required<ViewerQuickAccessOptions>();
	readonly canUndo = input<boolean>(false);
	readonly canRedo = input<boolean>(false);
	/** A configured command id was pressed. */
	readonly command = output<string>();

	private readonly translate = inject(TranslateService);
	/** Optional so the strip renders outside a full viewer host too. */
	private readonly viewerOpts = inject(ViewerOptionsService, { optional: true });

	protected readonly tb = TITLE_BAR_CLASSES;
	protected readonly items = computed(() => resolveQuickAccessItems(this.quickAccess().commandIds));

	protected label(item: QuickAccessStripItem): string {
		return this.translate.instant(item.labelKey);
	}

	/** ScreenTip-styled tooltip (null suppresses the title attribute). */
	protected tip(item: QuickAccessStripItem): string | null {
		const label = this.label(item);
		return this.viewerOpts ? (this.viewerOpts.screenTip(label) ?? null) : label;
	}

	protected isDisabled(id: string): boolean {
		if (id === 'undo') {
			return !this.canUndo();
		}
		if (id === 'redo') {
			return !this.canRedo();
		}
		return false;
	}
}
