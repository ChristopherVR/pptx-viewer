/**
 * ole-editor-dialog.component.ts: "Edit content" dialog for an embedded OLE
 * object.
 *
 * Selector: `pptx-ole-editor-dialog`
 *
 * Angular port of the React `OleEditorDialog`. Presents a spreadsheet grid,
 * document paragraph list, or nested-deck slide title list depending on the
 * payload kind (`buildOleEditDialogDescriptor`), plus a Replace File action
 * always available regardless of kind. Composes {@link ModalDialogComponent}
 * for the shell and the three per-kind tab editors
 * ({@link OleSheetGridEditorComponent}, {@link OleDocumentEditorComponent},
 * {@link OleDeckEditorComponent}).
 *
 * Every edit commits through the same core `ole-edit-api.ts` functions every
 * other binding calls, and the same `patch` output every other inspector
 * field already uses (via `ElementMiscPropertiesComponent`), so
 * undo/history/collaboration sync works exactly like a typed-field edit.
 *
 * Behaviour:
 *  - The host owns the `open` flag; loading happens reactively (an `effect`)
 *    whenever the dialog opens or the element changes, for whichever content
 *    tab the descriptor selects. A browser cannot run the native application
 *    that owns the object, so the descriptor's tab kind never changes while
 *    the dialog is open.
 *  - Each per-kind editor commits on blur, refreshing its own local content
 *    afterward so the field reflects exactly what was written back.
 *  - Replace File always closes the dialog on success (the tab kind may no
 *    longer apply to the new payload, so there is nothing to keep showing).
 */
import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	ElementRef,
	computed,
	effect,
	inject,
	input,
	output,
	signal,
	viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type {
	OleNestedDeckSlideDetail,
	OlePptxElement,
	OleSheetGrid,
	PptxElement,
} from 'pptx-viewer-core';
import {
	applyOleDocumentParagraphEdit,
	applyOleNestedDeckElementTextEdit,
	applyOleSheetCellEdit,
	getOleDocumentParagraphs,
	getOleNestedDeckDetail,
	getOleSheetGrid,
	replaceOleFile,
} from 'pptx-viewer-core';

import { buildOleContentUpdatePatch, buildOleEditDialogDescriptor } from '../internal/shared';
import { ModalDialogComponent } from './modal-dialog.component';
import { OleDeckEditorComponent } from './ole-deck-editor.component';
import type { OleDeckElementEdit } from './ole-deck-editor.component';
import type { OleParagraphEdit } from './ole-document-editor.component';
import { OleDocumentEditorComponent } from './ole-document-editor.component';
import type { OleSheetCellEdit } from './ole-sheet-grid-editor.component';
import { OleSheetGridEditorComponent } from './ole-sheet-grid-editor.component';

@Component({
	selector: 'pptx-ole-editor-dialog',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		ModalDialogComponent,
		OleSheetGridEditorComponent,
		OleDocumentEditorComponent,
		OleDeckEditorComponent,
		TranslatePipe,
	],
	template: `
		<pptx-modal-dialog
			[open]="open()"
			[title]="descriptor().titleKey | translate"
			(close)="requestClose()"
		>
			<div class="pptx-ole-edit-body">
				@if (loading()) {
					<p class="pptx-ole-edit-status">{{ 'pptx.ole.editDialog.loading' | translate }}</p>
				}
				@if (saveError()) {
					<p class="pptx-ole-edit-error">{{ 'pptx.ole.editDialog.saveError' | translate }}</p>
				}
				@if (!loading()) {
					@switch (descriptor().contentTab?.kind) {
						@case ('sheet') {
							<pptx-ole-sheet-grid-editor [grid]="grid()" (cellEdit)="onCellEdit($event)" />
						}
						@case ('document') {
							<pptx-ole-document-editor
								[paragraphs]="paragraphs()"
								(paragraphEdit)="onParagraphEdit($event)"
							/>
						}
						@case ('deck') {
							<pptx-ole-deck-editor
								[slides]="deckSlides()"
								(deckElementEdit)="onDeckElementEdit($event)"
							/>
						}
						@default {
							<p class="pptx-ole-edit-status">
								{{ 'pptx.ole.editDialog.unsupported' | translate }}
							</p>
						}
					}
				}
			</div>

			<div footer class="pptx-ole-edit-footer">
				<input
					#fileInput
					type="file"
					class="pptx-ole-edit-file-input"
					(change)="onFileChosen($event)"
				/>
				<button type="button" class="pptx-ole-edit-btn" (click)="triggerFileInput()">
					{{ 'pptx.ole.editDialog.replaceFile' | translate }}
				</button>
				<button
					type="button"
					class="pptx-ole-edit-btn pptx-ole-edit-btn-primary"
					(click)="requestClose()"
				>
					{{ 'pptx.ole.editDialog.save' | translate }}
				</button>
			</div>
		</pptx-modal-dialog>
	`,
	styleUrl: './ole-editor-dialog.component.css',
})
export class OleEditorDialogComponent {
	/** Whether the dialog is visible. */
	readonly open = input<boolean>(false);

