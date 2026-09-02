/**
 * recent-colors-row.component.ts: the reusable "Recent colours" swatch row
 * shown under a colour picker once at least one colour has been used
 * (`p:clrMru`, backed by {@link RecentColorsService}).
 *
 * Presentational only: clicking a swatch just emits `pick`. The caller both
 * applies the colour through its own commit path AND pushes it back into
 * `RecentColorsService` (which moves it to the front of the list), exactly
 * like React's `ColorPickerRow` and Vue's `RecentColorsRow.vue`.
 *
 * Extracted out of `RibbonColorPopoverComponent`'s inline markup so every
 * colour picker (ribbon popover, inspector fill/stroke/text) mounts the same
 * row instead of re-implementing it.
 *
 * @module viewer/recent-colors-row
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
	selector: 'pptx-recent-colors-row',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		@if (colors().length > 0) {
			<div
				class="pptx-recent-colors"
				data-testid="pptx-color-recent"
				[attr.aria-label]="'pptx.colorPicker.recentColors' | translate"
			>
				<span class="pptx-recent-colors__label">{{
					'pptx.colorPicker.recentColors' | translate
				}}</span>
				<div class="pptx-recent-colors__grid">
					@for (c of colors(); track c) {
						<button
							type="button"
							data-pptx-compact
							class="pptx-recent-colors__swatch"
							[style.background]="c"
							[title]="c"
							[attr.aria-label]="'Recent ' + c"
							[disabled]="disabled()"
							(mousedown)="$event.preventDefault()"
							(click)="pick.emit(c)"
						></button>
					}
				</div>
			</div>
		}
	`,
	styles: `
		.pptx-recent-colors {
			display: flex;
			flex-direction: column;
			gap: 0.2rem;
		}

		.pptx-recent-colors__label {
			font-size: 9px;
			text-transform: uppercase;
			letter-spacing: 0.02em;
			color: var(--pptx-inspector-muted, #888);
		}

		.pptx-recent-colors__grid {
			display: grid;
			grid-template-columns: repeat(5, 1fr);
			gap: 0.35rem;
		}

		.pptx-recent-colors__swatch {
			height: 1.25rem;
			width: 1.25rem;
			padding: 0;
			border-radius: 9999px;
			border: 1px solid var(--pptx-inspector-border, #444);
			cursor: pointer;
			transition: transform 0.1s ease;
		}

		.pptx-recent-colors__swatch:hover:not(:disabled) {
			transform: scale(1.25);
		}

		.pptx-recent-colors__swatch:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}
	`,
})
export class RecentColorsRowComponent {
	/** Most-recently-used colours, most-recent-first, `#RRGGBB` uppercase. */
	readonly colors = input<readonly string[]>([]);
	/** Disable every swatch (mirrors the host picker's own disabled state). */
	readonly disabled = input<boolean>(false);
	/** A swatch was clicked; the caller both applies AND pushes the colour. */
	readonly pick = output<string>();
}
