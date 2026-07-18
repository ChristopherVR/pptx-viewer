/**
 * settings-dialog.component.ts: the File > Options dialog (Angular port of
 * React's `SettingsDialog.tsx`).
 *
 * A PowerPoint Options-style dialog: the ten shared categories from
 * {@link VIEWER_OPTIONS_TABS} in a left rail, schema-driven panes on the right
 * ({@link OptionsPaneComponent}), and bespoke panes for Language (locale list),
 * Customize Ribbon, Quick Access Toolbar, and Add-ins. Changes apply live
 * through the host's options store; Cancel restores the snapshot taken when
 * the dialog opened, while OK / Escape / backdrop keep the edits.
 *
 * Built as its own overlay + panel (not `pptx-modal-dialog`) because the
 * two-column rail layout needs the wide footprint the shared modal shell does
 * not provide, mirroring how `insert-smart-art-dialog` sizes itself.
 */
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	HostListener,
	input,
	output,
	signal,
	untracked,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { THEME_CATALOG, VIEWER_OPTIONS_TABS } from '../internal/shared';
import type {
	ThemeCatalogEntry,
	ViewerAddinStatus,
	ViewerOptions,
	ViewerOptionsGroupId,
	ViewerOptionsTabDefinition,
	ViewerOptionsTabId,
} from '../internal/shared';
import { LOCALE_CATALOG } from '../internal/shared-src/i18n';
import type { LocaleCatalogEntry } from '../internal/shared-src/i18n';
import { OptionsAddInsPaneComponent } from './options-add-ins-pane.component';
import { OptionsPaneComponent } from './options-pane.component';
import type { OptionValueChange } from './options-pane.component';
import { OptionsQuickAccessPaneComponent } from './options-quick-access-pane.component';
import { OptionsRibbonPaneComponent } from './options-ribbon-pane.component';
import type { RibbonTabHiddenChange } from './options-ribbon-pane.component';
import { SettingsAppearanceTabComponent } from './settings-appearance-tab.component';
import { SettingsLanguageTabComponent } from './settings-language-tab.component';

export type { ViewerSettings } from '../internal/shared';

/** The ten File > Options categories the dialog's rail renders, in order. */
export const OPTIONS_DIALOG_TABS: readonly ViewerOptionsTabDefinition[] = VIEWER_OPTIONS_TABS;

/** Resolve the active tab definition, falling back to the first category. */
export function resolveOptionsTab(id: ViewerOptionsTabId): ViewerOptionsTabDefinition {
	const fallback = OPTIONS_DIALOG_TABS[0] as ViewerOptionsTabDefinition;
	return OPTIONS_DIALOG_TABS.find((tab) => tab.id === id) ?? fallback;
}

