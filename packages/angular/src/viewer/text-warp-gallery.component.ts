import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { PptxElement, PptxTextWarpPreset, TextStyle } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import { TEXT_WARP_PRESETS, warpPreviewPath } from '../internal/shared';

export function textWarpPatch(
	element: PptxElement,
	value: PptxTextWarpPreset,
): Partial<PptxElement> {
	const current = (element as PptxElement & { textStyle?: TextStyle }).textStyle;
	return {
		textStyle: {
			...current,
			textWarpPreset: value === 'textNoShape' ? undefined : value,
		},
	} as Partial<PptxElement>;
}

@Component({
	selector: 'pptx-text-warp-gallery',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (supported()) {
			<details class="panel">
				<summary>
					Text transform <span>{{ currentLabel() }}</span>
				</summary>
				<div class="gallery">
					@for (preset of presets; track preset.value) {
						<button
							type="button"
							[class.active]="preset.value === current()"
							[title]="preset.label"
							[attr.aria-label]="preset.label"
							(click)="select(preset.value)"
						>
							<svg viewBox="0 0 40 20" aria-hidden="true">
								<path [attr.d]="preview(preset.value)" />
							</svg>
						</button>
					}
				</div>
			</details>
		}
	`,
	styles: `
		.panel {
			padding: 8px 0;
			border-bottom: 1px solid var(--pptx-inspector-border, #333);
			font-size: 11px;
		}
		summary {
			display: flex;
			justify-content: space-between;
			gap: 8px;
			cursor: pointer;
			color: var(--pptx-inspector-muted, #aaa);
		}
		summary span {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			text-transform: none;
		}
		.gallery {
			display: grid;
			grid-template-columns: repeat(5, minmax(0, 1fr));
			gap: 4px;
			margin-top: 8px;
		}
		button {
			height: 30px;
			padding: 3px;
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 3px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			color: inherit;
			cursor: pointer;
		}
		button.active {
			border-color: var(--pptx-primary, #2563eb);
			background: color-mix(in srgb, var(--pptx-primary, #2563eb) 30%, transparent);
		}
		svg {
			width: 100%;
			height: 20px;
		}
		path {
			fill: none;
			stroke: currentColor;
			stroke-width: 1.5;
		}
	`,
})
export class TextWarpGalleryComponent {
	readonly element = input.required<PptxElement>();
	readonly patch = output<Partial<PptxElement>>();
	protected readonly presets = TEXT_WARP_PRESETS;
	protected readonly supported = computed(() => hasTextProperties(this.element()));
	protected readonly current = computed<PptxTextWarpPreset>(() =>
		hasTextProperties(this.element())
			? (this.element() as PptxElement & { textStyle?: TextStyle }).textStyle?.textWarpPreset ||
				'textNoShape'
			: 'textNoShape',
	);
	protected readonly currentLabel = computed(
		() => this.presets.find((preset) => preset.value === this.current())?.label ?? this.current(),
	);

	protected preview(value: PptxTextWarpPreset): string {
		return warpPreviewPath(value);
	}
	protected select(value: PptxTextWarpPreset): void {
		this.patch.emit(textWarpPatch(this.element(), value));
	}
}
