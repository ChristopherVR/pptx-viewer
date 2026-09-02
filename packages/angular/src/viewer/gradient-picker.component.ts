/**
 * gradient-picker.component.ts: Standalone Angular component for editing a
 * structured gradient fill on a selected PPTX element.
 *
 * Selector: `pptx-gradient-picker`
 *
 * Ported from / models the patterns in:
 *   packages/react/src/viewer/components/inspector/FillAdvancedControls.tsx
 *   packages/react/src/viewer/components/inspector/FillStrokeProperties.tsx
 *   packages/angular/src/viewer/inspector-panel.component.ts
 *
 * Contract:
 *   [element]     : the selected PptxElement (required)
 *   (patch)       : emits a Partial<PptxElement> for the orchestrator to
 *                   commit via EditorStateService.updateElement
 *
 * @module viewer/gradient-picker
 */

import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement } from 'pptx-viewer-core';
import { ooxmlGradientAngleToCssDegrees } from 'pptx-viewer-core';

import {
	addGradientStopPatch,
	gradientStateOf,
	gradientStatePatch,
	removeGradientStopPatch,
	updateGradientStopPatch,
} from './gradient-picker-helpers';
import type { GradientState, GradientStop } from './gradient-picker-helpers';
import { RecentColorsService } from './recent-colors.service';

