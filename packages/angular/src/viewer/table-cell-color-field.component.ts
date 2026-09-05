/**
 * table-cell-color-field.component.ts: a table cell colour field - the native
 * colour input plus the deck's real "Theme Colors" grid - used for both the
 * cell text colour (`color`/`colorRef`) and the cell fill colour
 * (`backgroundColor`/`backgroundColorRef`).
 *
 * Extracted so `TableCellFormattingComponent` (already over this repo's
 * 300-LOC file budget) does not grow to duplicate this block for both
 * fields. Mirrors React's `TableCellColorField.tsx` and Vue's
 * `TableCellColorField.vue`: a theme swatch commits both the resolved hex
 * and its `PptxThemeColorRef`; the native picker always clears the ref,
 * since a plain hex has no theme identity for PowerPoint to reapply.
 *
 * @module viewer/table-cell-color-field
 */
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import type { PptxThemeColorRef } from 'pptx-viewer-core';

import type { ThemeColorPickerCommit } from '../internal/shared';
import { normalizeHexColor } from '../internal/shared';
import { RecentColorsService } from './recent-colors.service';
import { ThemeColorSwatchGridComponent } from './theme-color-swatch-grid.component';

@Component({
	selector: 'pptx-table-cell-color-field',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ThemeColorSwatchGridComponent],
	template: `
		<label class="pptx-tccf__field">
			<span class="pptx-tccf__lbl">{{ label() }}</span>
			<input
				type="color"
				class="pptx-tccf__color"
				[disabled]="disabled()"
				[value]="hex()"
				(input)="onNativeChange($event)"
				(change)="onNativeCommit($event)"
			/>
			<pptx-theme-color-swatch-grid
				[disabled]="disabled()"
				[selectedRef]="selectedRef()"
				[selectedHex]="hex()"
				(pick)="onThemePick($event)"
			/>
		</label>
	`,
	styles: `
		.pptx-tccf__field {
			display: flex;
			flex-direction: column;
			gap: 0.2rem;
		}
		.pptx-tccf__lbl {
			font-size: 10px;
			color: var(--pptx-inspector-muted, #888);
		}
		.pptx-tccf__color {
			width: 28px;
			height: 22px;
			padding: 0;
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 3px;
			background: transparent;
			cursor: pointer;
		}
	`,
})
export class TableCellColorFieldComponent {
	readonly label = input.required<string>();
	readonly value = input<string | undefined>(undefined);
	readonly fallback = input.required<string>();
	/** The cell's current theme ref, if any (highlights the matching theme swatch). */
	readonly selectedRef = input<PptxThemeColorRef | undefined>(undefined);
	readonly disabled = input<boolean>(false);
	/** Applies the picked colour: `ref` is set for a theme swatch, `undefined` for a native pick. */
	readonly commit = output<ThemeColorPickerCommit>();

	/** Optional: absent in a standalone unit test with no viewer-level DI tree. */
	private readonly recentColors = inject(RecentColorsService, { optional: true });

	protected readonly hex = computed(() => normalizeHexColor(this.value(), this.fallback()));

	/** Live preview while dragging the native picker: no theme identity, so always clears the ref. */
	protected onNativeChange(event: Event): void {
		const value = inputValue(event);
		if (value) {
			this.commit.emit({ hex: value, ref: undefined });
		}
	}

	/** The committed (native `change`, not the live-preview `input`) colour: record it as recent. */
	protected onNativeCommit(event: Event): void {
		const value = inputValue(event);
		if (value) {
			this.recentColors?.push(value);
		}
	}

	/** A theme-swatch pick: commits BOTH the resolved hex and the ref. */
	protected onThemePick(pick: ThemeColorPickerCommit): void {
		this.commit.emit(pick);
		this.recentColors?.push(pick.hex);
	}
}

function inputValue(event: Event): string {
	const t = event.target;
	return t instanceof HTMLInputElement ? t.value : '';
}
