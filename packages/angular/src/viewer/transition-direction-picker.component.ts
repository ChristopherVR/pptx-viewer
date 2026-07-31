/**
 * transition-direction-picker.component.ts: the arrow control for a slide
 * transition's `dir` attribute, mirroring React's
 * `inspector/DirectionPicker.tsx`.
 *
 * Selector: `pptx-transition-direction-picker`
 *
 * WHY two layouts: three or fewer tokens (`in`/`out`, `vertical`/`horizontal`
 * pairs) have no compass position and read best as an inline row; four or more
 * lay out on the 3x3 grid built by the shared `buildDirectionGrid`, so a picker
 * for `push` and one for `cover` agree on where "up-left" sits. Both the glyph
 * table and the grid placement come from `pptx-viewer-shared`, so every binding
 * draws the identical control.
 *
 * @module viewer/transition-direction-picker
 */
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { TRANSITION_DIR_ARROWS, buildDirectionGrid } from '../internal/shared';

/** One rendered grid slot: a direction token, or a blank spacer. */
interface DirectionCell {
	/** Stable key for `@for` tracking (cells can repeat `null`). */
	readonly key: string;
	/** The direction token, or null for an empty compass slot. */
	readonly value: string | null;
	/** Arrow glyph for the token (falls back to the raw token). */
	readonly arrow: string;
}

@Component({
	selector: 'pptx-transition-direction-picker',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		@if (useGrid()) {
			<div class="dir dir--grid">
				@for (cell of gridCells(); track cell.key) {
					@if (cell.value; as token) {
						<button
							type="button"
							class="dir__btn"
							[class.is-active]="value() === token"
							[disabled]="disabled()"
							[attr.aria-pressed]="value() === token"
							[attr.aria-label]="'pptx.transition.dir.' + token | translate"
							[title]="'pptx.transition.dir.' + token | translate"
							(click)="pick.emit(token)"
						>
							{{ cell.arrow }}
						</button>
					} @else {
						<span class="dir__spacer"></span>
					}
				}
			</div>
		} @else {
			<div class="dir dir--row">
				@for (token of directions(); track token) {
					<button
						type="button"
						class="dir__btn"
						[class.is-active]="value() === token"
						[disabled]="disabled()"
						[attr.aria-pressed]="value() === token"
						[attr.aria-label]="'pptx.transition.dir.' + token | translate"
						[title]="'pptx.transition.dir.' + token | translate"
						(click)="pick.emit(token)"
					>
						{{ arrowFor(token) }}
					</button>
				}
			</div>
		}
	`,
	styles: `
		:host {
			display: block;
		}
		.dir--grid {
			display: inline-grid;
			grid-template-columns: repeat(3, 22px);
			gap: 2px;
		}
		.dir--row {
			display: flex;
			gap: 3px;
		}
		.dir__btn {
			min-width: 22px;
			height: 22px;
			padding: 0 4px;
			background: var(--pptx-inspector-input-bg, rgba(0, 0, 0, 0.06));
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 3px;
			color: inherit;
			font: inherit;
			font-size: 11px;
			line-height: 1;
			cursor: pointer;
		}
		.dir__btn:disabled {
			opacity: 0.5;
			cursor: default;
		}
		.dir__btn.is-active {
			background: var(--pptx-inspector-active, #0078d4);
			border-color: var(--pptx-inspector-active, #0078d4);
			color: #fff;
		}
		.dir__spacer {
			width: 22px;
			height: 22px;
		}
	`,
})
export class TransitionDirectionPickerComponent {
	/** Valid direction tokens for the current transition type. */
	readonly directions = input.required<readonly string[]>();
	/** Currently selected token, if any. */
	readonly value = input<string | undefined>(undefined);
	/** Whether the buttons are inert (read-only deck). */
	readonly disabled = input<boolean>(false);

	/** The token the user chose. */
	readonly pick = output<string>();

	/** Four or more tokens earn the compass grid; fewer stay an inline row. */
	protected readonly useGrid = computed(() => this.directions().length > 3);

	protected readonly gridCells = computed<DirectionCell[]>(() =>
		buildDirectionGrid(this.directions()).flatMap((row, rowIndex) =>
			row.map((cell, columnIndex) => ({
				key: cell ?? `gap-${rowIndex}-${columnIndex}`,
				value: cell,
				arrow: cell ? this.arrowFor(cell) : '',
			})),
		),
	);

	/** Arrow glyph for a token, falling back to the raw token. */
	protected arrowFor(token: string): string {
		return TRANSITION_DIR_ARROWS[token] ?? token;
	}
}
