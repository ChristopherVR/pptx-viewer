/**
 * table-style-editor-fields.component.ts: field editors (fill/text/borders)
 * for whichever part `TableStyleEditorComponent` currently has selected.
 * Split out from that shell purely to keep both files under the repo's
 * 300-LOC budget. Mirrors React's `TableStyleEditorFields.tsx` and Vue's
 * `TableStyleEditorFields.vue`.
 *
 * @module viewer/table-style-editor-fields
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { TableStyleEditorDescriptor, TableStyleEditorFieldEdit } from '../internal/shared';
import {
	TABLE_STYLE_BORDER_SIDE_LABEL_KEYS,
	TABLE_STYLE_BORDER_SIDES,
	TABLE_STYLE_DASH_PRESETS,
} from '../internal/shared';
import { ThemeColorSwatchGridComponent } from './theme-color-swatch-grid.component';

function inputValue(event: Event): string {
	const t = event.target;
	return t instanceof HTMLInputElement || t instanceof HTMLSelectElement ? t.value : '';
}

function checkedValue(event: Event): boolean {
	const t = event.target;
	return t instanceof HTMLInputElement ? t.checked : false;
}

@Component({
	selector: 'pptx-table-style-editor-fields',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe, ThemeColorSwatchGridComponent],
	template: `
		@if (descriptor(); as d) {
			<div class="pptx-tse-fields">
				<div class="pptx-tse-fields__group">
					<div class="pptx-tse-fields__hdg">
						{{ 'pptx.tableStyleEditor.fillSection' | translate }}
					</div>
					<div class="pptx-tse-fields__row">
						<input
							type="color"
							class="pptx-tse-fields__color"
							[disabled]="!canEdit()"
							[value]="d.fill.color.hex"
							(change)="edit.emit({ kind: 'fillColor', hex: inputValue($event), ref: undefined })"
						/>
						<label class="pptx-tse-fields__check">
							<input
								type="checkbox"
								[disabled]="!canEdit()"
								[checked]="d.fill.noFill"
								(change)="edit.emit({ kind: 'fillNone', noFill: checkedValue($event) })"
							/>
							{{ 'pptx.tableStyleEditor.noFill' | translate }}
						</label>
					</div>
					<pptx-theme-color-swatch-grid
						[disabled]="!canEdit()"
						[selectedRef]="d.fill.color.ref"
						[selectedHex]="d.fill.color.hex"
						(pick)="edit.emit({ kind: 'fillColor', hex: $event.hex, ref: $event.ref })"
					/>
				</div>

				@if (d.hasTextAndBorders) {
					<div class="pptx-tse-fields__group">
						<div class="pptx-tse-fields__hdg">
							{{ 'pptx.tableStyleEditor.textSection' | translate }}
						</div>
						<div class="pptx-tse-fields__row">
							<button
								type="button"
								[disabled]="!canEdit()"
								[class.pptx-tse-fields__active]="d.text.bold"
								(click)="edit.emit({ kind: 'textBold', value: !d.text.bold })"
							>
								{{ 'pptx.format.bold' | translate }}
							</button>
							<button
								type="button"
								[disabled]="!canEdit()"
								[class.pptx-tse-fields__active]="d.text.italic"
								(click)="edit.emit({ kind: 'textItalic', value: !d.text.italic })"
							>
								{{ 'pptx.format.italic' | translate }}
							</button>
							<button
								type="button"
								[disabled]="!canEdit()"
								[class.pptx-tse-fields__active]="d.text.underline"
								(click)="edit.emit({ kind: 'textUnderline', value: !d.text.underline })"
							>
								{{ 'pptx.format.underline' | translate }}
							</button>
						</div>
						<label class="pptx-tse-fields__row">
							<span>{{ 'pptx.tableStyleEditor.textColor' | translate }}</span>
							<input
								type="color"
								class="pptx-tse-fields__color"
								[disabled]="!canEdit()"
								[value]="d.text.color.hex"
								(change)="edit.emit({ kind: 'textColor', hex: inputValue($event), ref: undefined })"
							/>
						</label>
						<pptx-theme-color-swatch-grid
							[disabled]="!canEdit()"
							[selectedRef]="d.text.color.ref"
							[selectedHex]="d.text.color.hex"
							(pick)="edit.emit({ kind: 'textColor', hex: $event.hex, ref: $event.ref })"
						/>
					</div>

					<div class="pptx-tse-fields__group">
						<div class="pptx-tse-fields__hdg">
							{{ 'pptx.tableStyleEditor.bordersSection' | translate }}
						</div>
						@for (side of sides; track side) {
							<div class="pptx-tse-fields__border-row">
								<span class="pptx-tse-fields__side-lbl">{{
									borderSideLabelKeys[side] | translate
								}}</span>
								<input
									type="color"
									class="pptx-tse-fields__color pptx-tse-fields__color--sm"
									[disabled]="!canEdit()"
									[value]="d.borders[side].color.hex"
									(change)="
										edit.emit({
											kind: 'borderColor',
											side,
											hex: inputValue($event),
											ref: undefined,
										})
									"
								/>
								<input
									type="number"
									min="0"
									max="20"
									class="pptx-tse-fields__num"
									[disabled]="!canEdit()"
									[value]="d.borders[side].width"
									(change)="edit.emit({ kind: 'borderWidth', side, width: inputNumber($event) })"
								/>
								<select
									class="pptx-tse-fields__dash"
									[disabled]="!canEdit()"
									[value]="d.borders[side].dash"
									(change)="edit.emit({ kind: 'borderDash', side, dash: inputValue($event) })"
								>
									@for (dash of dashPresets; track dash) {
										<option [value]="dash" [selected]="dash === d.borders[side].dash">
											{{ dash }}
										</option>
									}
								</select>
								<label class="pptx-tse-fields__check">
									<input
										type="checkbox"
										[disabled]="!canEdit()"
										[checked]="d.borders[side].noFill"
										(change)="edit.emit({ kind: 'borderNone', side, noFill: checkedValue($event) })"
									/>
									{{ 'pptx.tableStyleEditor.noBorder' | translate }}
								</label>
							</div>
						}
					</div>
				}
			</div>
		}
	`,
	styles: `
		.pptx-tse-fields {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
		}
		.pptx-tse-fields__group {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
		}
		.pptx-tse-fields__hdg {
			font-size: 10px;
			text-transform: uppercase;
			letter-spacing: 0.03em;
			color: var(--pptx-inspector-muted, #888);
		}
		.pptx-tse-fields__row {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			font-size: 11px;
		}
		.pptx-tse-fields__check {
			display: flex;
			align-items: center;
			gap: 0.25rem;
			font-size: 11px;
		}
		.pptx-tse-fields__color {
			height: 1.5rem;
			width: 2rem;
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 3px;
			background: transparent;
			cursor: pointer;
		}
		.pptx-tse-fields__color--sm {
			width: 1.75rem;
		}
		.pptx-tse-fields__border-row {
			display: flex;
			align-items: center;
			gap: 0.4rem;
			font-size: 11px;
		}
		.pptx-tse-fields__side-lbl {
			width: 7rem;
			flex-shrink: 0;
			color: var(--pptx-inspector-muted, #888);
		}
		.pptx-tse-fields__num {
			width: 3rem;
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 3px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			color: inherit;
		}
		.pptx-tse-fields__dash {
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 3px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			color: inherit;
		}
		.pptx-tse-fields__active {
			background: var(--pptx-inspector-active, #3a3a3a);
		}
	`,
})
export class TableStyleEditorFieldsComponent {
	readonly descriptor = input.required<TableStyleEditorDescriptor | undefined>();
	readonly canEdit = input<boolean>(true);
	readonly edit = output<TableStyleEditorFieldEdit>();

	protected readonly sides = TABLE_STYLE_BORDER_SIDES;
	protected readonly dashPresets = TABLE_STYLE_DASH_PRESETS;
	protected readonly borderSideLabelKeys = TABLE_STYLE_BORDER_SIDE_LABEL_KEYS;

	protected inputValue(event: Event): string {
		return inputValue(event);
	}

	/** Templates cannot reach the `Number` global, so the coercion lives here. */
	protected inputNumber(event: Event): number {
		return Number(inputValue(event));
	}

	protected checkedValue(event: Event): boolean {
		return checkedValue(event);
	}
}
