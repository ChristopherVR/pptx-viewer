/**
 * text-3d-panel.component.ts: the 3D TEXT inspector panel, mirroring React's
 * `inspector/properties/Text3DProperties.tsx` (PowerPoint's Format Text Effects
 * > 3-D Format).
 *
 * Selector: `pptx-text-3d-panel`
 *
 * Contract:
 *   [element] : the selected PptxElement (required)
 *   (patch)   : emits a Partial<PptxElement> for the orchestrator to commit via
 *               EditorStateService.updateElement, exactly like the sibling
 *               advanced panels.
 *
 * WHY everything hides behind the extrusion toggle: a bevel or a material with
 * no depth renders nothing at all in PowerPoint, so offering those controls
 * first would let an author "style" text and see no change. Switching the
 * toggle off clears the whole `text3d` sub-object rather than zeroing the
 * depth, so an unused `a:sp3d` never survives into the saved package.
 *
 * All unit maths (EMU <-> pt, clamps, the seeded default depth) comes from the
 * shared `text-3d-fields` module so every binding writes byte-identical values.
 *
 * @module viewer/text-3d-panel
 */
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { MaterialPresetType, PptxElement, Text3DStyle } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import {
	MATERIAL_PRESETS,
	TEXT_3D_MAX_EXTRUSION_PT,
	clampText3dPt,
	hasText3dExtrusion,
	mergeText3d,
	normalizeHexColor,
	text3dEmuToPt,
	text3dPtToEmu,
	text3dStylePatch,
	toggleText3dExtrusion,
} from '../internal/shared';
import {
	TEXT_3D_BOTTOM_BEVEL_KEYS,
	TEXT_3D_TOP_BEVEL_KEYS,
	Text3DBevelSectionComponent,
} from './text-3d-bevel-section.component';

/** Fallback swatch for the extrusion colour when the deck declares none. */
const DEFAULT_EXTRUSION_COLOR = '#888888';

@Component({
	selector: 'pptx-text-3d-panel',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe, Text3DBevelSectionComponent],
	template: `
		<div class="t3d">
			<label class="t3d__check">
				<input
					type="checkbox"
					[checked]="hasExtrusion()"
					[attr.aria-label]="'pptx.text3d.extrusion' | translate"
					(change)="onExtrusionToggle($event)"
				/>
				<span>{{ 'pptx.text3d.extrusion' | translate }}</span>
			</label>

			@if (hasExtrusion()) {
				<div class="t3d__grid2">
					<label class="t3d__field">
						<span class="t3d__label">{{ 'pptx.text3d.extrusionDepth' | translate }}</span>
						<input
							type="number"
							class="t3d__input"
							min="0"
							[max]="maxDepthPt"
							step="1"
							[value]="depthPt()"
							[attr.aria-label]="'pptx.text3d.extrusionDepth' | translate"
							(change)="onDepthChange($event)"
						/>
					</label>
					<label class="t3d__field">
						<span class="t3d__label">{{ 'pptx.text3d.extrusionColor' | translate }}</span>
						<input
							type="color"
							class="t3d__color"
							[value]="extrusionColor()"
							[attr.aria-label]="'pptx.text3d.extrusionColor' | translate"
							(change)="onColorChange($event)"
						/>
					</label>
				</div>

				<pptx-text-3d-bevel-section
					[label]="'pptx.text3d.bevelTop' | translate"
					[keys]="topBevelKeys"
					[text3d]="text3d()"
					(bevelChange)="commit($event)"
				/>
				<pptx-text-3d-bevel-section
					[label]="'pptx.text3d.bevelBottom' | translate"
					[keys]="bottomBevelKeys"
					[text3d]="text3d()"
					(bevelChange)="commit($event)"
				/>

				<label class="t3d__field t3d__field--indent">
					<span class="t3d__label">{{ 'pptx.text3d.material' | translate }}</span>
					<select
						class="t3d__select"
						[value]="material()"
						[attr.aria-label]="'pptx.text3d.material' | translate"
						(change)="onMaterialChange($event)"
					>
						@for (preset of materialPresets; track preset.value) {
							<option [value]="preset.value">{{ preset.label }}</option>
						}
					</select>
				</label>
			}
		</div>
	`,
	styles: `
		:host {
			display: block;
		}
		.t3d {
			display: grid;
			gap: 6px;
			padding: 4px 0 8px;
			font-size: 11px;
		}
		.t3d__check {
			display: flex;
			align-items: center;
			gap: 6px;
		}
		.t3d__grid2 {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 6px;
			padding-left: 10px;
		}
		.t3d__field {
			display: grid;
			gap: 2px;
			min-width: 0;
		}
		.t3d__field--indent {
			padding-left: 10px;
		}
		.t3d__label {
			font-size: 10px;
			color: var(--pptx-inspector-muted, #888);
		}
		.t3d__input,
		.t3d__select {
			box-sizing: border-box;
			width: 100%;
			min-width: 0;
			background: var(--pptx-inspector-input-bg, rgba(0, 0, 0, 0.06));
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 3px;
			color: inherit;
			font: inherit;
			font-size: 11px;
			padding: 2px 4px;
		}
		.t3d__color {
			width: 100%;
			height: 24px;
			box-sizing: border-box;
			background: transparent;
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 3px;
			padding: 1px;
			cursor: pointer;
		}
	`,
})
export class Text3DPanelComponent {
	/** The selected element whose text style carries the 3D settings. */
	readonly element = input.required<PptxElement>();

