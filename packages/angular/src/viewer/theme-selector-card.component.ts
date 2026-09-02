/**
 * theme-selector-card.component.ts: THEME card of the default (no-selection)
 * inspector, mirroring React's `ThemeSelectorCard` + `useInspectorPaneState`
 * fallback: a dropdown of the package's theme parts plus "Apply First Master"
 * / "Apply All Masters" actions routed through
 * {@link LoadContentService.setPresentationTheme}.
 */
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxThemeOption } from 'pptx-viewer-core';

import { EditorStateService } from './editor-state.service';
import { INSPECTOR_CARD_STYLES } from './inspector-card-styles';
import { LoadContentService } from './load-content.service';

@Component({
	selector: 'pptx-theme-selector-card',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<section class="icard">
			<h3 class="icard__heading">{{ 'pptx.documentProperties.themeHeading' | translate }}</h3>
			<label class="icard__col">
				<span class="icard__label">{{ 'pptx.documentProperties.themeHeading' | translate }}</span>
				<select
					[attr.aria-label]="'pptx.documentProperties.themeHeading' | translate"
					class="icard__select"
					[disabled]="options().length === 0"
					[value]="selectedThemePath()"
					(change)="onSelect($event)"
				>
					@if (options().length === 0) {
						<option value="">{{ 'pptx.documentProperties.noThemesOption' | translate }}</option>
					} @else {
						@for (opt of options(); track opt.path) {
							<option [value]="opt.path" [selected]="opt.path === selectedThemePath()">
								{{ optionLabel(opt) }}
							</option>
						}
					}
				</select>
			</label>
			<div class="icard__grid2">
				<button
					type="button"
					class="icard__btn"
					[disabled]="!canEdit() || !selectedThemePath()"
					(click)="apply(false)"
				>
					{{ 'pptx.documentProperties.applyFirstMaster' | translate }}
				</button>
				<button
					type="button"
					class="icard__btn"
					[disabled]="!canEdit() || !selectedThemePath()"
					(click)="apply(true)"
				>
					{{ 'pptx.documentProperties.applyAllMasters' | translate }}
				</button>
			</div>
		</section>
	`,
	styles: [INSPECTOR_CARD_STYLES],
})
export class ThemeSelectorCardComponent {
	/** Whether the apply actions are enabled. */
	readonly canEdit = input<boolean>(true);

	private readonly loader = inject(LoadContentService);
	private readonly editor = inject(EditorStateService);

	/** Theme path the user explicitly picked (null = follow the active theme). */
	private readonly userSelectedPath = signal<string | null>(null);

	private readonly activeThemePath = computed(() => this.loader.slideMasters()[0]?.themePath);

	/**
	 * Package theme options, falling back to the first master's own theme when
	 * the package listed none (same fallback as React's `useInspectorPaneState`).
	 */
	protected readonly options = computed<PptxThemeOption[]>(() => {
		const options = this.loader.themeOptions();
		const activePath = this.activeThemePath();
		if (options.length > 0 || !activePath) {
			return options;
		}
		return [{ path: activePath, name: this.loader.theme()?.name }];
	});

	protected readonly selectedThemePath = computed(
		() => this.userSelectedPath() ?? this.activeThemePath() ?? this.options()[0]?.path ?? '',
	);

	protected optionLabel(option: PptxThemeOption): string {
		return option.name || option.path.split('/').pop() || option.path;
	}

	protected onSelect(event: Event): void {
		this.userSelectedPath.set((event.target as HTMLSelectElement).value);
	}

	protected async apply(allMasters: boolean): Promise<void> {
		const path = this.selectedThemePath();
		if (!path) {
			return;
		}
		await this.loader.setPresentationTheme(path, allMasters);
		this.editor.dirty.set(true);
	}
}
