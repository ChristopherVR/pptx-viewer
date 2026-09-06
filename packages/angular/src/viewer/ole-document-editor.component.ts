/**
 * ole-document-editor.component.ts: editable paragraph list for the OLE
 * "Edit content" dialog's document tab.
 *
 * Selector: `pptx-ole-document-editor`
 *
 * Extracted from `ole-editor-dialog.component.ts` to respect the 300-LOC
 * file-size limit, matching React's `OleDocumentEditor`. One `<textarea>`
 * per paragraph; a value is committed on blur only when it actually changed.
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/** One committed paragraph edit: `index` is the paragraph's own 0-based index. */
export interface OleParagraphEdit {
	index: number;
	text: string;
}

@Component({
	selector: 'pptx-ole-document-editor',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		@if (!paragraphs() || paragraphs()!.length === 0) {
			<p class="pptx-ole-edit-empty">{{ 'pptx.ole.editDialog.emptyDocument' | translate }}</p>
		} @else {
			<div class="pptx-ole-edit-paragraphs">
				@for (paragraph of paragraphs()!; track $index; let i = $index) {
					<textarea
						rows="2"
						class="pptx-ole-edit-paragraph"
						[value]="paragraph"
						(blur)="onBlur(i, paragraph, $event)"
					></textarea>
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
			.pptx-ole-edit-paragraphs {
				display: flex;
				flex-direction: column;
				gap: 8px;
			}
			.pptx-ole-edit-paragraph {
				width: 100%;
				box-sizing: border-box;
				padding: 6px 8px;
				border: 1px solid var(--pptx-border, #374151);
				border-radius: 4px;
				background: var(--pptx-muted, #111827);
				color: var(--pptx-foreground, #f3f4f6);
				font-size: 11px;
				resize: vertical;
			}
			.pptx-ole-edit-paragraph:focus {
				outline: none;
				border-color: var(--pptx-primary, #6366f1);
			}
		`,
	],
})
export class OleDocumentEditorComponent {
	/** Paragraphs to render; `undefined` while still loading. */
	readonly paragraphs = input<string[] | undefined>(undefined);

	/** Fired when a paragraph's committed text differs from what was loaded. */
	readonly paragraphEdit = output<OleParagraphEdit>();

	protected onBlur(index: number, original: string, event: Event): void {
		const value = (event.target as HTMLTextAreaElement).value;
		if (value !== original) {
			this.paragraphEdit.emit({ index, text: value });
		}
	}
}
