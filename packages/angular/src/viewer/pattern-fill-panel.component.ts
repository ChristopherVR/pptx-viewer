/**
 * pattern-fill-panel.component.ts: Standalone Angular component for editing a
 * shape's pattern fill (`a:pattFill`): preset picker plus foreground /
 * background colours.
 *
 * Selector: `pptx-pattern-fill-panel`
 *
 * Ported from / models the patterns in:
 *   packages/vue/src/viewer/components/inspector/FillPatternControls.vue
 *   packages/angular/src/viewer/gradient-picker.component.ts
 *
 * The 56-preset catalogue and each swatch's SVG preview are shared's
 * `PATTERN_PRESET_OPTIONS` / `getPatternSvg`, matching Vue's swatch grid and
 * its `data-testid="fx-pattern-swatch"` per swatch. Selecting a swatch (or
 * editing a colour) sets `shapeStyle.fillMode = 'pattern'` along with the
 * changed field, mirroring how the gradient picker implicitly switches
 * `fillMode` to `'gradient'`.
 *
 * Contract:
 *   [element]     : the selected PptxElement (required)
 *   (patch)       : emits a Partial<PptxElement> for the orchestrator to
 *                   commit via EditorStateService.updateElement
 *
 * @module viewer/pattern-fill-panel
 */
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';

import { getPatternSvg, PATTERN_PRESET_OPTIONS } from '../internal/shared';

@Component({
	selector: 'pptx-pattern-fill-panel',
	standalone: true,
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="pptx-ng-pf">
			@if (!applicable()) {
				<p class="pptx-ng-pf__muted">{{ 'pptx.fill.noOptions' | translate }}</p>
			} @else {
				<span class="pptx-ng-pf__label">{{ 'pptx.table.patternPreset' | translate }}</span>
				<div class="pptx-ng-pf__grid">
					@for (opt of presetOptions; track opt.value) {
						<button
							type="button"
							data-testid="fx-pattern-swatch"
							class="pptx-ng-pf__swatch"
							[class.is-active]="preset() === opt.value"
							[title]="opt.labelKey | translate"
							[attr.aria-pressed]="preset() === opt.value"
							(click)="onPreset(opt.value)"
						>
							@if (swatchUrl(opt.value); as url) {
								<span class="pptx-ng-pf__swatch-fill" [style.background-image]="url"></span>
							}
						</button>
					}
				</div>

				<label class="pptx-ng-pf__field" for="pf-fg">
					<span class="pptx-ng-pf__label">{{
						'pptx.fillAdvanced.foregroundColor' | translate
					}}</span>
					<input
						id="pf-fg"
						type="color"
						class="pptx-ng-pf__color"
						[value]="foreground()"
						(change)="onForeground($event)"
					/>
				</label>
				<label class="pptx-ng-pf__field" for="pf-bg">
					<span class="pptx-ng-pf__label">{{
						'pptx.fillAdvanced.backgroundColor' | translate
					}}</span>
					<input
						id="pf-bg"
						type="color"
						class="pptx-ng-pf__color"
						[value]="background()"
						(change)="onBackground($event)"
					/>
				</label>
			}
		</div>
	`,
	styles: `
		.pptx-ng-pf {
			display: flex;
			flex-direction: column;
			gap: 0.4rem;
			padding: 0.5rem;
			font-size: 12px;
			color: var(--pptx-inspector-fg, #e0e0e0);
		}
		.pptx-ng-pf__muted {
			color: var(--pptx-inspector-muted, #888);
			font-style: italic;
			margin: 0;
		}
		.pptx-ng-pf__label {
			font-size: 10px;
			color: var(--pptx-inspector-muted, #888);
		}
		.pptx-ng-pf__grid {
			display: grid;
			grid-template-columns: repeat(8, 1fr);
			gap: 3px;
			max-height: 180px;
			overflow-y: auto;
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 3px;
			padding: 4px;
		}
		.pptx-ng-pf__swatch {
			width: 20px;
			height: 20px;
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 2px;
			background: #fff;
			padding: 0;
			cursor: pointer;
		}
		.pptx-ng-pf__swatch.is-active {
			border: 2px solid var(--pptx-inspector-accent, #2f6feb);
		}
		.pptx-ng-pf__swatch-fill {
			display: block;
			width: 100%;
			height: 100%;
			background-repeat: repeat;
			background-size: 8px 8px;
		}
		.pptx-ng-pf__field {
			display: flex;
			flex-direction: column;
			gap: 0.2rem;
		}
		.pptx-ng-pf__color {
			width: 100%;
			height: 24px;
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 3px;
			padding: 1px;
			cursor: pointer;
			background: transparent;
		}
	`,
})
export class PatternFillPanelComponent {
	readonly element = input.required<PptxElement>();
	readonly patch = output<Partial<PptxElement>>();

	protected readonly presetOptions = PATTERN_PRESET_OPTIONS;

	protected readonly applicable = computed(() => hasShapeProperties(this.element()));
	protected readonly style = computed<ShapeStyle>(() => {
		const el = this.element();
		return hasShapeProperties(el) ? (el.shapeStyle ?? {}) : {};
	});
	protected readonly foreground = computed(() => this.style().fillColor ?? '#000000');
	protected readonly background = computed(
		() => this.style().fillPatternBackgroundColor ?? '#ffffff',
	);
	protected readonly preset = computed(() => this.style().fillPatternPreset ?? 'pct20');

	protected swatchUrl(value: string): string | null {
		const svg = getPatternSvg(value, this.foreground(), this.background());
		return svg ? `url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}')` : null;
	}

	protected onPreset(value: string): void {
		this.patchStyle({ fillPatternPreset: value });
	}

	protected onForeground(event: Event): void {
		const value = colorValue(event);
		if (value === null) {
			return;
		}
		this.patchStyle({ fillColor: value });
	}

	protected onBackground(event: Event): void {
		const value = colorValue(event);
		if (value === null) {
			return;
		}
		this.patchStyle({ fillPatternBackgroundColor: value });
	}

	private patchStyle(changes: Partial<ShapeStyle>): void {
		this.patch.emit({
			shapeStyle: { ...this.style(), fillMode: 'pattern', ...changes },
		} as Partial<PptxElement>);
	}
}

function colorValue(event: Event): string | null {
	const target = event.target;
	return target instanceof HTMLInputElement ? target.value : null;
}
