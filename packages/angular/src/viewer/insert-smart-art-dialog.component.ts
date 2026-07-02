/**
 * insert-smart-art-dialog.component.ts: the "Insert SmartArt" gallery dialog.
 *
 * Selector: `pptx-insert-smart-art-dialog`
 *
 * Angular port of the React `InsertSmartArtDialog.tsx`. Presents a category
 * sidebar, a preset gallery of preview thumbnails (one `pptx-smart-art-preview`
 * each), and an editable node-text textarea seeded from the selected preset's
 * default items. On confirm it emits an `insert` event carrying the chosen
 * layout + (possibly edited) item texts; the host (the viewer) turns that into a
 * new SmartArt element via {@link buildSmartArtInsertElement} and commits it
 * through `EditorStateService.addElement` (one history entry).
 *
 * All non-trivial logic lives in `smart-art-insert-helpers.ts` /
 * `smart-art-preview-geometry.ts`; this component is a thin reactive shell.
 *
 * @module angular-viewer/insert-smart-art-dialog
 */

import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	input,
	output,
	signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { SmartArtLayout } from 'pptx-viewer-core';

import { CATEGORIES } from '../internal/shared';
import type { SmartArtCategory } from '../internal/shared';
import { ModalDialogComponent } from './modal-dialog.component';
import { parseNodeTextarea, presetByLayout, presetsForCategory } from './smart-art-insert-helpers';
import { SmartArtPreviewComponent } from './smart-art-preview.component';

/** Payload emitted when the user confirms an insert. */
export interface SmartArtInsertEvent {
	layout: SmartArtLayout;
	items: string[];
}

@Component({
	selector: 'pptx-insert-smart-art-dialog',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ModalDialogComponent, SmartArtPreviewComponent, TranslatePipe],
	template: `
		<pptx-modal-dialog
			[open]="open()"
			[title]="'pptx.insertSmartArt.title' | translate"
			(close)="close.emit()"
		>
			<div class="pptx-sa-insert">
				<!-- Category sidebar -->
				<nav
					class="pptx-sa-insert__sidebar"
					[attr.aria-label]="'pptx.insertSmartArt.categories' | translate"
				>
					@for (cat of categories; track cat.id) {
						<button
							type="button"
							class="pptx-sa-insert__cat"
							[class.is-active]="activeCategory() === cat.id"
							[attr.aria-pressed]="activeCategory() === cat.id"
							(click)="selectCategory(cat.id)"
						>
							{{ cat.labelKey | translate }}
						</button>
					}
				</nav>

				<!-- Gallery + node text -->
				<div class="pptx-sa-insert__main">
					<div
						class="pptx-sa-insert__gallery"
						role="listbox"
						[attr.aria-label]="'pptx.insertSmartArt.layouts' | translate"
					>
						@for (preset of filteredPresets(); track preset.layout) {
							<button
								type="button"
								role="option"
								class="pptx-sa-insert__cell"
								[class.is-selected]="selectedLayout() === preset.layout"
								[attr.aria-selected]="selectedLayout() === preset.layout"
								[title]="preset.labelKey | translate"
								(click)="selectLayout(preset.layout)"
								(dblclick)="confirmLayout(preset.layout)"
							>
								<span class="pptx-sa-insert__thumb">
									<pptx-smart-art-preview [layout]="preset.layout" />
								</span>
								<span class="pptx-sa-insert__cell-label">{{ preset.labelKey | translate }}</span>
							</button>
						}
					</div>

					<label class="pptx-sa-insert__text">
						<span class="pptx-sa-insert__text-label">{{
							'pptx.insertSmartArt.itemsLabel' | translate
						}}</span>
						<textarea
							class="pptx-sa-insert__textarea"
							rows="4"
							[disabled]="selectedLayout() === null"
							[value]="itemsText()"
							(input)="onItemsInput($event)"
						></textarea>
					</label>
				</div>
			</div>

			<div footer class="pptx-sa-insert__footer">
				<button type="button" class="pptx-sa-insert__btn" (click)="close.emit()">
					{{ 'pptx.insertSmartArt.cancel' | translate }}
				</button>
				<button
					type="button"
					class="pptx-sa-insert__btn pptx-sa-insert__btn--primary"
					[disabled]="selectedLayout() === null"
					(click)="confirm()"
				>
					{{ 'pptx.insertSmartArt.insert' | translate }}
				</button>
			</div>
		</pptx-modal-dialog>
	`,
	styles: `
		.pptx-sa-insert {
			display: flex;
			gap: 0;
			min-width: min(86vw, 560px);
		}

		.pptx-sa-insert__sidebar {
			display: flex;
			flex-direction: column;
			width: 9rem;
			flex-shrink: 0;
			border-right: 1px solid var(--pptx-border, #e5e7eb);
			padding: 0.25rem 0;
		}

		.pptx-sa-insert__cat {
			text-align: left;
			padding: 0.35rem 0.75rem;
			font-size: 12px;
			background: transparent;
			border: none;
			color: inherit;
			cursor: pointer;
		}

		.pptx-sa-insert__cat:hover {
			background: var(--pptx-accent, #f1f5f9);
		}

		.pptx-sa-insert__cat.is-active {
			background: var(--pptx-primary, #2563eb);
			color: #fff;
		}

		.pptx-sa-insert__main {
			flex: 1;
			min-width: 0;
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			padding: 0.5rem;
		}

		.pptx-sa-insert__gallery {
			display: grid;
			grid-template-columns: repeat(3, 1fr);
			gap: 0.5rem;
			max-height: 16rem;
			overflow-y: auto;
		}

		.pptx-sa-insert__cell {
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

		.pptx-sa-insert__cell:hover {
			background: var(--pptx-accent, #f1f5f9);
		}

		.pptx-sa-insert__cell.is-selected {
			border-color: var(--pptx-primary, #2563eb);
			background: color-mix(in srgb, var(--pptx-primary, #2563eb) 18%, transparent);
		}

		.pptx-sa-insert__thumb {
			width: 4rem;
			height: 3rem;
			display: flex;
			align-items: center;
			justify-content: center;
			background: var(--pptx-muted, #f1f5f9);
			border-radius: 4px;
		}

		.pptx-sa-insert__cell-label {
			font-size: 10px;
			text-align: center;
			line-height: 1.15;
		}

		.pptx-sa-insert__text {
			display: flex;
			flex-direction: column;
			gap: 0.2rem;
		}

		.pptx-sa-insert__text-label {
			font-size: 10px;
			color: var(--pptx-muted-foreground, #6b7280);
		}

		.pptx-sa-insert__textarea {
			width: 100%;
			box-sizing: border-box;
			resize: vertical;
			font-size: 12px;
			padding: 0.35rem 0.5rem;
			border: 1px solid var(--pptx-border, #e5e7eb);
			border-radius: 4px;
			background: var(--pptx-input, #fff);
			color: inherit;
		}

		.pptx-sa-insert__footer {
			display: flex;
			gap: 0.5rem;
			justify-content: flex-end;
		}

		.pptx-sa-insert__btn {
			padding: 0.35rem 0.85rem;
			font-size: 12px;
			border: 1px solid var(--pptx-border, #e5e7eb);
			border-radius: 4px;
			background: var(--pptx-muted, #f1f5f9);
			color: inherit;
			cursor: pointer;
		}

		.pptx-sa-insert__btn--primary {
			background: var(--pptx-primary, #2563eb);
			border-color: var(--pptx-primary, #2563eb);
			color: #fff;
		}

		.pptx-sa-insert__btn:disabled {
			opacity: 0.45;
			cursor: not-allowed;
		}
	`,
})
export class InsertSmartArtDialogComponent {
	/** Whether the dialog is visible. */
	readonly open = input<boolean>(false);

