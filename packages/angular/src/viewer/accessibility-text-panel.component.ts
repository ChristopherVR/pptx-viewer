import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement } from 'pptx-viewer-core';

import { getNonVisualDescriptionFields, shouldShowAccessibilitySection } from '../internal/shared';

/**
 * Alt text / title editor for a plain shape, text box, connector, or any
 * graphic-frame kind (table/chart/smartArt/media/ole), at parity with
 * React's `AccessibilityTextSection` and Vue's `AccessibilityPanel.vue`.
 *
 * A picture's own alt text field lives in `ImagePropertiesPanelComponent`;
 * `shouldShowAccessibilitySection` (shared) decides which other element
 * kinds get this panel at all, and `getNonVisualDescriptionFields` (shared)
 * decides which of its two fields apply, so this component stays a thin
 * view.
 */
@Component({
	selector: 'pptx-accessibility-text-panel',
	standalone: true,
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (fields().showAltText || fields().showTitle) {
			<div class="pptx-ng-accessibility-text" data-pptx-accessibility-text>
				@if (fields().showAltText) {
					<label class="field field--stacked">
						<span>{{ 'pptx.elementAccessibility.altText' | translate }}</span>
						<textarea
							rows="2"
							[value]="fields().altText"
							[placeholder]="'pptx.elementAccessibility.altTextPlaceholder' | translate"
							(input)="onAltText($event)"
						></textarea>
					</label>
				}
				@if (fields().showTitle) {
					<label class="field field--stacked">
						<span>{{ 'pptx.elementAccessibility.title' | translate }}</span>
						<input
							type="text"
							[value]="fields().title"
							[placeholder]="'pptx.elementAccessibility.titlePlaceholder' | translate"
							(input)="onTitle($event)"
						/>
					</label>
				}
			</div>
		}
	`,
	styles: `
		.pptx-ng-accessibility-text {
			display: grid;
			gap: 9px;
			font-size: 11px;
		}
		.field {
			display: grid;
			gap: 4px;
			color: var(--pptx-inspector-muted, #aaa);
		}
		.field--stacked {
			grid-template-columns: 1fr;
		}
		input[type='text'],
		textarea {
			box-sizing: border-box;
			width: 100%;
			padding: 4px 6px;
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 3px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			color: inherit;
			font: inherit;
			resize: vertical;
		}
	`,
})
export class AccessibilityTextPanelComponent {
	readonly element = input.required<PptxElement>();
	readonly patch = output<Partial<PptxElement>>();

	protected readonly fields = computed(() => getNonVisualDescriptionFields(this.element()));

	/** Whether the selected element kind should show this panel at all. */
	static supports(element: PptxElement): boolean {
		return shouldShowAccessibilitySection(element);
	}

	protected onAltText(event: Event): void {
		this.patch.emit({
			altText: (event.target as HTMLTextAreaElement).value,
		} as Partial<PptxElement>);
	}

	protected onTitle(event: Event): void {
		this.patch.emit({ title: (event.target as HTMLInputElement).value } as Partial<PptxElement>);
	}
}
