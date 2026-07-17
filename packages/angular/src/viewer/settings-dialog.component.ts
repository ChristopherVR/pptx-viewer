import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import {
	SETTING_TOGGLES,
	SHORTCUT_REFERENCE_ITEMS,
	THEME_CATALOG,
	updateViewerPreference,
} from '../internal/shared';
import type { ThemeCatalogEntry, ViewerSettings } from '../internal/shared';
import { LOCALE_CATALOG } from '../internal/shared-src/i18n';
import type { LocaleCatalogEntry } from '../internal/shared-src/i18n';
import { ModalDialogComponent } from './modal-dialog.component';
import { SettingsAppearanceTabComponent } from './settings-appearance-tab.component';
import { SettingsLanguageTabComponent } from './settings-language-tab.component';

export type { ViewerSettings } from '../internal/shared';

export function toggleViewerSetting(
	settings: ViewerSettings,
	key: keyof ViewerSettings,
): ViewerSettings {
	return updateViewerPreference(settings, key, !settings[key]);
}

@Component({
	selector: 'pptx-settings-dialog',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		ModalDialogComponent,
		TranslatePipe,
		SettingsAppearanceTabComponent,
		SettingsLanguageTabComponent,
	],
	template: `
		<pptx-modal-dialog
			[open]="open()"
			[title]="'pptx.settings.title' | translate"
			(close)="close.emit()"
		>
			<div class="pptx-ng-settings">
				<div class="pptx-ng-settings-tabs" role="tablist">
					<button
						type="button"
						role="tab"
						[attr.aria-selected]="activeTab() === 'general'"
						[class.is-active]="activeTab() === 'general'"
						(click)="activeTab.set('general')"
					>
						{{ 'pptx.settings.general' | translate }}
					</button>
					<button
						type="button"
						role="tab"
						[attr.aria-selected]="activeTab() === 'appearance'"
						[class.is-active]="activeTab() === 'appearance'"
						(click)="activeTab.set('appearance')"
					>
						{{ 'pptx.settings.appearance' | translate }}
					</button>
					<button
						type="button"
						role="tab"
						[attr.aria-selected]="activeTab() === 'language'"
						[class.is-active]="activeTab() === 'language'"
						(click)="activeTab.set('language')"
					>
						{{ 'pptx.settings.language' | translate }}
					</button>
					<button
						type="button"
						role="tab"
						[attr.aria-selected]="activeTab() === 'shortcuts'"
						[class.is-active]="activeTab() === 'shortcuts'"
						(click)="activeTab.set('shortcuts')"
					>
						{{ 'pptx.settings.keyboardShortcuts' | translate }}
					</button>
				</div>

				@if (activeTab() === 'general') {
					<div class="pptx-ng-settings-list">
						@for (spec of specs; track spec.key) {
							<div class="pptx-ng-settings-row">
								<span>{{ spec.labelKey | translate }}</span>
								<button
									type="button"
									role="switch"
									[attr.aria-checked]="settings()[spec.key]"
									[attr.aria-label]="spec.labelKey | translate"
									[class.is-on]="settings()[spec.key]"
									(click)="toggle(spec.key)"
								>
									<span></span>
								</button>
							</div>
						}
					</div>
				} @else if (activeTab() === 'appearance') {
					<pptx-settings-appearance-tab
						[themes]="availableThemes()"
						[activeKey]="themeKey()"
						(select)="themeKeySelect.emit($event)"
					/>
				} @else if (activeTab() === 'language') {
					<pptx-settings-language-tab
						[locales]="availableLocales()"
						[activeCode]="localeCode()"
						(select)="localeSelect.emit($event)"
					/>
				} @else {
					<div class="pptx-ng-settings-list">
						@for (item of shortcuts; track item.actionKey; let even = $even) {
							<div class="pptx-ng-shortcut-row" [class.is-alt]="even">
								<span>{{ item.actionKey | translate }}</span>
								<kbd>{{ item.shortcut }}</kbd>
							</div>
						}
					</div>
				}
			</div>
			<button footer type="button" class="pptx-ng-settings-done" (click)="close.emit()">
				{{ 'pptx.settings.done' | translate }}
			</button>
		</pptx-modal-dialog>
	`,
	styles: [
		`
			.pptx-ng-settings {
				min-width: 320px;
			}
			.pptx-ng-settings-tabs {
				display: flex;
				flex-wrap: wrap;
				gap: 4px;
				border-bottom: 1px solid var(--pptx-border);
			}
			.pptx-ng-settings-tabs button {
				padding: 7px 10px;
				border: 0;
				border-bottom: 2px solid transparent;
				background: transparent;
				color: var(--pptx-muted-foreground);
				font-size: 12px;
				cursor: pointer;
			}
			.pptx-ng-settings-tabs button.is-active {
				border-bottom-color: var(--pptx-primary);
				color: var(--pptx-primary);
			}
			.pptx-ng-settings-list {
				max-height: 56vh;
				overflow-y: auto;
				padding-top: 8px;
			}
			.pptx-ng-settings-row,
			.pptx-ng-shortcut-row {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 12px;
				padding: 9px 10px;
				font-size: 13px;
			}
			.pptx-ng-settings-row button {
				position: relative;
				width: 36px;
				height: 20px;
				padding: 0;
				border: 0;
				border-radius: 999px;
				background: color-mix(in srgb, var(--pptx-muted-foreground) 30%, transparent);
				cursor: pointer;
			}
			.pptx-ng-settings-row button span {
				position: absolute;
				top: 3px;
				left: 3px;
				width: 14px;
				height: 14px;
				border-radius: 50%;
				background: white;
				transition: transform 120ms ease;
			}
			.pptx-ng-settings-row button.is-on {
				background: var(--pptx-primary);
			}
			.pptx-ng-settings-row button.is-on span {
				transform: translateX(16px);
			}
			.pptx-ng-shortcut-row.is-alt {
				background: var(--pptx-muted);
			}
			.pptx-ng-shortcut-row kbd {
				color: var(--pptx-muted-foreground);
				font:
					11px ui-monospace,
					monospace;
				white-space: nowrap;
			}
			.pptx-ng-settings-done {
				border: 0;
				border-radius: 4px;
				padding: 7px 14px;
				background: var(--pptx-primary);
				color: white;
				cursor: pointer;
			}
		`,
	],
})
export class SettingsDialogComponent {
	readonly open = input(false);
	readonly settings = input.required<ViewerSettings>();
	/** Selected `THEME_CATALOG` (or `availableThemes`) key, for the Appearance tab. */
	readonly themeKey = input<string>('default');
	/** Theme choices offered by the Appearance tab. Defaults to the built-in `THEME_CATALOG`. */
	readonly availableThemes = input<readonly ThemeCatalogEntry[]>(THEME_CATALOG);
	/** Active locale code, for the Language tab. */
	readonly localeCode = input<string>('en');
	/** Locale choices offered by the Language tab. Defaults to the built-in `LOCALE_CATALOG`. */
	readonly availableLocales = input<readonly LocaleCatalogEntry[]>(LOCALE_CATALOG);
	readonly settingsChange = output<ViewerSettings>();
	/** Fired when the user picks an Appearance tab swatch. */
	readonly themeKeySelect = output<string>();
	/** Fired when the user picks a Language tab entry. */
	readonly localeSelect = output<string>();
	readonly close = output<void>();
	protected readonly activeTab = signal<'general' | 'appearance' | 'language' | 'shortcuts'>(
		'general',
	);
	protected readonly specs = SETTING_TOGGLES;
	protected readonly shortcuts = SHORTCUT_REFERENCE_ITEMS;

	protected toggle(key: keyof ViewerSettings): void {
		this.settingsChange.emit(toggleViewerSetting(this.settings(), key));
	}
}