@Component({
	selector: 'pptx-gradient-picker',
	standalone: true,
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="pptx-ng-grad">
			<h4 class="pptx-ng-grad__heading">{{ 'pptx.gradient.heading' | translate }}</h4>

			<!-- ── Type ────────────────────────────────────────────────── -->
			<div class="pptx-ng-grad__row">
				<label class="pptx-ng-grad__label" for="grad-type">{{
					'pptx.gradient.type' | translate
				}}</label>
				<select
					id="grad-type"
					class="pptx-ng-grad__select"
					[value]="state().type"
					(change)="onTypeChange($event)"
				>
					<option value="linear">{{ 'pptx.gradient.linear' | translate }}</option>
					<option value="radial">{{ 'pptx.gradient.radial' | translate }}</option>
				</select>
			</div>

			<!-- ── Angle (linear only) ──────────────────────────────────── -->
			@if (state().type === 'linear') {
				<div class="pptx-ng-grad__row">
					<label class="pptx-ng-grad__label" for="grad-angle">{{
						'pptx.gradient.angle' | translate
					}}</label>
					<input
						id="grad-angle"
						class="pptx-ng-grad__input pptx-ng-grad__input--number"
						type="number"
						inputmode="numeric"
						min="0"
						max="359"
						step="1"
						[value]="state().angle"
						(change)="onAngleChange($event)"
					/>
					<input
						class="pptx-ng-grad__range"
						type="range"
						min="0"
						max="359"
						[value]="state().angle"
						(input)="onAngleChange($event)"
					/>
				</div>
			}

			<!-- ── Preview strip ────────────────────────────────────────── -->
			<div class="pptx-ng-grad__preview" [style.background]="previewCss()" aria-hidden="true"></div>

			<!-- ── Stops ────────────────────────────────────────────────── -->
			<div class="pptx-ng-grad__stops-heading">{{ 'pptx.gradient.stops' | translate }}</div>
			@for (stop of state().stops; track $index) {
				<div class="pptx-ng-grad__stop-row">
					<span class="pptx-ng-grad__stop-idx">{{ $index + 1 }}</span>

					<input
						class="pptx-ng-grad__color"
						type="color"
						[value]="stop.color"
						(change)="onStopColorChange($event, $index)"
					/>

					<label class="pptx-ng-grad__label" [for]="'grad-stop-pos-' + $index">{{
						'pptx.gradient.position' | translate
					}}</label>
					<input
						[id]="'grad-stop-pos-' + $index"
						class="pptx-ng-grad__input pptx-ng-grad__input--number"
						type="number"
						inputmode="numeric"
						min="0"
						max="100"
						step="1"
						[value]="stop.position"
						(change)="onStopPositionChange($event, $index)"
					/>

					<label class="pptx-ng-grad__label" [for]="'grad-stop-op-' + $index">α</label>
					<input
						[id]="'grad-stop-op-' + $index"
						class="pptx-ng-grad__input pptx-ng-grad__input--number"
						type="number"
						inputmode="decimal"
						min="0"
						max="1"
						step="0.05"
						[value]="stop.opacity ?? 1"
						(change)="onStopOpacityChange($event, $index)"
					/>

					<button
						type="button"
						class="pptx-ng-grad__btn pptx-ng-grad__btn--remove"
						data-pptx-compact
						[title]="'pptx.gradient.removeStop' | translate"
						(click)="onRemoveStop($index)"
					>
						×
					</button>
				</div>
			}

			<!-- ── Add stop ─────────────────────────────────────────────── -->
			<button type="button" class="pptx-ng-grad__btn pptx-ng-grad__btn--add" (click)="onAddStop()">
				{{ 'pptx.gradient.addStop' | translate }}
			</button>
		</div>
	`,
	styles: `
		.pptx-ng-grad {
			display: flex;
			flex-direction: column;
			gap: 0.35rem;
			padding: 0.5rem;
			font-size: 12px;
			color: var(--pptx-inspector-fg, #e0e0e0);
		}

		.pptx-ng-grad__heading {
			font-size: 10px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--pptx-inspector-muted, #888);
			margin: 0 0 0.25rem 0;
		}

		.pptx-ng-grad__row {
			display: flex;
			align-items: center;
			gap: 0.35rem;
		}

		.pptx-ng-grad__label {
			font-size: 10px;
			color: var(--pptx-inspector-muted, #888);
			min-width: 28px;
			flex-shrink: 0;
		}

		.pptx-ng-grad__select,
		.pptx-ng-grad__input {
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			border: 1px solid var(--pptx-inspector-border, #444);
			color: inherit;
			border-radius: 3px;
			padding: 2px 4px;
			font-size: 12px;
		}

		.pptx-ng-grad__select {
			flex: 1;
		}

		.pptx-ng-grad__input--number {
			width: 52px;
			text-align: right;
		}

		.pptx-ng-grad__range {
			flex: 1;
			accent-color: var(--pptx-inspector-active, #0078d4);
		}

		.pptx-ng-grad__preview {
			height: 20px;
			border-radius: 4px;
			border: 1px solid var(--pptx-inspector-border, #444);
			margin: 0.25rem 0;
		}

		.pptx-ng-grad__stops-heading {
			font-size: 10px;
			text-transform: uppercase;
			letter-spacing: 0.04em;
			color: var(--pptx-inspector-muted, #888);
			margin-top: 0.25rem;
		}

		.pptx-ng-grad__stop-row {
			display: flex;
			align-items: center;
			gap: 0.25rem;
		}

		.pptx-ng-grad__stop-idx {
			font-size: 10px;
			color: var(--pptx-inspector-muted, #888);
			min-width: 14px;
			text-align: center;
			flex-shrink: 0;
		}

		.pptx-ng-grad__color {
			width: 28px;
			height: 22px;
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 3px;
			padding: 1px;
			cursor: pointer;
			background: transparent;
			flex-shrink: 0;
		}

		.pptx-ng-grad__btn {
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			border: 1px solid var(--pptx-inspector-border, #444);
			color: inherit;
			border-radius: 3px;
			cursor: pointer;
			font-size: 11px;
			padding: 2px 6px;
		}

		.pptx-ng-grad__btn--add {
			align-self: flex-start;
			margin-top: 0.25rem;
		}

		.pptx-ng-grad__btn--remove {
			width: 20px;
			height: 20px;
			padding: 0;
			text-align: center;
			color: var(--pptx-inspector-danger, #f47c7c);
			border-color: var(--pptx-inspector-danger-border, #6b2a2a);
			flex-shrink: 0;
		}

		.pptx-ng-grad__btn:hover {
			background: var(--pptx-inspector-hover, #3a3a3a);
		}

		.pptx-ng-grad__btn--remove:hover {
			background: var(--pptx-inspector-danger-hover, #4a1a1a);
		}
	`,
})
export class GradientPickerComponent {
	/** The element whose gradient fill is being edited. */
	readonly element = input.required<PptxElement>();

	/**
	 * Emits a Partial<PptxElement> patch each time the user commits a change.
	 * The orchestrator (InspectorPanelComponent or a wrapper) should call
	 * EditorStateService.updateElement(slideIndex, element().id, patch).
	 */
	readonly patch = output<Partial<PptxElement>>();

	/** Optional: absent in a standalone unit test with no viewer-level DI tree. */
	private readonly recentColors = inject(RecentColorsService, { optional: true });

	/** Derived gradient state from the current element. */
	protected readonly state = computed<GradientState>(() => gradientStateOf(this.element()));

	/** CSS gradient string for the preview strip. */
	protected readonly previewCss = computed<string>(() => {
		const s = this.state();
		const stopsCss = s.stops.map((st) => `${st.color} ${st.position}%`).join(', ');
		if (s.type === 'radial') {
			return `radial-gradient(circle, ${stopsCss})`;
		}
		// `state.angle` is the authored OOXML angle, so the preview strip has to
		// convert it the same way the canvas renderer does or it lies by 90deg.
		return `linear-gradient(${ooxmlGradientAngleToCssDegrees(s.angle)}deg, ${stopsCss})`;
	});

	// ── Type ─────────────────────────────────────────────────────────────────

	protected onTypeChange(event: Event): void {
		const val = stringFromEvent(event);
		if (val !== 'linear' && val !== 'radial') {
			return;
		}
		const cur = this.state();
		this.emit(gradientStatePatch(this.element(), { ...cur, type: val }));
	}

	// ── Angle ─────────────────────────────────────────────────────────────────

	protected onAngleChange(event: Event): void {
		const val = numberFromEvent(event);
		if (val === null) {
			return;
		}
		const cur = this.state();
		const angle = ((Math.round(val) % 360) + 360) % 360;
		this.emit(gradientStatePatch(this.element(), { ...cur, angle }));
	}

	// ── Stop edits ────────────────────────────────────────────────────────────

	protected onStopColorChange(event: Event, index: number): void {
		const val = stringFromEvent(event);
		if (!val) {
			return;
		}
		this.emit(updateGradientStopPatch(this.element(), index, { color: val }));
		this.recentColors?.push(val);
	}

	protected onStopPositionChange(event: Event, index: number): void {
		const val = numberFromEvent(event);
		if (val === null) {
			return;
		}
		const position = Math.max(0, Math.min(100, val));
		this.emit(updateGradientStopPatch(this.element(), index, { position }));
	}

	protected onStopOpacityChange(event: Event, index: number): void {
		const val = numberFromEvent(event);
		if (val === null) {
			return;
		}
		const opacity = Math.max(0, Math.min(1, val)) as GradientStop['opacity'];
		this.emit(updateGradientStopPatch(this.element(), index, { opacity }));
	}

	protected onRemoveStop(index: number): void {
		const p = removeGradientStopPatch(this.element(), index);
		if (p) {
			this.emit(p);
		}
	}

	protected onAddStop(): void {
		this.emit(addGradientStopPatch(this.element(), '#888888', 50));
	}

	// ── Internal ──────────────────────────────────────────────────────────────

	private emit(p: Partial<PptxElement>): void {
		this.patch.emit(p);
	}
}

// ── Module-private helpers ────────────────────────────────────────────────────

function numberFromEvent(event: Event): number | null {
	const target = event.target;
	if (!(target instanceof HTMLInputElement)) {
		return null;
	}
	const parsed = parseFloat(target.value);
	return Number.isFinite(parsed) ? parsed : null;
}

function stringFromEvent(event: Event): string | null {
	const target = event.target;
	if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) {
		return null;
	}
	const val = target.value.trim();
	return val.length > 0 ? val : null;
}
