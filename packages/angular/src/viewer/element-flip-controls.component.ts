import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';

export function toggleElementFlip(
	element: PptxElement,
	key: 'flipHorizontal' | 'flipVertical',
): Partial<PptxElement> {
	return { [key]: !element[key] } as Partial<PptxElement>;
}

@Component({
	selector: 'pptx-element-flip-controls',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="row" role="group" aria-label="Flip element">
			<button
				type="button"
				[class.active]="element().flipHorizontal"
				[attr.aria-pressed]="!!element().flipHorizontal"
				(click)="toggle('flipHorizontal')"
			>
				Flip horizontal
			</button>
			<button
				type="button"
				[class.active]="element().flipVertical"
				[attr.aria-pressed]="!!element().flipVertical"
				(click)="toggle('flipVertical')"
			>
				Flip vertical
			</button>
		</div>
	`,
	styles: `
		.row {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 6px;
			padding: 6px 0;
			border-bottom: 1px solid var(--pptx-inspector-border, #333);
		}
		button {
			padding: 4px;
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 3px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			color: inherit;
			font-size: 10px;
			cursor: pointer;
		}
		button.active {
			border-color: var(--pptx-primary, #2563eb);
			background: color-mix(in srgb, var(--pptx-primary, #2563eb) 25%, transparent);
		}
	`,
})
export class ElementFlipControlsComponent {
	readonly element = input.required<PptxElement>();
	readonly patch = output<Partial<PptxElement>>();

	protected toggle(key: 'flipHorizontal' | 'flipVertical'): void {
		this.patch.emit(toggleElementFlip(this.element(), key));
	}
}