	/** A partial-element patch for the orchestrator to commit (one history entry). */
	readonly patch = output<Partial<PptxElement>>();

	protected readonly materialPresets = MATERIAL_PRESETS;
	protected readonly maxDepthPt = TEXT_3D_MAX_EXTRUSION_PT;
	protected readonly topBevelKeys = TEXT_3D_TOP_BEVEL_KEYS;
	protected readonly bottomBevelKeys = TEXT_3D_BOTTOM_BEVEL_KEYS;

	protected readonly text3d = computed<Text3DStyle | undefined>(() => {
		const el = this.element();
		return hasTextProperties(el) ? el.textStyle?.text3d : undefined;
	});

	protected readonly hasExtrusion = computed(() => hasText3dExtrusion(this.text3d()));
	protected readonly depthPt = computed(() => text3dEmuToPt(this.text3d()?.extrusionHeight));
	protected readonly extrusionColor = computed(() =>
		normalizeHexColor(this.text3d()?.extrusionColor, DEFAULT_EXTRUSION_COLOR),
	);
	protected readonly material = computed<string>(() => this.text3d()?.presetMaterial ?? '');

	/** Merge a partial 3D change onto the current style and emit the patch. */
	protected commit(changes: Partial<Text3DStyle>): void {
		this.emitText3d(mergeText3d(this.text3d(), changes));
	}

	protected onExtrusionToggle(event: Event): void {
		const enabled = (event.target as HTMLInputElement).checked;
		this.emitText3d(toggleText3dExtrusion(this.text3d(), enabled));
	}

	protected onDepthChange(event: Event): void {
		const raw = Number((event.target as HTMLInputElement).value);
		if (!Number.isFinite(raw)) {
			return;
		}
		this.commit({
			extrusionHeight: text3dPtToEmu(clampText3dPt(raw, TEXT_3D_MAX_EXTRUSION_PT)),
		});
	}

	protected onColorChange(event: Event): void {
		this.commit({ extrusionColor: (event.target as HTMLInputElement).value });
	}

	protected onMaterialChange(event: Event): void {
		const value = (event.target as HTMLSelectElement).value;
		this.commit({ presetMaterial: value ? (value as MaterialPresetType) : undefined });
	}

	private emitText3d(next: Text3DStyle | undefined): void {
		this.patch.emit(text3dStylePatch(this.element(), next));
	}
}
