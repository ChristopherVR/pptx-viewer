/**
 * text-3d-bevel-section.component.ts: one bevel block (top or bottom) of the
 * 3D-text panel, mirroring the `BevelSection` sub-component of React's
 * `inspector/properties/Text3DProperties.tsx`.
 *
 * Selector: `pptx-text-3d-bevel-section`
 *
 * The block is key-driven rather than duplicated per edge: the caller passes
 * the three `Text3DStyle` field names it writes ({@link TEXT_3D_TOP_BEVEL_KEYS}
 * or {@link TEXT_3D_BOTTOM_BEVEL_KEYS}), so top and bottom share one template
 * and one set of clamps. Emitted patches are partial `Text3DStyle` objects; the
 * parent merges them and commits the whole `text3d` sub-object.
 */
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { BevelPresetType, Text3DStyle } from 'pptx-viewer-core';

import {
	BEVEL_PRESETS,
	TEXT_3D_MAX_BEVEL_PT,
	clampText3dPt,
	text3dEmuToPt,
	text3dPtToEmu,
} from '../internal/shared';

/** The three `Text3DStyle` fields one bevel block owns. */
export interface Text3DBevelKeys {
	readonly type: 'bevelTopType' | 'bevelBottomType';
	readonly width: 'bevelTopWidth' | 'bevelBottomWidth';
	readonly height: 'bevelTopHeight' | 'bevelBottomHeight';
}

/** Field names of the TOP bevel (`a:bevelT`). */
export const TEXT_3D_TOP_BEVEL_KEYS: Text3DBevelKeys = {
	type: 'bevelTopType',
	width: 'bevelTopWidth',
	height: 'bevelTopHeight',
};

/** Field names of the BOTTOM bevel (`a:bevelB`). */
export const TEXT_3D_BOTTOM_BEVEL_KEYS: Text3DBevelKeys = {
	type: 'bevelBottomType',
	width: 'bevelBottomWidth',
	height: 'bevelBottomHeight',
};

/**
 * Build the single-field patch for one bevel input. Exported (and pure) so the
 * clamping is unit-testable without a TestBed, matching this package's
 * convention of testing logic and leaving DOM behaviour to the e2e specs.
 */
export function bevelSizePatch(
	key: Text3DBevelKeys['width'] | Text3DBevelKeys['height'],
	pt: number,
): Partial<Text3DStyle> {
	return { [key]: text3dPtToEmu(clampText3dPt(pt, TEXT_3D_MAX_BEVEL_PT)) } as Partial<Text3DStyle>;
}

@Component({
	selector: 'pptx-text-3d-bevel-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<div class="bevel">
			<span class="bevel__title">{{ label() }}</span>
			<div class="bevel__grid">
				<label class="bevel__field">
					<span class="bevel__label">{{ 'pptx.text3d.bevelType' | translate }}</span>
					<select
						class="bevel__select"
						[disabled]="disabled()"
						[value]="bevelType()"
						[attr.aria-label]="label() + ' ' + ('pptx.text3d.bevelType' | translate)"
						(change)="onType($event)"
					>
						@for (preset of bevelPresets; track preset.value) {
							<option [value]="preset.value">{{ preset.label }}</option>
						}
					</select>
				</label>
				<label class="bevel__field">
					<span class="bevel__label">{{ 'pptx.text3d.bevelWidth' | translate }}</span>
					<input
						type="number"
						class="bevel__input"
						min="0"
						[max]="maxPt"
						step="1"
						[disabled]="disabled()"
						[value]="widthPt()"
						[attr.aria-label]="label() + ' ' + ('pptx.text3d.bevelWidth' | translate)"
						(change)="onSize($event, 'width')"
					/>
				</label>
				<label class="bevel__field">
					<span class="bevel__label">{{ 'pptx.text3d.bevelHeight' | translate }}</span>
					<input
						type="number"
						class="bevel__input"
						min="0"
						[max]="maxPt"
						step="1"
						[disabled]="disabled()"
						[value]="heightPt()"
						[attr.aria-label]="label() + ' ' + ('pptx.text3d.bevelHeight' | translate)"
						(change)="onSize($event, 'height')"
					/>
				</label>
			</div>
		</div>
	`,
	styles: `
		:host {
			display: block;
		}
		.bevel {
			display: grid;
			gap: 3px;
			padding-left: 10px;
		}
		.bevel__title {
			font-size: 10px;
			color: var(--pptx-inspector-muted, #888);
		}
		.bevel__grid {
			display: grid;
			grid-template-columns: repeat(3, 1fr);
			gap: 4px;
		}
		.bevel__field {
			display: grid;
			gap: 2px;
			min-width: 0;
		}
		.bevel__label {
			font-size: 10px;
			color: var(--pptx-inspector-muted, #888);
		}
		.bevel__select,
		.bevel__input {
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
	`,
})
export class Text3DBevelSectionComponent {
	/** Display label for this edge (already translated by the parent). */
	readonly label = input.required<string>();
	/** Which `Text3DStyle` fields this block writes. */
	readonly keys = input.required<Text3DBevelKeys>();
	/**
	 * The element's current 3D-text style, if any. Named `text3d` rather than
	 * `style` because Angular special-cases a `[style]` binding as the native
	 * style map, which would never reach an input of that name.
	 */
	readonly text3d = input<Text3DStyle | undefined>(undefined);
	/** Whether the controls are inert (no extrusion, or read-only deck). */
	readonly disabled = input<boolean>(false);

	/** A partial `Text3DStyle` change for the parent to merge and commit. */
	readonly bevelChange = output<Partial<Text3DStyle>>();

	protected readonly bevelPresets = BEVEL_PRESETS;
	protected readonly maxPt = TEXT_3D_MAX_BEVEL_PT;

	protected readonly bevelType = computed<BevelPresetType>(
		() => this.text3d()?.[this.keys().type] ?? 'none',
	);
	protected readonly widthPt = computed(() => text3dEmuToPt(this.text3d()?.[this.keys().width]));
	protected readonly heightPt = computed(() => text3dEmuToPt(this.text3d()?.[this.keys().height]));

	protected onType(event: Event): void {
		const value = (event.target as HTMLSelectElement).value as BevelPresetType;
		this.bevelChange.emit({ [this.keys().type]: value } as Partial<Text3DStyle>);
	}

	protected onSize(event: Event, dimension: 'width' | 'height'): void {
		const raw = Number((event.target as HTMLInputElement).value);
		if (!Number.isFinite(raw)) {
			return;
		}
		this.bevelChange.emit(bevelSizePatch(this.keys()[dimension], raw));
	}
}
