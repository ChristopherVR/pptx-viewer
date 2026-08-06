/**
 * slide-template-gallery-dialog.component.ts: the Slide Templates gallery.
 *
 * Selector: `pptx-slide-template-gallery-dialog`
 *
 * Angular port of the React `SlideTemplateGalleryDialog.tsx`. Presents the
 * shared slide-template catalogue as a grid of live-rendered previews (one
 * `pptx-slide-template-preview` each). Single click selects, double click or
 * the Insert button emits an `insert` event carrying the chosen template id;
 * the host (the viewer) inserts the slide after the active one via
 * `EditorStateService.insertSlideFromTemplate` (one history entry).
 *
 * @module angular-viewer/slide-template-gallery-dialog
 */

import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { SLIDE_TEMPLATES } from '../internal/shared';
import type { SlideTemplateId } from '../internal/shared';
import { ModalDialogComponent } from './modal-dialog.component';
import { SlideTemplatePreviewComponent } from './slide-template-preview.component';

@Component({
	selector: 'pptx-slide-template-gallery-dialog',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ModalDialogComponent, SlideTemplatePreviewComponent, TranslatePipe],
	template: `
		<pptx-modal-dialog
			[open]="open()"
			[title]="'pptx.slideTemplates.galleryTitle' | translate"
			(close)="close.emit()"
		>
			<div class="pptx-tpl-gallery">
				<p class="pptx-tpl-gallery__desc">
					{{ 'pptx.slideTemplates.galleryDescription' | translate }}
				</p>
				<div
					class="pptx-tpl-gallery__grid"
					role="listbox"
					[attr.aria-label]="'pptx.slideTemplates.gallery' | translate"
				>
					@for (spec of templates; track spec.id) {
						<button
							type="button"
							role="option"
							class="pptx-tpl-gallery__cell"
							[class.is-selected]="selected() === spec.id"
							[attr.aria-selected]="selected() === spec.id"
							[attr.aria-label]="spec.nameKey | translate"
							[title]="spec.descriptionKey | translate"
							(click)="select(spec.id)"
							(dblclick)="confirmTemplate(spec.id)"
						>
							<span class="pptx-tpl-gallery__thumb">
								<pptx-slide-template-preview [templateId]="spec.id" [scheme]="scheme()" />
							</span>
							<span class="pptx-tpl-gallery__cell-label">{{ spec.nameKey | translate }}</span>
						</button>
					}
				</div>
			</div>

			<div footer class="pptx-tpl-gallery__footer">
				<button type="button" class="pptx-tpl-gallery__btn" (click)="close.emit()">
					{{ 'pptx.slideTemplates.cancel' | translate }}
				</button>
				<button
					type="button"
					class="pptx-tpl-gallery__btn pptx-tpl-gallery__btn--primary"
					[disabled]="selected() === null"
					(click)="confirm()"
				>
					{{ 'pptx.slideTemplates.insert' | translate }}
				</button>
			</div>
		</pptx-modal-dialog>
	`,
	styles: `
		.pptx-tpl-gallery {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			min-width: min(86vw, 560px);
		}

		.pptx-tpl-gallery__desc {
			margin: 0;
			font-size: 11px;
			color: var(--pptx-muted-foreground, #6b7280);
		}

		.pptx-tpl-gallery__grid {
			display: grid;
			grid-template-columns: repeat(3, 1fr);
			gap: 0.5rem;
			max-height: 20rem;
			overflow-y: auto;
		}

		.pptx-tpl-gallery__cell {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 0.25rem;
			padding: 0.4rem;
			border: 1px solid var(--pptx-border, #e5e7eb);
			border-radius: 4px;
			background: transparent;
			color: inherit;
			cursor: pointer;
		}

		.pptx-tpl-gallery__cell:hover {
			background: var(--pptx-accent, #f1f5f9);
		}

		.pptx-tpl-gallery__cell.is-selected {
			border-color: var(--pptx-primary, #2563eb);
			background: color-mix(in srgb, var(--pptx-primary, #2563eb) 18%, transparent);
		}

		.pptx-tpl-gallery__thumb {
			display: flex;
			align-items: center;
			justify-content: center;
			background: var(--pptx-muted, #f1f5f9);
			border-radius: 4px;
		}

		.pptx-tpl-gallery__cell-label {
			font-size: 10px;
			text-align: center;
			line-height: 1.15;
		}

		.pptx-tpl-gallery__footer {
			display: flex;
			gap: 0.5rem;
			justify-content: flex-end;
		}

		.pptx-tpl-gallery__btn {
			padding: 0.35rem 0.85rem;
			font-size: 12px;
			border: 1px solid var(--pptx-border, #e5e7eb);
			border-radius: 4px;
			background: var(--pptx-muted, #f1f5f9);
			color: inherit;
			cursor: pointer;
		}

		.pptx-tpl-gallery__btn--primary {
			background: var(--pptx-primary, #2563eb);
			border-color: var(--pptx-primary, #2563eb);
			color: #fff;
		}

		.pptx-tpl-gallery__btn:disabled {
			opacity: 0.45;
			cursor: not-allowed;
		}
	`,
})
export class SlideTemplateGalleryDialogComponent {
	/** Whether the dialog is visible. */
	readonly open = input<boolean>(false);

	/** Optional deck scheme map so previews show the deck's theme colours. */
	readonly scheme = input<Record<string, string> | undefined>(undefined);

	/** Emitted when the dialog should close (cancel / backdrop / Escape). */
	readonly close = output<void>();

	/** Emitted with the chosen template id when the user confirms. */
	readonly insert = output<SlideTemplateId>();

	/** The shared catalogue (12 templates). */
	protected readonly templates = SLIDE_TEMPLATES;

	protected readonly selected = signal<SlideTemplateId | null>(null);

	constructor() {
		// Reset the selection each time the dialog opens, so it starts fresh.
		effect(() => {
			if (this.open()) {
				this.selected.set(null);
			}
		});
	}

	/** Select a template tile (single click). */
	protected select(id: SlideTemplateId): void {
		this.selected.set(id);
	}

	/** Insert a template immediately (double-click shortcut). */
	protected confirmTemplate(id: SlideTemplateId): void {
		this.selected.set(id);
		this.confirm();
	}

	/** Emit the insert payload for the current selection, then close. */
	protected confirm(): void {
		const id = this.selected();
		if (id === null) {
			return;
		}
		this.insert.emit(id);
		this.close.emit();
	}
}