	/** The OLE element being edited. */
	readonly element = input.required<OlePptxElement>();

	/** Fired with the field patch to commit whenever an edit changes the payload. */
	readonly patch = output<Partial<PptxElement>>();

	/** Fired when the dialog is dismissed (backdrop, `x`, Escape, Save, or a successful Replace File). */
	readonly close = output<void>();

	private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

	/** Which tab/kind this element's payload maps to, and the dialog furniture. */
	protected readonly descriptor = computed(() => buildOleEditDialogDescriptor(this.element()));

	protected readonly grid = signal<OleSheetGrid | undefined>(undefined);
	protected readonly paragraphs = signal<string[] | undefined>(undefined);
	protected readonly deckSlides = signal<OleNestedDeckSlideDetail[] | undefined>(undefined);
	protected readonly loading = signal(false);
	protected readonly saveError = signal(false);

	/** Whether this component has been destroyed, so a late-resolving edit/save promise below can skip its write. */
	private destroyed = false;

	/** Run `fn` unless a post-await resolution arrived after this component was destroyed. */
	private ifAlive(fn: () => void): void {
		if (!this.destroyed) {
			fn();
		}
	}

	constructor() {
		inject(DestroyRef).onDestroy(() => {
			this.destroyed = true;
		});

		// Re-fetch whenever the dialog opens or the element identity changes,
		// for whichever content tab the descriptor selects.
		effect((onCleanup) => {
			const isOpen = this.open();
			const element = this.element();
			const tab = this.descriptor().contentTab;
			// `buildOleEditDialogDescriptor` only ever sets `contentTab` for a
			// non-'file' kind (a plain file offers Replace File only), but the
			// type is the full `OleEditorKind` union; narrow here rather than
			// widen `loadContent`'s signature to a kind it can never act on.
			if (!isOpen || !tab || tab.kind === 'file') {
				return;
			}
			let cancelled = false;
			onCleanup(() => {
				cancelled = true;
			});
			void this.loadContent(tab.kind, element, () => cancelled);
		});
	}

	/** Fetch the content for one tab kind; guarded by `isCancelled` after every await. */
	private async loadContent(
		kind: 'sheet' | 'document' | 'deck',
		element: OlePptxElement,
		isCancelled: () => boolean,
	): Promise<void> {
		this.loading.set(true);
		if (kind === 'sheet') {
			const value = await getOleSheetGrid(element);
			if (!isCancelled()) {
				this.grid.set(value);
			}
		} else if (kind === 'document') {
			const value = await getOleDocumentParagraphs(element);
			if (!isCancelled()) {
				this.paragraphs.set(value);
			}
		} else {
			const value = await getOleNestedDeckDetail(element);
			if (!isCancelled()) {
				this.deckSlides.set(value);
			}
		}
		if (!isCancelled()) {
			this.loading.set(false);
		}
	}

	private commit(updated: OlePptxElement): void {
		if (!updated.oleContentDirty) {
			return;
		}
		this.patch.emit(buildOleContentUpdatePatch(updated) as Partial<PptxElement>);
	}

	protected async onCellEdit(edit: OleSheetCellEdit): Promise<void> {
		try {
			const updated = await applyOleSheetCellEdit(this.element(), edit);
			this.commit(updated);
			const refreshed = await getOleSheetGrid(updated);
			this.ifAlive(() => this.grid.set(refreshed));
		} catch {
			this.ifAlive(() => this.saveError.set(true));
		}
	}

	protected async onParagraphEdit(edit: OleParagraphEdit): Promise<void> {
		try {
			const updated = await applyOleDocumentParagraphEdit(this.element(), edit.index, edit.text);
			this.commit(updated);
			const refreshed = await getOleDocumentParagraphs(updated);
			this.ifAlive(() => this.paragraphs.set(refreshed));
		} catch {
			this.ifAlive(() => this.saveError.set(true));
		}
	}

	protected async onDeckElementEdit(edit: OleDeckElementEdit): Promise<void> {
		try {
			const updated = await applyOleNestedDeckElementTextEdit(
				this.element(),
				edit.slideIndex,
				edit.elementId,
				edit.text,
			);
			this.commit(updated);
			const refreshed = await getOleNestedDeckDetail(updated);
			this.ifAlive(() => this.deckSlides.set(refreshed));
		} catch {
			this.ifAlive(() => this.saveError.set(true));
		}
	}

	protected onFileChosen(event: Event): void {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (file) {
			void this.replaceFile(file);
		}
	}

	private async replaceFile(file: File): Promise<void> {
		try {
			const bytes = new Uint8Array(await file.arrayBuffer());
			const updated = await replaceOleFile(this.element(), bytes, file.name);
			this.commit(updated);
			this.ifAlive(() => this.close.emit());
		} catch {
			this.ifAlive(() => this.saveError.set(true));
		}
	}

	protected triggerFileInput(): void {
		this.fileInput()?.nativeElement.click();
	}

	protected requestClose(): void {
		this.close.emit();
	}
}
