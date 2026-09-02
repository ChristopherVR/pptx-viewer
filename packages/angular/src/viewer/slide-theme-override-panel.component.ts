import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { ColorMapAliasKey, PptxSlide, PptxTheme } from 'pptx-viewer-core';
import {
	applyThemeOverrideToSlide,
	COLOR_MAP_ALIAS_KEYS,
	DEFAULT_COLOR_MAP,
	THEME_COLOR_SCHEME_KEYS,
} from 'pptx-viewer-core';

import { themeColorSlotLabelKey } from './schema-token-labels';

/**
 * Row label per `p:clrMapOvr` alias, as an i18n key where one exists.
 *
 * The eight aliases that are named after a theme slot reuse the shared slot
 * catalogue, so they translate and spell the slot exactly as the picker beside
 * them does. `bg1`/`tx1`/`bg2`/`tx2` name the colour MAP rather than a slot and
 * the shared dictionary has no key for them yet, so they stay the English
 * literal the reference binding shows; `TranslatePipe` echoes an unknown key
 * unchanged, so both kinds render correctly through the same expression.
 */
const LABELS: Record<ColorMapAliasKey, string> = {
	bg1: 'Background 1',
	tx1: 'Text 1',
	bg2: 'Background 2',
	tx2: 'Text 2',
	accent1: themeColorSlotLabelKey('accent1'),
	accent2: themeColorSlotLabelKey('accent2'),
	accent3: themeColorSlotLabelKey('accent3'),
	accent4: themeColorSlotLabelKey('accent4'),
	accent5: themeColorSlotLabelKey('accent5'),
	accent6: themeColorSlotLabelKey('accent6'),
	hlink: themeColorSlotLabelKey('hlink'),
	folHlink: themeColorSlotLabelKey('folHlink'),
};

export { LABELS as COLOR_MAP_ALIAS_LABEL_KEYS };

export function createIdentityColorMapOverride(): Record<string, string> {
	return Object.fromEntries(COLOR_MAP_ALIAS_KEYS.map((key) => [key, DEFAULT_COLOR_MAP[key]]));
}

@Component({
	selector: 'pptx-slide-theme-override-panel',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<div class="override">
			<label class="toggle">
				<input type="checkbox" [checked]="active()" (change)="toggle($event)" />
				<span>{{ 'pptx.themeOverride.enableOverride' | translate }}</span>
			</label>
			@if (active()) {
				@for (alias of aliases; track alias) {
					<label class="mapping">
						<span>{{ labels[alias] | translate }}</span>
						<i [style.background-color]="slotColor(current(alias))"></i>
						<select
							[attr.aria-label]="labels[alias] | translate"
							[value]="current(alias)"
							(change)="change(alias, $event)"
						>
							@for (slot of slots; track slot) {
								<option [value]="slot" [selected]="slot === current(alias)">
									{{ slotLabelKey(slot) | translate }}
								</option>
							}
						</select>
					</label>
				}
			}
		</div>
	`,
	styles: `
		.override {
			display: grid;
			gap: 6px;
			margin-top: 8px;
			padding-top: 8px;
			border-top: 1px solid var(--pptx-inspector-border, #444);
			font-size: 11px;
		}
		.toggle {
			display: flex;
			align-items: center;
			gap: 7px;
		}
		.mapping {
			display: grid;
			grid-template-columns: 90px 16px 1fr;
			align-items: center;
			gap: 6px;
		}
		.mapping span {
			overflow: hidden;
			text-overflow: ellipsis;
			color: var(--pptx-inspector-muted, #aaa);
		}
		i {
			width: 14px;
			height: 14px;
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 3px;
		}
		select {
			box-sizing: border-box;
			min-width: 0;
			width: 100%;
			padding: 3px 5px;
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 3px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			color: inherit;
		}
	`,
})
export class SlideThemeOverridePanelComponent {
	readonly slide = input.required<PptxSlide>();
	readonly theme = input<PptxTheme | undefined>();
	readonly patch = output<Partial<PptxSlide>>();

	protected readonly aliases = COLOR_MAP_ALIAS_KEYS;
	protected readonly slots = THEME_COLOR_SCHEME_KEYS;
	protected readonly labels = LABELS;
	protected readonly active = computed(() => this.slide().clrMapOverride !== undefined);

	/**
	 * Spell a target slot: the picker used to offer `dk1` / `folHlink` verbatim,
	 * which read as noise next to the friendly alias label in the same row.
	 */
	protected slotLabelKey(slot: string): string {
		return themeColorSlotLabelKey(slot);
	}

	protected current(alias: ColorMapAliasKey): string {
		return this.slide().clrMapOverride?.[alias] ?? DEFAULT_COLOR_MAP[alias];
	}

	protected slotColor(slot: string): string | undefined {
		const value = (this.theme()?.colorScheme as Record<string, string | undefined> | undefined)?.[
			slot
		];
		return value ? `#${value.replace(/^#/u, '')}` : undefined;
	}

	private emitOverride(override: Record<string, string> | undefined): void {
		const theme = this.theme();
		if (!theme?.colorScheme) {
			this.patch.emit({ clrMapOverride: override });
			return;
		}
		const slide = applyThemeOverrideToSlide(this.slide(), theme.colorScheme, override);
		this.patch.emit({
			clrMapOverride: slide.clrMapOverride,
			backgroundColor: slide.backgroundColor,
			elements: slide.elements,
		});
	}

	protected toggle(event: Event): void {
		if (!(event.target as HTMLInputElement).checked) {
			this.emitOverride(undefined);
			return;
		}
		this.emitOverride(createIdentityColorMapOverride());
	}

	protected change(alias: ColorMapAliasKey, event: Event): void {
		const override = Object.fromEntries(
			COLOR_MAP_ALIAS_KEYS.map((key) => [key, this.current(key)]),
		) as Record<string, string>;
		override[alias] = (event.target as HTMLSelectElement).value;
		this.emitOverride(override);
	}
}
