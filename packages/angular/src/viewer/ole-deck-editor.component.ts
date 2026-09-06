/**
 * ole-deck-editor.component.ts: editable full text-element list for the OLE
 * "Edit content" dialog's nested-deck tab: every slide, every text-bearing
 * shape.
 *
 * Selector: `pptx-ole-deck-editor`
 *
 * Extracted from `ole-editor-dialog.component.ts` to respect the 300-LOC
 * file-size limit, matching React's `OleDeckEditor`. A value is committed
 * on blur only when it actually changed.
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { OleNestedDeckSlideDetail } from 'pptx-viewer-core';

/** One committed nested-deck element edit. */
export interface OleDeckElementEdit {
	slideIndex: number;
	elementId: string;
	text: string;
}

@Component({
	selector: 'pptx-ole-deck-editor',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		@if (!slides() || slides()!.length === 0) {
			<p class="pptx-ole-edit-empty">{{ 'pptx.ole.editDialog.deckEmpty' | translate }}</p>
		} @else {
			<div class="pptx-ole-edit-slides">
				@for (slide of slides()!; track slide.index) {
					<div class="pptx-ole-edit-slide">
						<span class="pptx-ole-edit-slide-label">
							{{ 'pptx.ole.editDialog.deckSlideLabel' | translate: { number: slide.index + 1 } }}
						</span>
						@if (slide.elements.length === 0) {
							<p class="pptx-ole-edit-empty">{{ 'pptx.ole.editDialog.deckEmpty' | translate }}</p>
						} @else {
							@for (element of slide.elements; track element.elementId) {
								<input
									type="text"
									[value]="element.text"
									(blur)="onBlur(slide.index, element.elementId, element.text, $event)"
								/>
							}
						}
					</div>
				}
			</div>
		}
	`,
	styles: [
		`
			.pptx-ole-edit-empty {
				margin: 0;
				font-size: 11px;
				color: var(--pptx-muted-foreground, #9ca3af);
			}
			.pptx-ole-edit-slides {
				display: flex;
				flex-direction: column;
				gap: 12px;
			}
			.pptx-ole-edit-slide {
				display: flex;
				flex-direction: column;
				gap: 6px;
			}
			.pptx-ole-edit-slide-label {
				font-size: 10px;
				font-weight: 600;
				color: var(--pptx-muted-foreground, #9ca3af);
			}
			.pptx-ole-edit-slide input {
				width: 100%;
				box-sizing: border-box;
				padding: 6px 8px;
				border: 1px solid var(--pptx-border, #374151);
				border-radius: 4px;
				background: var(--pptx-muted, #111827);
				color: var(--pptx-foreground, #f3f4f6);
				font-size: 11px;
			}
			.pptx-ole-edit-slide input:focus {
				outline: none;
				border-color: var(--pptx-primary, #6366f1);
			}
		`,
	],
})
export class OleDeckEditorComponent {
	/** Slides to render; `undefined` while still loading. */
	readonly slides = input<OleNestedDeckSlideDetail[] | undefined>(undefined);

	/** Fired when a text-bearing shape's committed text differs from what was loaded. */
	readonly deckElementEdit = output<OleDeckElementEdit>();

	protected onBlur(slideIndex: number, elementId: string, original: string, event: Event): void {
		const value = (event.target as HTMLInputElement).value;
		if (value !== original) {
			this.deckElementEdit.emit({ slideIndex, elementId, text: value });
		}
	}
}
