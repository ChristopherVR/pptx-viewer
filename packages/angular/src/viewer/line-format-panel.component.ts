/**
 * line-format-panel.component.ts: Standalone Angular component for editing a
 * shape's line-format properties (dash pattern, compound line, join, cap) not
 * already covered by the inspector's compact stroke color control.
 *
 * Selector: `pptx-line-format-panel`
 *
 * Ported from / models the patterns in:
 *   packages/vue/src/viewer/components/inspector/StrokePanel.vue
 *   packages/react/src/viewer/components/inspector/StrokeEffectsSection.tsx
 *   packages/angular/src/viewer/effects-panel.component.ts
 *
 * Every option catalogue is shared's `stroke-dash-options.ts` /
 * `stroke-line-style-options.ts`; this component only maps the selected
 * value onto a `shapeStyle` patch through the normal `(patch)` output.
 *
 * Contract:
 *   [element]     : the selected PptxElement (required)
 *   (patch)       : emits a Partial<PptxElement> for the orchestrator to
 *                   commit via EditorStateService.updateElement
 *
 * @module viewer/line-format-panel
 */
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';

import {
	COMPOUND_LINE_OPTIONS,
	LINE_CAP_OPTIONS,
	LINE_JOIN_OPTIONS,
	STROKE_DASH_OPTIONS,
} from '../internal/shared';

@Component({
	selector: 'pptx-line-format-panel',
	standalone: true,
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="pptx-ng-lf">
			@if (!applicable()) {
				<p class="pptx-ng-lf__muted">{{ 'pptx.stroke.noBorderProperties' | translate }}</p>
			} @else {
				<label class="pptx-ng-lf__field">
					<span class="pptx-ng-lf__label">{{ 'pptx.strokeEffects.strokeDash' | translate }}</span>
					<select
						id="lf-dash"
						[attr.aria-label]="'pptx.strokeEffects.strokeDash' | translate"
						class="pptx-ng-lf__select"
						[value]="style().strokeDash ?? 'solid'"
						(change)="onDash($event)"
					>
						@for (opt of dashOptions; track opt.value) {
							<option [value]="opt.value">{{ opt.i18nKey | translate }}</option>
						}
					</select>
				</label>

				<label class="pptx-ng-lf__field">
					<span class="pptx-ng-lf__label">{{ 'pptx.strokeEffects.compoundLine' | translate }}</span>
					<select
						id="lf-compound"
						[attr.aria-label]="'pptx.strokeEffects.compoundLine' | translate"
						class="pptx-ng-lf__select"
						[value]="style().compoundLine ?? 'sng'"
						(change)="onCompound($event)"
					>
						@for (opt of compoundOptions; track opt.value) {
							<option [value]="opt.value">{{ opt.i18nKey | translate }}</option>
						}
					</select>
				</label>

				<label class="pptx-ng-lf__field">
					<span class="pptx-ng-lf__label">{{ 'pptx.strokeEffects.lineJoin' | translate }}</span>
					<select
						id="lf-join"
						[attr.aria-label]="'pptx.strokeEffects.lineJoin' | translate"
						class="pptx-ng-lf__select"
						[value]="style().lineJoin ?? 'round'"
						(change)="onJoin($event)"
					>
						@for (opt of joinOptions; track opt.value) {
							<option [value]="opt.value">{{ opt.i18nKey | translate }}</option>
						}
					</select>
				</label>

				<label class="pptx-ng-lf__field">
					<span class="pptx-ng-lf__label">{{ 'pptx.strokeEffects.lineCap' | translate }}</span>
					<select
						id="lf-cap"
						[attr.aria-label]="'pptx.strokeEffects.lineCap' | translate"
						class="pptx-ng-lf__select"
						[value]="style().lineCap ?? 'flat'"
						(change)="onCap($event)"
					>
						@for (opt of capOptions; track opt.value) {
							<option [value]="opt.value">{{ opt.i18nKey | translate }}</option>
						}
					</select>
				</label>
			}
		</div>
	`,
	styles: `
		.pptx-ng-lf {
			display: flex;
			flex-direction: column;
			gap: 0.4rem;
			padding: 0.5rem;
			font-size: 12px;
			color: var(--pptx-inspector-fg, #e0e0e0);
		}
		.pptx-ng-lf__muted {
			color: var(--pptx-inspector-muted, #888);
			font-style: italic;
			margin: 0;
		}
		.pptx-ng-lf__field {
			display: flex;
			flex-direction: column;
			gap: 0.2rem;
		}
		.pptx-ng-lf__label {
			font-size: 10px;
			color: var(--pptx-inspector-muted, #888);
		}
		.pptx-ng-lf__select {
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			border: 1px solid var(--pptx-inspector-border, #444);
			color: inherit;
			border-radius: 3px;
			padding: 3px 4px;
			font-size: 12px;
		}
	`,
})
export class LineFormatPanelComponent {
	readonly element = input.required<PptxElement>();
	readonly patch = output<Partial<PptxElement>>();

	protected readonly dashOptions = STROKE_DASH_OPTIONS;
	protected readonly compoundOptions = COMPOUND_LINE_OPTIONS;
	protected readonly joinOptions = LINE_JOIN_OPTIONS;
	protected readonly capOptions = LINE_CAP_OPTIONS;

	protected readonly applicable = computed(() => hasShapeProperties(this.element()));
	protected readonly style = computed<ShapeStyle>(() => {
		const el = this.element();
		return hasShapeProperties(el) ? (el.shapeStyle ?? {}) : {};
	});

	protected onDash(event: Event): void {
		const value = selectValue(event);
		if (value === null) {
			return;
		}
		this.patchStyle({ strokeDash: value as ShapeStyle['strokeDash'] });
	}

	protected onCompound(event: Event): void {
		const value = selectValue(event);
		if (value === null) {
			return;
		}
		this.patchStyle({ compoundLine: value as NonNullable<ShapeStyle['compoundLine']> });
	}

	protected onJoin(event: Event): void {
		const value = selectValue(event);
		if (value === null) {
			return;
		}
		this.patchStyle({ lineJoin: value as NonNullable<ShapeStyle['lineJoin']> });
	}

	protected onCap(event: Event): void {
		const value = selectValue(event);
		if (value === null) {
			return;
		}
		this.patchStyle({ lineCap: value as NonNullable<ShapeStyle['lineCap']> });
	}

	private patchStyle(changes: Partial<ShapeStyle>): void {
		this.patch.emit({ shapeStyle: { ...this.style(), ...changes } } as Partial<PptxElement>);
	}
}

function selectValue(event: Event): string | null {
	const target = event.target;
	return target instanceof HTMLSelectElement ? target.value : null;
}