	/** Emitted when the dialog should close (cancel / backdrop / Escape). */
	readonly close = output<void>();

	/** Emitted with the chosen layout + item texts when the user confirms. */
	readonly insert = output<SmartArtInsertEvent>();

	protected readonly categories = CATEGORIES;

	protected readonly activeCategory = signal<SmartArtCategory>('list');
	protected readonly selectedLayout = signal<SmartArtLayout | null>(null);
	protected readonly itemsText = signal<string>('');

	/** Presets in the active category. */
	protected readonly filteredPresets = computed(() => presetsForCategory(this.activeCategory()));

	constructor() {
		// Reset selection each time the dialog opens, so it always starts fresh.
		effect(() => {
			if (this.open()) {
				this.activeCategory.set('list');
				this.selectedLayout.set(null);
				this.itemsText.set('');
			}
		});
	}

	/** Switch the active category and clear the current selection. */
	protected selectCategory(category: SmartArtCategory): void {
		this.activeCategory.set(category);
		this.selectedLayout.set(null);
		this.itemsText.set('');
	}

	/** Select a preset, seeding the textarea with its default items. */
	protected selectLayout(layout: SmartArtLayout): void {
		this.selectedLayout.set(layout);
		const preset = presetByLayout(layout);
		this.itemsText.set((preset?.defaultItems ?? []).join('\n'));
	}

	/** Capture textarea edits. */
	protected onItemsInput(event: Event): void {
		const target = event.target;
		if (target instanceof HTMLTextAreaElement) {
			this.itemsText.set(target.value);
		}
	}

	/** Select + immediately insert a preset (double-click shortcut). */
	protected confirmLayout(layout: SmartArtLayout): void {
		this.selectLayout(layout);
		this.confirm();
	}

	/** Emit the insert payload for the current selection, then close. */
	protected confirm(): void {
		const layout = this.selectedLayout();
		if (layout === null) {
			return;
		}
		const preset = presetByLayout(layout);
		const items = parseNodeTextarea(this.itemsText(), preset?.defaultItems ?? []);
		this.insert.emit({ layout, items });
		this.close.emit();
	}
}
