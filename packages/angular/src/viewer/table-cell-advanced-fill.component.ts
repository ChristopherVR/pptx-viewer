/**
 * table-cell-advanced-fill.component.ts: advanced (gradient / pattern) cell fill
 * plus cell margin controls for the table cell-formatting inspector.
 *
 * Selector: `pptx-table-cell-advanced-fill`
 *
 * Angular port of the React `TableCellAdvancedFill`. Emits partial
 * `PptxTableCellStyle` patches through `styleChange`; the parent merges them
 * into the selected cell. Option lists come from `pptx-viewer-shared`
 * (`FILL_MODE_OPTIONS` / `GRADIENT_TYPE_OPTIONS` / `PATTERN_OPTIONS`); a live
 * `gradientFillCss` string is rebuilt on every gradient edit so the renderer
 * reflects the change immediately.
 */
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxTableCellStyle } from 'pptx-viewer-core';

import { FILL_MODE_OPTIONS, GRADIENT_TYPE_OPTIONS, PATTERN_OPTIONS } from '../internal/shared';
import { buildGradientFillCss } from './table-properties-helpers';

type GradientStop = { color: string; position: number };

@Component({
	selector: 'pptx-table-cell-advanced-fill',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<div class="pptx-tcaf">
			<label class="pptx-tcaf__field">
				<span class="pptx-tcaf__lbl">{{ 'pptx.table.fillMode' | translate }}</span>
				<select
					class="pptx-tcaf__sel"
					[disabled]="!canEdit()"
					[value]="fillMode()"
					(change)="onFillModeChange($event)"
				>
					@for (opt of fillModes; track opt.value) {
						<option [value]="opt.value">{{ opt.i18nKey | translate }}</option>
					}
				</select>
			</label>

			@if (fillMode() === 'gradient') {
				<div class="pptx-tcaf__group">
					<label class="pptx-tcaf__field">
						<span class="pptx-tcaf__lbl">{{ 'pptx.table.gradientType' | translate }}</span>
						<select
							class="pptx-tcaf__sel"
							[disabled]="!canEdit()"
							[value]="gradType()"
							(change)="onGradTypeChange($event)"
						>
							@for (opt of gradientTypes; track opt.value) {
								<option [value]="opt.value">{{ opt.i18nKey | translate }}</option>
							}
						</select>
					</label>
					@if (gradType() === 'linear') {
						<label class="pptx-tcaf__field">
							<span class="pptx-tcaf__lbl">{{ 'pptx.table.gradientAngle' | translate }}</span>
							<input
								type="number"
								class="pptx-tcaf__num"
								min="0"
								max="360"
								[disabled]="!canEdit()"
								[value]="cellStyle().gradientFillAngle ?? 90"
								(change)="onAngleChange($event)"
							/>
						</label>
					}
					<span class="pptx-tcaf__lbl">{{ 'pptx.table.gradientStops' | translate }}</span>
					@for (stop of stops(); track $index; let i = $index) {
						<div class="pptx-tcaf__stop">
							<input
								type="color"
								class="pptx-tcaf__color"
								[disabled]="!canEdit()"
								[value]="stop.color"
								(input)="onStopColor(i, $event)"
							/>
							<input
								type="number"
								class="pptx-tcaf__num"
								min="0"
								max="100"
								[disabled]="!canEdit()"
								[value]="stop.position"
								(change)="onStopPos(i, $event)"
							/>
							<span class="pptx-tcaf__lbl">%</span>
						</div>
					}
					<button
						type="button"
						class="pptx-tcaf__add"
						[disabled]="!canEdit()"
						(click)="onAddStop()"
					>
						{{ 'pptx.table.gradientAddStop' | translate }}
					</button>
				</div>
			}

			@if (fillMode() === 'pattern') {
				<div class="pptx-tcaf__group">
					<label class="pptx-tcaf__field">
						<span class="pptx-tcaf__lbl">{{ 'pptx.table.patternPreset' | translate }}</span>
						<select
							class="pptx-tcaf__sel"
							[disabled]="!canEdit()"
							[value]="cellStyle().patternFillPreset ?? 'ltDnDiag'"
							(change)="onPatternPreset($event)"
						>
							@for (p of patterns; track p) {
								<option [value]="p">{{ p }}</option>
							}
						</select>
					</label>
					<div class="pptx-tcaf__grid2">
						<label class="pptx-tcaf__field">
							<span class="pptx-tcaf__lbl">{{ 'pptx.table.patternForeground' | translate }}</span>
							<input
								type="color"
								class="pptx-tcaf__color"
								[disabled]="!canEdit()"
								[value]="cellStyle().patternFillForeground ?? '#000000'"
								(input)="onPatternFg($event)"
							/>
						</label>
						<label class="pptx-tcaf__field">
							<span class="pptx-tcaf__lbl">{{ 'pptx.table.patternBackground' | translate }}</span>
							<input
								type="color"
								class="pptx-tcaf__color"
								[disabled]="!canEdit()"
								[value]="cellStyle().patternFillBackground ?? '#FFFFFF'"
								(input)="onPatternBg($event)"
							/>
						</label>
					</div>
				</div>
			}

			<div class="pptx-tcaf__grid2">
				@for (m of margins; track m.key) {
					<label class="pptx-tcaf__field">
						<span class="pptx-tcaf__lbl">{{ m.label | translate }}</span>
						<input
							type="number"
							class="pptx-tcaf__num"
							min="0"
							max="200"
							[disabled]="!canEdit()"
							[value]="marginValue(m.key)"
							(change)="onMargin(m.key, $event)"
						/>
					</label>
				}
			</div>
		</div>
	`,
	styles: `
		.pptx-tcaf {
			display: flex;
			flex-direction: column;
			gap: 0.3rem;
		}
		.pptx-tcaf__group {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
		}
		.pptx-tcaf__field {
			display: flex;
			align-items: center;
			gap: 0.35rem;
		}
		.pptx-tcaf__grid2 {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 0.3rem;
		}
		.pptx-tcaf__lbl {
			font-size: 10px;
			color: var(--pptx-inspector-muted, #888);
		}
		.pptx-tcaf__sel,
		.pptx-tcaf__num {
			flex: 1;
			min-width: 0;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			border: 1px solid var(--pptx-inspector-border, #444);
			color: inherit;
			border-radius: 3px;
			padding: 2px 4px;
			font-size: 11px;
		}
		.pptx-tcaf__stop {
			display: flex;
			align-items: center;
			gap: 0.3rem;
		}
		.pptx-tcaf__color {
			width: 28px;
			height: 22px;
			padding: 0;
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 3px;
			background: transparent;
			cursor: pointer;
		}
		.pptx-tcaf__add {
			align-self: flex-start;
			font-size: 10px;
			background: none;
			border: none;
			color: var(--pptx-inspector-accent, #4aa3ff);
			cursor: pointer;
			padding: 0;
		}
	`,
})
export class TableCellAdvancedFillComponent {
	/** The selected cell's style. */
	readonly cellStyle = input.required<PptxTableCellStyle>();
	/** Whether editing is enabled. */
	readonly canEdit = input<boolean>(true);
	/** Emits a partial style patch to merge into the cell. */
	readonly styleChange = output<Partial<PptxTableCellStyle>>();

	protected readonly fillModes = FILL_MODE_OPTIONS.map((o) => ({
		value: o.value ?? 'solid',
		i18nKey: o.i18nKey,
	}));
	protected readonly gradientTypes = GRADIENT_TYPE_OPTIONS.map((o) => ({
		value: o.value,
		i18nKey: o.i18nKey,
	}));
	protected readonly patterns = PATTERN_OPTIONS;
	protected readonly margins: ReadonlyArray<{
		key: 'marginTop' | 'marginBottom' | 'marginLeft' | 'marginRight';
		label: string;
	}> = [
		{ key: 'marginTop', label: 'pptx.table.marginTop' },
		{ key: 'marginBottom', label: 'pptx.table.marginBottom' },
		{ key: 'marginLeft', label: 'pptx.table.marginLeft' },
		{ key: 'marginRight', label: 'pptx.table.marginRight' },
	];

	protected readonly fillMode = computed(() => this.cellStyle().fillMode ?? 'solid');
	protected readonly gradType = computed(() => this.cellStyle().gradientFillType ?? 'linear');
	protected readonly stops = computed<GradientStop[]>(
		() => this.cellStyle().gradientFillStops ?? [],
	);

	protected marginValue(key: 'marginTop' | 'marginBottom' | 'marginLeft' | 'marginRight'): number {
		return this.cellStyle()[key] ?? 0;
	}

	protected onFillModeChange(event: Event): void {
		const mode = selectValue(event) as PptxTableCellStyle['fillMode'];
		if (mode === 'gradient') {
			const stops = this.stops().length
				? this.stops()
				: [
						{ color: '#FF0000', position: 0 },
						{ color: '#0000FF', position: 100 },
					];
			const type = this.gradType();
			const angle = this.cellStyle().gradientFillAngle ?? 90;
			this.styleChange.emit({
				fillMode: 'gradient',
				gradientFillType: type,
				gradientFillAngle: angle,
				gradientFillStops: stops,
				gradientFillCss: buildGradientFillCss(stops, type, angle),
			});
		} else if (mode === 'pattern') {
			this.styleChange.emit({
				fillMode: 'pattern',
				patternFillPreset: this.cellStyle().patternFillPreset ?? 'ltDnDiag',
				patternFillForeground: this.cellStyle().patternFillForeground ?? '#000000',
				patternFillBackground: this.cellStyle().patternFillBackground ?? '#FFFFFF',
				gradientFillCss: undefined,
			});
		} else {
			this.styleChange.emit({ fillMode: mode, gradientFillCss: undefined });
		}
	}

	protected onGradTypeChange(event: Event): void {
		const type = selectValue(event) as 'linear' | 'radial';
		this.emitGradient(this.stops(), type, this.cellStyle().gradientFillAngle ?? 90);
	}

	protected onAngleChange(event: Event): void {
		const angle = numberValue(event) ?? 90;
		this.emitGradient(this.stops(), this.gradType(), angle);
	}

	protected onStopColor(index: number, event: Event): void {
		const color = inputValue(event);
		this.updateStop(index, { color });
	}

	protected onStopPos(index: number, event: Event): void {
		const position = numberValue(event) ?? 0;
		this.updateStop(index, { position });
	}

	protected onAddStop(): void {
		const next = [...this.stops(), { color: '#888888', position: 50 }];
		this.emitGradient(next, this.gradType(), this.cellStyle().gradientFillAngle ?? 90);
	}

	protected onPatternPreset(event: Event): void {
		this.styleChange.emit({ patternFillPreset: selectValue(event) });
	}

	protected onPatternFg(event: Event): void {
		this.styleChange.emit({ patternFillForeground: inputValue(event) });
	}

	protected onPatternBg(event: Event): void {
		this.styleChange.emit({ patternFillBackground: inputValue(event) });
	}

	protected onMargin(
		key: 'marginTop' | 'marginBottom' | 'marginLeft' | 'marginRight',
		event: Event,
	): void {
		const value = numberValue(event);
		if (value !== null) {
			this.styleChange.emit({ [key]: value });
		}
	}

	private updateStop(index: number, patch: Partial<GradientStop>): void {
		const next = this.stops().map((s, i) => (i === index ? { ...s, ...patch } : s));
		this.emitGradient(next, this.gradType(), this.cellStyle().gradientFillAngle ?? 90);
	}

	private emitGradient(stops: GradientStop[], type: 'linear' | 'radial', angle: number): void {
		this.styleChange.emit({
			gradientFillStops: stops,
			gradientFillType: type,
			gradientFillAngle: angle,
			gradientFillCss: buildGradientFillCss(stops, type, angle),
		});
	}
}

// ── Module-private helpers ───────────────────────────────────────────────────

function selectValue(event: Event): string {
	const t = event.target;
	return t instanceof HTMLSelectElement ? t.value : '';
}

function inputValue(event: Event): string {
	const t = event.target;
	return t instanceof HTMLInputElement ? t.value : '';
}

function numberValue(event: Event): number | null {
	const t = event.target;
	if (!(t instanceof HTMLInputElement)) {
		return null;
	}
	const n = Number(t.value);
	return Number.isFinite(n) ? n : null;
}