@Component({
	selector: 'pptx-settings-dialog',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		TranslatePipe,
		OptionsPaneComponent,
		OptionsRibbonPaneComponent,
		OptionsQuickAccessPaneComponent,
		OptionsAddInsPaneComponent,
		SettingsAppearanceTabComponent,
		SettingsLanguageTabComponent,
	],
	template: `
		@if (open()) {
			<button
				type="button"
				class="pptx-ng-options-backdrop"
				[attr.aria-label]="'pptx.settings.closeSettings' | translate"
				(click)="close.emit()"
			></button>
			<div
				class="pptx-ng-options-modal"
				role="dialog"
				aria-modal="true"
				[attr.aria-label]="'pptx.options.title' | translate"
			>
				<div class="pptx-ng-options-header">
					<h2>{{ 'pptx.options.title' | translate }}</h2>
					<button
						type="button"
						class="pptx-ng-options-x"
						[attr.aria-label]="'pptx.settings.close' | translate"
						(click)="close.emit()"
					>
						&#10005;
					</button>
				</div>

				<div class="pptx-ng-options-layout">
					<nav [attr.aria-label]="'pptx.options.title' | translate">
						@for (tab of tabs; track tab.id) {
							<button
								type="button"
								[attr.aria-current]="activeTabId() === tab.id"
								[class.is-active]="activeTabId() === tab.id"
								(click)="activeTabId.set(tab.id)"
							>
								{{ tab.labelKey | translate }}
							</button>
						}
					</nav>

					<div class="pptx-ng-options-content">
						@switch (activeTab().custom) {
							@case ('language') {
								<p class="pptx-ng-options-headline">{{ activeTab().descriptionKey | translate }}</p>
								<h3 class="pptx-ng-options-subhead">
									{{ 'pptx.options.language.displayLanguage' | translate }}
								</h3>
								<p class="pptx-ng-options-note">
									{{ 'pptx.options.language.displayLanguageDescription' | translate }}
								</p>
								<pptx-settings-language-tab
									[locales]="availableLocales()"
									[activeCode]="localeCode()"
									(select)="localeSelect.emit($event)"
								/>
							}
							@case ('ribbon') {
								<p class="pptx-ng-options-headline">{{ activeTab().descriptionKey | translate }}</p>
								<pptx-options-ribbon-pane
									[options]="options()"
									(tabHiddenChange)="ribbonTabHiddenChange.emit($event)"
									(resetRibbon)="resetOptions.emit('ribbon')"
								/>
							}
							@case ('addIns') {
								<p class="pptx-ng-options-headline">{{ activeTab().descriptionKey | translate }}</p>
								<pptx-options-add-ins-pane [addinStatus]="addinStatus()" />
							}
							@default {
								<pptx-options-pane
									[tab]="activeTab()"
									[options]="options()"
									(valueChange)="optionChange.emit($event)"
									(clearCache)="clearCache.emit()"
								>
									<div themePicker>
										<pptx-settings-appearance-tab
											[themes]="availableThemes()"
											[activeKey]="themeKey()"
											(select)="themeKeySelect.emit($event)"
										/>
									</div>
									@if (activeTab().custom === 'quickAccess') {
										<pptx-options-quick-access-pane
											[options]="options()"
											(commandsChange)="quickAccessCommandsChange.emit($event)"
										/>
									}
								</pptx-options-pane>
							}
						}
					</div>
				</div>

				<div class="pptx-ng-options-footer">
					<button
						type="button"
						class="pptx-ng-options-ghost"
						(click)="resetOptions.emit(undefined)"
					>
						{{ 'pptx.options.resetAll' | translate }}
					</button>
					<span class="pptx-ng-options-footer-end">
						<button type="button" class="pptx-ng-options-ghost" (click)="cancel()">
							{{ 'pptx.common.cancel' | translate }}
						</button>
						<button type="button" class="pptx-ng-options-ok" (click)="close.emit()">
							{{ 'pptx.common.ok' | translate }}
						</button>
					</span>
				</div>
			</div>
		}
	`,
	styleUrl: './settings-dialog.component.css',
})
export class SettingsDialogComponent {
	readonly open = input(false);
	/** Full File > Options snapshot rendered by every pane. */
	readonly options = input.required<ViewerOptions>();
	/** Selected theme catalog key, for General > Appearance. */
	readonly themeKey = input<string>('default');
	readonly availableThemes = input<readonly ThemeCatalogEntry[]>(THEME_CATALOG);
	/** Active locale code, for the Language category. */
	readonly localeCode = input<string>('en');
	readonly availableLocales = input<readonly LocaleCatalogEntry[]>(LOCALE_CATALOG);
	/** Availability flags for the Add-ins pane (unset ids default to active). */
	readonly addinStatus = input<ViewerAddinStatus | undefined>(undefined);

	readonly optionChange = output<OptionValueChange>();
	/** Restore a snapshot wholesale (Cancel semantics). */
	readonly restoreOptions = output<ViewerOptions>();
	readonly ribbonTabHiddenChange = output<RibbonTabHiddenChange>();
	readonly quickAccessCommandsChange = output<string[]>();
	/** Reset one tab-group (or everything when `undefined`). */
	readonly resetOptions = output<ViewerOptionsGroupId | undefined>();
	readonly clearCache = output<void>();
	readonly themeKeySelect = output<string>();
	readonly localeSelect = output<string>();
	readonly close = output<void>();

	protected readonly tabs = OPTIONS_DIALOG_TABS;
	protected readonly activeTabId = signal<ViewerOptionsTabId>('general');
	protected readonly activeTab = computed(() => resolveOptionsTab(this.activeTabId()));

	/** Snapshot taken when the dialog opens, restored by Cancel. */
	private snapshot: ViewerOptions | null = null;
	private wasOpen = false;

	constructor() {
		effect(() => {
			const isOpen = this.open();
			if (isOpen && !this.wasOpen) {
				this.snapshot = untracked(() => this.options());
			}
			this.wasOpen = isOpen;
		});
	}

	/** Cancel: restore the on-open snapshot, then close. */
	protected cancel(): void {
		if (this.snapshot) {
			this.restoreOptions.emit(this.snapshot);
		}
		this.close.emit();
	}

	/** Escape confirms (keeps edits), mirroring React's dialog. */
	@HostListener('document:keydown.escape')
	protected onEscape(): void {
		if (this.open()) {
			this.close.emit();
		}
	}
}
