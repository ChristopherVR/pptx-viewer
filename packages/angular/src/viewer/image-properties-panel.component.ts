import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement, PptxImageEffects } from 'pptx-viewer-core';
import { isImageLikeElement } from 'pptx-viewer-core';

import { ARTISTIC_EFFECTS } from '../internal/shared';
import { ImageCropWashPanelComponent } from './image-crop-wash-panel.component';

type ImageElement = PptxElement & { altText?: string; imageEffects?: PptxImageEffects };

export function mergeImageEffects(
	effects: PptxImageEffects | undefined,
	update: Partial<PptxImageEffects>,
): PptxImageEffects {
	return { ...(effects ?? {}), ...update };
}

@Component({
	selector: 'pptx-image-properties-panel',
	standalone: true,
	imports: [TranslatePipe, ImageCropWashPanelComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="pptx-ng-image-properties">
			<label class="field field--stacked">
				<span>{{ 'pptx.image.altText' | translate }}</span>
				<input type="text" [value]="image().altText ?? ''" (input)="onAltText($event)" />
			</label>
			@for (slider of sliders; track slider.key) {
				<label class="field">
					<span>{{ slider.label | translate }}</span>
					<input
						type="range"
						[min]="slider.min"
						[max]="slider.max"
						[value]="effectValue(slider.key)"
						(input)="onEffectNumber(slider.key, $event)"
					/>
					<output>{{ effectValue(slider.key) }}</output>
				</label>
			}
			<label class="field">
				<span>{{ 'pptx.image.grayscale' | translate }}</span>
				<input type="checkbox" [checked]="!!effects().grayscale" (change)="onGrayscale($event)" />
			</label>
			<label class="field field--stacked">
				<span>{{ 'pptx.image.artisticEffects' | translate }}</span>
				<select
					[attr.aria-label]="'pptx.image.artisticEffects' | translate"
					[value]="effects().artisticEffect ?? 'none'"
					(change)="onArtistic($event)"
				>
					@for (effect of artisticEffects; track effect[0]) {
						<option [value]="effect[0]">{{ effect[1] | translate }}</option>
					}
				</select>
			</label>
			<div class="duotone">
				<span>{{ 'pptx.image.duotone' | translate }}</span>
				<input
					type="color"
					[value]="effects().duotone?.color1 ?? '#000000'"
					(change)="onDuotone($event, 'color1')"
				/>
				<input
					type="color"
					[value]="effects().duotone?.color2 ?? '#ffffff'"
					(change)="onDuotone($event, 'color2')"
				/>
				<button type="button" (click)="clearDuotone()">
					{{ 'pptx.common.clear' | translate }}
				</button>
			</div>
			<pptx-image-crop-wash-panel [element]="element()" (patch)="patch.emit($event)" />
			<button type="button" class="reset" (click)="reset()">
				{{ 'pptx.image.resetImage' | translate }}
			</button>
		</div>
	`,
	styles: `
		.pptx-ng-image-properties {
			display: grid;
			gap: 9px;
			font-size: 11px;
		}
		.field {
			display: grid;
			grid-template-columns: 78px 1fr 30px;
			align-items: center;
			gap: 6px;
			color: var(--pptx-inspector-muted, #aaa);
		}
		.field--stacked {
			grid-template-columns: 1fr;
		}
		input[type='text'],
		select {
			box-sizing: border-box;
			width: 100%;
			padding: 4px 6px;
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 3px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			color: inherit;
		}
		input[type='range'] {
			min-width: 0;
			accent-color: var(--pptx-primary, #2563eb);
		}
		output {
			text-align: right;
			font-variant-numeric: tabular-nums;
		}
		.duotone {
			display: grid;
			grid-template-columns: 1fr 30px 30px auto;
			align-items: center;
			gap: 6px;
			color: var(--pptx-inspector-muted, #aaa);
		}
		button {
			padding: 4px 7px;
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 3px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			color: inherit;
			cursor: pointer;
		}
		.reset {
			width: 100%;
		}
	`,
})
export class ImagePropertiesPanelComponent {
	readonly element = input.required<PptxElement>();
	readonly patch = output<Partial<PptxElement>>();

	protected readonly image = computed(() => this.element() as ImageElement);
	protected readonly effects = computed(() => this.image().imageEffects ?? {});
	protected readonly artisticEffects = ARTISTIC_EFFECTS;
	protected readonly sliders = [
		{ key: 'brightness', label: 'pptx.imageAdjustments.brightness', min: -100, max: 100 },
		{ key: 'contrast', label: 'pptx.imageAdjustments.contrast', min: -100, max: 100 },
		{ key: 'saturation', label: 'pptx.image.saturation', min: -100, max: 100 },
		{ key: 'alphaModFix', label: 'pptx.imageAdjustments.transparency', min: 0, max: 100 },
		{ key: 'biLevel', label: 'pptx.imageAdjustments.biLevelThreshold', min: 0, max: 100 },
	] as const;

	static supports(element: PptxElement): boolean {
		return isImageLikeElement(element);
	}

	protected effectValue(key: keyof PptxImageEffects): number {
		const value = this.effects()[key];
		return typeof value === 'number' ? value : key === 'alphaModFix' ? 100 : 0;
	}

	private updateEffects(update: Partial<PptxImageEffects>): void {
		this.patch.emit({
			imageEffects: mergeImageEffects(this.effects(), update),
		} as Partial<PptxElement>);
	}

	protected onAltText(event: Event): void {
		this.patch.emit({ altText: (event.target as HTMLInputElement).value } as Partial<PptxElement>);
	}

	protected onEffectNumber(key: keyof PptxImageEffects, event: Event): void {
		this.updateEffects({ [key]: Number((event.target as HTMLInputElement).value) });
	}

	protected onGrayscale(event: Event): void {
		this.updateEffects({ grayscale: (event.target as HTMLInputElement).checked || undefined });
	}

	protected onArtistic(event: Event): void {
		const value = (event.target as HTMLSelectElement).value;
		this.updateEffects({ artisticEffect: value === 'none' ? undefined : value });
	}

	protected onDuotone(event: Event, key: 'color1' | 'color2'): void {
		const current = this.effects().duotone ?? { color1: '#000000', color2: '#ffffff' };
		this.updateEffects({
			duotone: { ...current, [key]: (event.target as HTMLInputElement).value },
		});
	}

	protected clearDuotone(): void {
		this.updateEffects({ duotone: undefined });
	}

	protected reset(): void {
		this.patch.emit({
			imageEffects: undefined,
			cropLeft: 0,
			cropTop: 0,
			cropRight: 0,
			cropBottom: 0,
		} as Partial<PptxElement>);
	}
}
