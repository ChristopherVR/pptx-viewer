/**
 * settings-language-tab.component.ts: File > Options > Language tab.
 *
 * A simple list over the resolved locale catalog (host-supplied
 * `availableLocales`, or every locale `TranslateService.getLangs()` reports
 * registered, mapped through `LOCALE_CATALOG` for display labels). Extracted
 * out of `SettingsDialogComponent` to keep that file under the repo's
 * ~300-LOC guideline.
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import type { LocaleCatalogEntry } from '../internal/shared-src/i18n';

@Component({
	selector: 'pptx-settings-language-tab',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="pptx-ng-settings-list" role="radiogroup">
			@for (entry of locales(); track entry.code) {
				<button
					type="button"
					role="radio"
					class="pptx-ng-settings-row pptx-ng-lang-row"
					[attr.aria-checked]="entry.code === activeCode()"
					[class.is-active]="entry.code === activeCode()"
					(click)="select.emit(entry.code)"
				>
					<span>{{ entry.nativeLabel }}</span>
					<span class="pptx-ng-lang-en">{{ entry.label }}</span>
				</button>
			}
		</div>
	`,
	styles: [
		`
			.pptx-ng-lang-row {
				width: 100%;
				border: 0;
				background: transparent;
				color: inherit;
				cursor: pointer;
			}
			.pptx-ng-lang-row.is-active {
				color: var(--pptx-primary);
				font-weight: 600;
			}
			.pptx-ng-lang-en {
				color: var(--pptx-muted-foreground);
			}
		`,
	],
})
export class SettingsLanguageTabComponent {
	readonly locales = input.required<readonly LocaleCatalogEntry[]>();
	readonly activeCode = input<string>('en');
	readonly select = output<string>();
}
