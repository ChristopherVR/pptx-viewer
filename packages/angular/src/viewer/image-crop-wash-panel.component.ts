import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement, PptxImageEffects } from 'pptx-viewer-core';
import { isImageLikeElement } from 'pptx-viewer-core';

const SIDES = ['Left', 'Top', 'Right', 'Bottom'] as const;
type CropSide = (typeof SIDES)[number];
type ImageElement = PptxElement & { imageEffects?: PptxImageEffects };

export function clampImageCrop(value: number | undefined): number {
	return Math.max(0, Math.min(0.8, Number.isFinite(value) ? (value as number) : 0));
}

@Component({
	selector: 'pptx-image-crop-wash-panel',
	standalone: true,
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<section class="panel" aria-label="Image crop and color wash">
			<div class="crop-grid">
				@for (side of sides; track side) {
					<label
						><span>Crop {{ side }}</span
						><input
							type="range"
							min="0"
							max="80"
							[value]="crop(side) * 100"
							(input)="onCrop(side, $event)"
					/></label>
				}
			</div>
			<button type="button" (click)="resetCrop()">{{ 'pptx.image.resetCrop' | translate }}</button>
			<label class="toggle"
				><span>{{ 'pptx.image.colorWash' | translate }}</span
				><input type="checkbox" [checked]="!!wash()" (change)="toggleWash($event)"
			/></label>
			@if (wash(); as value) {
				<div class="wash">
					<label
						><span>{{ 'pptx.image.washColor' | translate }}</span
						><input type="color" [value]="value.color || '#0066cc'" (change)="onWashColor($event)"
					/></label>
					<label
						><span>{{ 'pptx.image.washOpacity' | translate }}</span
						><input
							type="range"
							min="0"
							max="100"
							[value]="value.opacity"
							(input)="onWashOpacity($event)"
					/></label>
				</div>
			}
		</section>
	`,
	styles: `
		.panel {
			display: grid;
			gap: 8px;
			padding-top: 4px;
			font-size: 11px;
		}
		.crop-grid,
		.wash {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 7px;
		}
		label {
			display: grid;
			gap: 3px;
			color: var(--pptx-inspector-muted, #aaa);
		}
		.toggle {
			display: flex;
			align-items: center;
			justify-content: space-between;
		}
		input[type='range'] {
			width: 100%;
			accent-color: var(--pptx-primary, #2563eb);
		}
		button {
			padding: 4px 7px;
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 3px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			color: inherit;
			cursor: pointer;
		}
	`,
})
export class ImageCropWashPanelComponent {
	readonly element = input.required<PptxElement>();
	readonly patch = output<Partial<PptxElement>>();
	protected readonly sides = SIDES;
	protected readonly effects = computed(() => (this.element() as ImageElement).imageEffects ?? {});
	protected readonly wash = computed(() => this.effects().colorWash);

	protected crop(side: CropSide): number {
		return clampImageCrop(this.element()[`crop${side}` as keyof PptxElement] as number | undefined);
	}
	protected onCrop(side: CropSide, event: Event): void {
		if (!isImageLikeElement(this.element())) {
			return;
		}
		this.patch.emit({
			[`crop${side}`]: clampImageCrop(Number((event.target as HTMLInputElement).value) / 100),
		} as Partial<PptxElement>);
	}
	protected resetCrop(): void {
		this.patch.emit({
			cropLeft: 0,
			cropTop: 0,
			cropRight: 0,
			cropBottom: 0,
		} as Partial<PptxElement>);
	}
	protected toggleWash(event: Event): void {
		this.updateEffects({
			colorWash: (event.target as HTMLInputElement).checked
				? { color: '#0066cc', opacity: 40 }
				: undefined,
		});
	}
	protected onWashColor(event: Event): void {
		this.updateEffects({
			colorWash: {
				color: (event.target as HTMLInputElement).value,
				opacity: this.wash()?.opacity ?? 40,
			},
		});
	}
	protected onWashOpacity(event: Event): void {
		this.updateEffects({
			colorWash: {
				color: this.wash()?.color ?? '#0066cc',
				opacity: Number((event.target as HTMLInputElement).value),
			},
		});
	}
	private updateEffects(update: Partial<PptxImageEffects>): void {
		this.patch.emit({ imageEffects: { ...this.effects(), ...update } } as Partial<PptxElement>);
	}
}
