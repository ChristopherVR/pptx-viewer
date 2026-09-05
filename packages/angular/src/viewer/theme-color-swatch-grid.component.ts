/**
 * theme-color-swatch-grid.component.ts: PowerPoint's "Theme Colors" grid (ten
 * columns - Background 1, Text 1, Background 2, Text 2, Accent 1..6 - each
 * with a base swatch and five luminance variants), built from the loaded
 * deck's real theme colours (`LoadContentService.themeColorMap`) rather than
 * a hard-coded Office palette.
 *
 * Mirrors React's `ThemeColorSwatchGrid.tsx` and Vue's
 * `ThemeColorSwatchGrid.vue`: a presentational grid that emits `pick` with
 * BOTH the resolved hex and the `PptxThemeColorRef` a caller should store so
 * the colour keeps following the theme after a later theme change.
 *
 * Renders nothing (not even the heading) when no deck theme is loaded yet,
 * so callers can render this unconditionally alongside their existing
 * hex/recent-colour controls.
 *
 * @module viewer/theme-color-swatch-grid
 */
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxThemeColorRef } from 'pptx-viewer-core';

import type { ThemeColorPickerCommit } from '../internal/shared';
import {
	buildThemeColorSwatchGrid,
	findSelectedThemeSwatch,
	themeColorSwatchRows,
	themeSwatchCommit,
} from '../internal/shared';
import { LoadContentService } from './load-content.service';

@Component({
	selector: 'pptx-theme-color-swatch-grid',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		@if (columns().length > 0) {
			<div class="pptx-theme-swatch-grid">
				<div class="pptx-theme-swatch-grid__heading">
					{{ 'pptx.colorPicker.themeColors' | translate }}
				</div>
				<div class="pptx-theme-swatch-grid__rows">
					@for (row of rows(); track $index) {
						<div class="pptx-theme-swatch-grid__row">
							@for (swatch of row; track $index) {
								@if (swatch) {
									<button
										type="button"
										data-pptx-compact
										class="pptx-theme-swatch-grid__swatch"
										[class.pptx-theme-swatch-grid__swatch--selected]="selected() === swatch"
										[style.background]="swatch.hex"
										[title]="swatch.label"
										[attr.aria-label]="swatch.label"
										[disabled]="disabled()"
										(mousedown)="$event.preventDefault()"
										(click)="pick.emit(commitOf(swatch))"
									></button>
								} @else {
									<div class="pptx-theme-swatch-grid__empty"></div>
								}
							}
						</div>
					}
				</div>
			</div>
		}
	`,
	styles: `
		.pptx-theme-swatch-grid {
			display: flex;
			flex-direction: column;
			gap: 0.2rem;
			margin-top: 0.25rem;
		}

		.pptx-theme-swatch-grid__heading {
			font-size: 10px;
			color: var(--pptx-inspector-muted, #888);
		}

		.pptx-theme-swatch-grid__rows {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
		}

		.pptx-theme-swatch-grid__row {
			display: flex;
			gap: 0.125rem;
		}

		.pptx-theme-swatch-grid__swatch,
		.pptx-theme-swatch-grid__empty {
			height: 1rem;
			width: 1rem;
		}

		.pptx-theme-swatch-grid__swatch {
			padding: 0;
			border-radius: 2px;
			border: 1px solid var(--pptx-inspector-border, #444);
			cursor: pointer;
			transition: transform 0.1s ease;
		}

		.pptx-theme-swatch-grid__swatch:hover:not(:disabled) {
			transform: scale(1.1);
		}

		.pptx-theme-swatch-grid__swatch:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}

		.pptx-theme-swatch-grid__swatch--selected {
			border-color: var(--pptx-inspector-primary, #3b82f6);
			box-shadow: 0 0 0 1px var(--pptx-inspector-primary, #3b82f6);
		}
	`,
})
export class ThemeColorSwatchGridComponent {
	private readonly loader = inject(LoadContentService);

	readonly disabled = input<boolean>(false);
	/** The element's current theme ref, if any (highlights the matching swatch). */
	readonly selectedRef = input<PptxThemeColorRef | undefined>(undefined);
	/** The element's current resolved hex, used to highlight a swatch when no ref is stored. */
	readonly selectedHex = input<string | undefined>(undefined);
	/** A swatch was clicked: both the resolved hex and the ref to store. */
	readonly pick = output<ThemeColorPickerCommit>();

	protected readonly columns = computed(() =>
		buildThemeColorSwatchGrid(this.loader.themeColorMap()),
	);
	protected readonly rows = computed(() => themeColorSwatchRows(this.columns()));
	protected readonly selected = computed(() =>
		findSelectedThemeSwatch(this.columns(), this.selectedRef(), this.selectedHex()),
	);

	protected commitOf = themeSwatchCommit;
}
