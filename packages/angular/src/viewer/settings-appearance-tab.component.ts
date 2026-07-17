/**
 * settings-appearance-tab.component.ts: File > Options > Appearance tab.
 *
 * A theme-preset swatch gallery over `THEME_CATALOG` (or a host-supplied
 * `availableThemes` catalog), extracted out of `SettingsDialogComponent` to
 * keep that file under the repo's ~300-LOC guideline. Mirrors the swatch
 * pattern used by the vanilla/Svelte Design tab theme galleries, adapted to
 * this binding's CSS-variable-driven visual language.
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { ThemeCatalogEntry } from '../internal/shared';

@Component({
	selector: 'pptx-settings-appearance-tab',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<div class="pptx-ng-theme-gallery" role="radiogroup">
			@for (entry of themes(); track entry.key) {
				<button
					type="button"
					role="radio"
					class="pptx-ng-theme-swatch"
					[attr.aria-checked]="entry.key === activeKey()"
					[class.is-active]="entry.key === activeKey()"
					(click)="select.emit(entry.key)"
				>
					<span class="pptx-ng-theme-swatch-preview" [style.background]="swatchColor(entry)"></span>
					<span>{{ entry.labelKey | translate }}</span>
				</button>
			}
		</div>
	`,
	styles: [
		`
			.pptx-ng-theme-gallery {
				display: grid;
				grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
				gap: 10px;
				padding-top: 8px;
			}
			.pptx-ng-theme-swatch {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 8px;
				padding: 10px 8px;
				border: 1px solid var(--pptx-border);
				border-radius: 6px;
				background: var(--pptx-card);
				color: inherit;
				font-size: 12px;
				cursor: pointer;
			}
			.pptx-ng-theme-swatch.is-active {
				border-color: var(--pptx-primary);
				box-shadow: 0 0 0 1px var(--pptx-primary);
			}
			.pptx-ng-theme-swatch-preview {
				width: 100%;
				height: 32px;
				border-radius: 4px;
			}
		`,
	],
})
export class SettingsAppearanceTabComponent {
	readonly themes = input.required<readonly ThemeCatalogEntry[]>();
	readonly activeKey = input<string>('default');
	readonly select = output<string>();

	protected swatchColor(entry: ThemeCatalogEntry): string {
		return entry.theme?.colors?.primary ?? '#6b7280';
	}
}
