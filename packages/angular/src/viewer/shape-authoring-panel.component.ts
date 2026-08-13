import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';

import {
	clampShapeAdjustmentValue,
	DEFAULT_ROUND_RECT_ADJUSTMENT,
	SHAPE_ADJUSTMENT_MAX,
	SHAPE_ADJUSTMENT_MIN,
	SHAPE_PRESET_DEFS,
	SHAPE_QUICK_STYLES,
} from '../internal/shared';

export function shapeTypePatch(element: PptxElement, shapeType: string): Partial<PptxElement> {
	if (!hasShapeProperties(element)) {
		return {};
	}
	const existing = { ...element.shapeAdjustments };
	const adjustment =
		shapeType === 'roundRect'
			? { ...existing, adj: existing.adj ?? DEFAULT_ROUND_RECT_ADJUSTMENT }
			: shapeType === 'cylinder' || shapeType === 'can'
				? { ...existing, adj: existing.adj ?? 25000 }
				: undefined;
	const line = shapeType === 'line';
	return {
		shapeType,
		shapeAdjustments: adjustment,
		shapeStyle: {
			...element.shapeStyle,
			fillColor: line ? 'transparent' : element.shapeStyle?.fillColor || '#4472c4',
			fillMode: line ? 'none' : element.shapeStyle?.fillMode || 'solid',
			strokeWidth: line
				? Math.max(2, element.shapeStyle?.strokeWidth || 0)
				: element.shapeStyle?.strokeWidth || 1,
		},
	} as Partial<PptxElement>;
}

@Component({
	selector: 'pptx-shape-authoring-panel',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (supported()) {
			<section class="panel" aria-label="Shape authoring">
				<label class="field">
					<span>Shape type</span>
					<select aria-label="Shape type" [value]="shapeType()" (change)="onShapeType($event)">
						@for (preset of presets; track preset.type) {
							<option [value]="preset.type">{{ preset.label }}</option>
						}
						<!--
							Accepted deviation: this prints the raw a:prstGeom token. The deck
							may carry any of the 188 presets while the gallery offers a subset,
							and showing the token is what keeps the current geometry
							representable, so the picker cannot silently rewrite it. There is
							no catalogue of preset-geometry names to spell it from.
						-->
						@if (unknownType()) {
							<option [value]="shapeType()">{{ shapeType() }}</option>
						}
					</select>
				</label>
				@if (showAdjustment()) {
					<label class="field">
						<span>Roundness</span>
						<input
							type="range"
							[min]="adjustmentMin"
							[max]="adjustmentMax"
							step="500"
							[value]="adjustment()"
							(input)="onAdjustment($event)"
						/>
					</label>
				}
				<div class="field">
					<span>Quick styles</span>
					<div class="gallery">
						@for (style of quickStyles; track style.name) {
							<button
								type="button"
								[title]="style.name"
								[attr.aria-label]="style.name"
								[style.background]="style.style.fillColor ?? 'transparent'"
								[style.border-color]="style.style.strokeColor ?? null"
								[style.box-shadow]="shadow(style.style)"
								(click)="applyStyle(style.style)"
							></button>
						}
					</div>
				</div>
			</section>
		}
	`,
	styles: `
		.panel {
			display: grid;
			gap: 8px;
			padding: 8px 0;
			border-bottom: 1px solid var(--pptx-inspector-border, #333);
			font-size: 11px;
		}
		.field {
			display: grid;
			gap: 4px;
			color: var(--pptx-inspector-muted, #aaa);
		}
		select {
			width: 100%;
			padding: 4px;
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 3px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			color: inherit;
		}
		input {
			width: 100%;
			accent-color: var(--pptx-primary, #2563eb);
		}
		.gallery {
			display: grid;
			grid-template-columns: repeat(6, minmax(0, 1fr));
			gap: 4px;
		}
		.gallery button {
			height: 28px;
			border: 1px solid var(--pptx-inspector-border, #555);
			border-radius: 3px;
			cursor: pointer;
		}
	`,
})
export class ShapeAuthoringPanelComponent {
	readonly element = input.required<PptxElement>();
	readonly patch = output<Partial<PptxElement>>();
	protected readonly presets = SHAPE_PRESET_DEFS.filter((preset) => preset.type !== 'connector');
	protected readonly quickStyles = SHAPE_QUICK_STYLES;
	protected readonly adjustmentMin = SHAPE_ADJUSTMENT_MIN;
	protected readonly adjustmentMax = SHAPE_ADJUSTMENT_MAX;
	protected readonly supported = computed(() => ['shape', 'text'].includes(this.element().type));
	protected readonly shapeType = computed(() =>
		hasShapeProperties(this.element())
			? (this.element() as PptxElement & { shapeType?: string }).shapeType || 'rect'
			: 'rect',
	);
	protected readonly unknownType = computed(
		() => !this.presets.some((preset) => preset.type === this.shapeType()),
	);
	protected readonly showAdjustment = computed(() =>
		['roundRect', 'cylinder', 'can'].includes(this.shapeType()),
	);
	protected readonly adjustment = computed(() =>
		hasShapeProperties(this.element())
			? ((this.element() as PptxElement & { shapeAdjustments?: Record<string, number> })
					.shapeAdjustments?.adj ?? DEFAULT_ROUND_RECT_ADJUSTMENT)
			: DEFAULT_ROUND_RECT_ADJUSTMENT,
	);

	protected onShapeType(event: Event): void {
		this.patch.emit(shapeTypePatch(this.element(), (event.target as HTMLSelectElement).value));
	}
	protected onAdjustment(event: Event): void {
		const value = clampShapeAdjustmentValue(Number((event.target as HTMLInputElement).value));
		this.patch.emit({
			shapeAdjustments: {
				...(hasShapeProperties(this.element())
					? (this.element() as PptxElement & { shapeAdjustments?: Record<string, number> })
							.shapeAdjustments
					: {}),
				adj: value,
			},
		} as Partial<PptxElement>);
	}
	protected applyStyle(style: Partial<ShapeStyle>): void {
		const current = hasShapeProperties(this.element())
			? (this.element() as PptxElement & { shapeStyle?: ShapeStyle }).shapeStyle
			: undefined;
		this.patch.emit({ shapeStyle: { ...current, ...style } } as Partial<PptxElement>);
	}
	protected shadow(style: Partial<ShapeStyle>): string | null {
		return style.shadowColor
			? `${style.shadowOffsetX ?? 2}px ${style.shadowOffsetY ?? 2}px ${style.shadowBlur ?? 4}px ${style.shadowColor}`
			: null;
	}
}
