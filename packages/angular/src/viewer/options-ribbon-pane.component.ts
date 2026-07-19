/**
 * options-ribbon-pane.component.ts: Options > Customize Ribbon pane (Angular
 * port of React's `settings/OptionsRibbonPane.tsx`).
 *
 * Renders PowerPoint's "Main Tabs" checkbox tree over the shared
 * {@link TOOLBAR_TABS} registry (the File tab can never be hidden), a Reset
 * button that restores the ribbon group, and the keyboard-shortcut reference
 * list that backs the tab's `shortcutReference` special section.
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { SHORTCUT_REFERENCE_ITEMS, TOOLBAR_TABS } from '../internal/shared';
import type { ToolbarTabId, ViewerOptions } from '../internal/shared';

/** One Customize Ribbon checkbox edit. */
export interface RibbonTabHiddenChange {
	tabId: ToolbarTabId;
	hidden: boolean;
}

/** Whether a ribbon tab is ticked in Customize Ribbon (File always is). */
export function isRibbonTabTicked(options: ViewerOptions, tabId: ToolbarTabId): boolean {
	return tabId === 'file' || !options.ribbon.hiddenTabIds.includes(tabId);
}

@Component({
	selector: 'pptx-options-ribbon-pane',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<div class="pptx-ng-options-ribbon">
			<section>
				<h3>{{ 'pptx.options.ribbon.tabsTitle' | translate }}</h3>
				<p class="pptx-ng-options-note">{{ 'pptx.options.ribbon.tabsDescription' | translate }}</p>
				<div class="pptx-ng-options-ribbon-tabs">
					@for (tab of tabs; track tab.id) {
						<label class="pptx-ng-options-ribbon-tab" [class.is-locked]="tab.id === 'file'">
							<input
								type="checkbox"
								[checked]="ticked(tab.id)"
								[disabled]="tab.id === 'file'"
								(change)="onTicked(tab.id, $event)"
							/>
							<span>{{ tab.labelKey | translate }}</span>
						</label>
					}
				</div>
				<button type="button" class="pptx-ng-options-btn" (click)="resetRibbon.emit()">
					{{ 'pptx.options.ribbon.reset' | translate }}
				</button>
			</section>

			<section>
				<h3>{{ 'pptx.settings.keyboardShortcuts' | translate }}</h3>
				@for (item of shortcuts; track item.actionKey; let even = $even) {
					<div class="pptx-ng-options-shortcut" [class.is-alt]="even">
						<span>{{ item.actionKey | translate }}</span>
						<kbd>{{ item.shortcut }}</kbd>
					</div>
				}
			</section>
		</div>
	`,
	styles: [
		`
			.pptx-ng-options-ribbon {
				display: flex;
				flex-direction: column;
				gap: 16px;
			}
			.pptx-ng-options-ribbon h3 {
				margin: 0 0 4px;
				padding-bottom: 4px;
				border-bottom: 1px solid var(--pptx-border);
				color: var(--pptx-muted-foreground);
				font-size: 11px;
				font-weight: 600;
				letter-spacing: 0.04em;
				text-transform: uppercase;
			}
			.pptx-ng-options-note {
				margin: 2px 0 6px;
				color: var(--pptx-muted-foreground);
				font-size: 11px;
			}
			.pptx-ng-options-ribbon-tabs {
				margin-bottom: 8px;
				padding: 6px;
				border: 1px solid var(--pptx-border);
				border-radius: 6px;
			}
			.pptx-ng-options-ribbon-tab {
				display: flex;
				align-items: center;
				gap: 8px;
				padding: 5px 6px;
				border-radius: 4px;
				font-size: 13px;
				cursor: pointer;
			}
			.pptx-ng-options-ribbon-tab:hover {
				background: var(--pptx-accent);
			}
			.pptx-ng-options-ribbon-tab.is-locked {
				opacity: 0.6;
				cursor: not-allowed;
			}
			.pptx-ng-options-ribbon-tab input {
				width: 15px;
				height: 15px;
				accent-color: var(--pptx-primary);
			}
			.pptx-ng-options-btn {
				padding: 5px 12px;
				border: 1px solid var(--pptx-border);
				border-radius: 4px;
				background: transparent;
				color: var(--pptx-foreground);
				font-size: 12px;
				cursor: pointer;
			}
			.pptx-ng-options-btn:hover {
				background: var(--pptx-accent);
			}
			.pptx-ng-options-shortcut {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 12px;
				padding: 6px 10px;
				border-radius: 4px;
				font-size: 12px;
			}
			.pptx-ng-options-shortcut.is-alt {
				background: var(--pptx-muted);
			}
			.pptx-ng-options-shortcut kbd {
				color: var(--pptx-muted-foreground);
				font:
					11px ui-monospace,
					monospace;
				white-space: nowrap;
			}
		`,
	],
})
export class OptionsRibbonPaneComponent {
	readonly options = input.required<ViewerOptions>();
	readonly tabHiddenChange = output<RibbonTabHiddenChange>();
	readonly resetRibbon = output<void>();

	protected readonly tabs = TOOLBAR_TABS;
	protected readonly shortcuts = SHORTCUT_REFERENCE_ITEMS;

	protected ticked(tabId: ToolbarTabId): boolean {
		return isRibbonTabTicked(this.options(), tabId);
	}

	protected onTicked(tabId: ToolbarTabId, event: Event): void {
		this.tabHiddenChange.emit({ tabId, hidden: !(event.target as HTMLInputElement).checked });
	}
}
