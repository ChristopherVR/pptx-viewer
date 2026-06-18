/**
 * custom-shows.component.ts — Modal dialog for managing custom PowerPoint shows.
 *
 * Selector: `pptx-custom-shows`
 *
 * A custom show is a named, ordered subset of slides. This dialog allows the user
 * to list existing shows, create new ones (enter a name + pick slides via
 * checkboxes), delete shows, and set/unset the active show for presentation mode.
 *
 * All state mutations are surfaced via outputs; the component is purely presentational
 * except for draft signals used to track the create-form state.
 */

import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { PptxSlide } from 'pptx-viewer-core';

import type { CustomShow } from './custom-shows-helpers';

@Component({
	selector: 'pptx-custom-shows',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (open()) {
			<!-- Backdrop -->
			<div class="pptx-ng-cs-backdrop" aria-hidden="true" (click)="close.emit()"></div>

			<!-- Dialog -->
			<div
				class="pptx-ng-cs-dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby="pptx-cs-title"
			>
				<header class="pptx-ng-cs-header">
					<h2 id="pptx-cs-title" class="pptx-ng-cs-title">Custom Shows</h2>
					<button
						type="button"
						class="pptx-ng-cs-close"
						aria-label="Close custom shows dialog"
						(click)="close.emit()"
					>
						✕
					</button>
				</header>

				<div class="pptx-ng-cs-body">
					<!-- Existing shows list -->
					<section class="pptx-ng-cs-section">
						<h3 class="pptx-ng-cs-section-title">
							Saved Shows
							@if (customShows().length > 0) {
								<span class="pptx-ng-cs-badge">{{ customShows().length }}</span>
							}
						</h3>

						@if (customShows().length > 0) {
							<ul class="pptx-ng-cs-show-list">
								@for (show of customShows(); track show.id) {
									<li
										class="pptx-ng-cs-show-row"
										[class.pptx-ng-cs-show-row--active]="show.id === activeCustomShowId()"
									>
										<!-- Edit mode for this show -->
										@if (editingShowId() === show.id) {
											<div class="pptx-ng-cs-edit-row">
												<input
													type="text"
													class="pptx-ng-cs-input"
													[value]="editDraftName()"
													aria-label="Edit show name"
													(input)="onEditNameInput($event)"
												/>
												<button
													type="button"
													class="pptx-ng-cs-btn pptx-ng-cs-btn--primary"
													[disabled]="!canSaveEdit()"
													(click)="saveEdit(show.id)"
												>
													Save
												</button>
												<button
													type="button"
													class="pptx-ng-cs-btn"
													(click)="editingShowId.set(null)"
												>
													Cancel
												</button>
											</div>
											<!-- Slide picker for edit -->
											<div class="pptx-ng-cs-slide-picker">
												@for (slide of slides(); track slide.id; let i = $index) {
													<label class="pptx-ng-cs-slide-option">
														<input
															type="checkbox"
															[checked]="editDraftSlideIds().includes(slide.id)"
															(change)="toggleEditSlide(slide.id)"
														/>
														<span>{{ slideLabel(slide, i) }}</span>
													</label>
												}
											</div>
										} @else {
											<div class="pptx-ng-cs-show-info">
												<span class="pptx-ng-cs-show-name">{{ show.name }}</span>
												<span class="pptx-ng-cs-show-meta">
													{{ show.slideIds.length }} slide{{
														show.slideIds.length === 1 ? '' : 's'
													}}
												</span>
											</div>
											<div class="pptx-ng-cs-show-actions">
												<button
													type="button"
													class="pptx-ng-cs-btn"
													[class.pptx-ng-cs-btn--active]="show.id === activeCustomShowId()"
													[title]="
														show.id === activeCustomShowId()
															? 'Unset active show'
															: 'Set as active show'
													"
													(click)="onToggleActive(show.id)"
												>
													{{ show.id === activeCustomShowId() ? '★ Active' : '☆ Set Active' }}
												</button>
												<button
													type="button"
													class="pptx-ng-cs-btn"
													title="Edit show"
													(click)="startEdit(show)"
												>
													Edit
												</button>
												<button
													type="button"
													class="pptx-ng-cs-btn pptx-ng-cs-btn--danger"
													title="Delete show"
													(click)="remove.emit(show.id)"
												>
													Delete
												</button>
											</div>
										}
									</li>
								}
							</ul>
						} @else {
							<p class="pptx-ng-cs-empty">No custom shows yet. Create one below.</p>
						}
					</section>

					<!-- Create new show form -->
					<section class="pptx-ng-cs-section">
						<h3 class="pptx-ng-cs-section-title">Create New Show</h3>
						<div class="pptx-ng-cs-create-form">
							<input
								type="text"
								class="pptx-ng-cs-input"
								placeholder="Show name…"
								[value]="draftName()"
								aria-label="New show name"
								(input)="onDraftNameInput($event)"
							/>

							@if (slides().length > 0) {
								<div class="pptx-ng-cs-slide-picker">
									@for (slide of slides(); track slide.id; let i = $index) {
										<label class="pptx-ng-cs-slide-option">
											<input
												type="checkbox"
												[checked]="draftSlideIds().includes(slide.id)"
												(change)="toggleDraftSlide(slide.id)"
											/>
											<span>{{ slideLabel(slide, i) }}</span>
										</label>
									}
								</div>
							}

							<button
								type="button"
								class="pptx-ng-cs-btn pptx-ng-cs-btn--primary"
								[disabled]="!canCreate()"
								(click)="submitCreate()"
							>
								Create Show
							</button>
						</div>
					</section>
				</div>

				<footer class="pptx-ng-cs-footer">
					<button type="button" class="pptx-ng-cs-btn" (click)="close.emit()">Close</button>
				</footer>
			</div>
		}
	`,
	styles: [
		`
			:host {
				display: contents;
			}

			.pptx-ng-cs-backdrop {
				position: fixed;
				inset: 0;
				background: rgba(0, 0, 0, 0.5);
				z-index: 200;
			}

			.pptx-ng-cs-dialog {
				position: fixed;
				top: 50%;
				left: 50%;
				transform: translate(-50%, -50%);
				z-index: 201;
				width: min(540px, 94vw);
				max-height: 80vh;
				display: flex;
				flex-direction: column;
				background: var(--pptx-card, #111827);
				color: var(--pptx-foreground, #f3f4f6);
				border: 1px solid var(--pptx-border, #374151);
				border-radius: 12px;
				box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
				font-family: system-ui, sans-serif;
			}

			.pptx-ng-cs-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 16px 20px 12px;
				border-bottom: 1px solid var(--pptx-border, #374151);
				flex-shrink: 0;
			}

			.pptx-ng-cs-title {
				margin: 0;
				font-size: 15px;
				font-weight: 600;
			}

			.pptx-ng-cs-close {
				background: transparent;
				border: none;
				color: var(--pptx-muted-foreground, #9ca3af);
				cursor: pointer;
				font-size: 16px;
				padding: 2px 6px;
				border-radius: 4px;
			}

			.pptx-ng-cs-close:hover {
				background: var(--pptx-accent, #1f2937);
				color: var(--pptx-foreground, #f3f4f6);
			}

			.pptx-ng-cs-body {
				flex: 1 1 auto;
				overflow-y: auto;
				padding: 16px 20px;
				display: flex;
				flex-direction: column;
				gap: 20px;
				min-height: 0;
			}

			.pptx-ng-cs-section {
				display: flex;
				flex-direction: column;
				gap: 10px;
			}

			.pptx-ng-cs-section-title {
				margin: 0;
				font-size: 13px;
				font-weight: 600;
				color: var(--pptx-muted-foreground, #9ca3af);
				text-transform: uppercase;
				letter-spacing: 0.05em;
				display: flex;
				align-items: center;
				gap: 6px;
			}

			.pptx-ng-cs-badge {
				background: var(--pptx-primary, #6366f1);
				color: #fff;
				border-radius: 10px;
				padding: 1px 7px;
				font-size: 11px;
				font-weight: 700;
			}

			.pptx-ng-cs-show-list {
				list-style: none;
				margin: 0;
				padding: 0;
				display: flex;
				flex-direction: column;
				gap: 6px;
			}

			.pptx-ng-cs-show-row {
				padding: 10px 12px;
				border: 1px solid var(--pptx-border, #374151);
				border-radius: 8px;
				display: flex;
				flex-direction: column;
				gap: 8px;
			}

			.pptx-ng-cs-show-row--active {
				border-color: var(--pptx-primary, #6366f1);
				background: color-mix(in srgb, var(--pptx-primary, #6366f1) 10%, transparent);
			}

			.pptx-ng-cs-show-info {
				display: flex;
				align-items: baseline;
				justify-content: space-between;
				gap: 8px;
			}

			.pptx-ng-cs-show-name {
				font-size: 13px;
				font-weight: 600;
			}

			.pptx-ng-cs-show-meta {
				font-size: 11px;
				color: var(--pptx-muted-foreground, #9ca3af);
			}

			.pptx-ng-cs-show-actions {
				display: flex;
				gap: 6px;
				flex-wrap: wrap;
			}

			.pptx-ng-cs-edit-row {
				display: flex;
				gap: 6px;
				align-items: center;
				flex-wrap: wrap;
			}

			.pptx-ng-cs-input {
				flex: 1 1 auto;
				min-width: 120px;
				padding: 6px 10px;
				border-radius: 6px;
				border: 1px solid var(--pptx-border, #374151);
				background: var(--pptx-background, #030712);
				color: inherit;
				font: inherit;
				font-size: 13px;
			}

			.pptx-ng-cs-slide-picker {
				display: flex;
				flex-direction: column;
				gap: 4px;
				max-height: 160px;
				overflow-y: auto;
				padding: 6px 8px;
				border: 1px solid var(--pptx-border, #374151);
				border-radius: 6px;
				background: var(--pptx-background, #030712);
			}

			.pptx-ng-cs-slide-option {
				display: flex;
				align-items: center;
				gap: 8px;
				font-size: 13px;
				cursor: pointer;
				padding: 2px 0;
			}

			.pptx-ng-cs-empty {
				font-size: 13px;
				color: var(--pptx-muted-foreground, #9ca3af);
				margin: 0;
			}

			.pptx-ng-cs-create-form {
				display: flex;
				flex-direction: column;
				gap: 10px;
			}

			.pptx-ng-cs-btn {
				font-size: 12px;
				padding: 5px 12px;
				border-radius: 6px;
				border: 1px solid var(--pptx-border, #374151);
				background: transparent;
				color: inherit;
				cursor: pointer;
				white-space: nowrap;
			}

			.pptx-ng-cs-btn:hover {
				background: var(--pptx-accent, #1f2937);
			}

			.pptx-ng-cs-btn--primary {
				background: var(--pptx-primary, #6366f1);
				border-color: var(--pptx-primary, #6366f1);
				color: #fff;
				align-self: flex-start;
			}

			.pptx-ng-cs-btn--primary:hover:not(:disabled) {
				opacity: 0.9;
			}

			.pptx-ng-cs-btn--primary:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}

			.pptx-ng-cs-btn--danger {
				color: #f87171;
				border-color: #f87171;
			}

			.pptx-ng-cs-btn--danger:hover {
				background: rgba(248, 113, 113, 0.1);
			}

			.pptx-ng-cs-btn--active {
				background: color-mix(in srgb, var(--pptx-primary, #6366f1) 20%, transparent);
				border-color: var(--pptx-primary, #6366f1);
				color: var(--pptx-primary, #6366f1);
			}

			.pptx-ng-cs-btn:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}

			.pptx-ng-cs-footer {
				display: flex;
				justify-content: flex-end;
				padding: 12px 20px;
				border-top: 1px solid var(--pptx-border, #374151);
				flex-shrink: 0;
			}
		`,
	],
})
export class CustomShowsComponent {
	/** Whether the dialog is open. */
	readonly open = input<boolean>(false);
	/** All slides in the presentation (for slide picker). */
	readonly slides = input<readonly PptxSlide[]>([]);
	/** Existing custom shows. */
	readonly customShows = input<readonly CustomShow[]>([]);
	/** Id of the currently active custom show, or null. */
	readonly activeCustomShowId = input<string | null>(null);

	/** Emitted when the user creates a new show. */
	readonly create = output<{ name: string; slideIds: string[] }>();
	/** Emitted with the id of the show to delete. */
	readonly remove = output<string>();
	/** Emitted when the user renames/reorders a show. */
	readonly update = output<{ id: string; name: string; slideIds: string[] }>();
	/** Emitted with the id of the show to set as active (null to clear). */
	readonly setActive = output<string | null>();
	/** Emitted when the dialog should close. */
	readonly close = output<void>();

	// ── Create-form draft state ──────────────────────────────────────────────
	/** Name typed into the create form. */
	protected readonly draftName = signal<string>('');
	/** Slide ids checked in the create form. */
	protected readonly draftSlideIds = signal<string[]>([]);
	/** Whether the create form is valid. */
	protected readonly canCreate = computed<boolean>(
		() => this.draftName().trim().length > 0 && this.draftSlideIds().length > 0,
	);

	// ── Edit-mode state ──────────────────────────────────────────────────────
	/** Id of the show currently being edited inline, or null. */
	protected readonly editingShowId = signal<string | null>(null);
	/** Name draft for the show being edited. */
	protected readonly editDraftName = signal<string>('');
	/** Slide ids draft for the show being edited. */
	protected readonly editDraftSlideIds = signal<string[]>([]);
	/** Whether the edit form has valid data to save. */
	protected readonly canSaveEdit = computed<boolean>(
		() => this.editDraftName().trim().length > 0 && this.editDraftSlideIds().length > 0,
	);

	// ── Helpers ──────────────────────────────────────────────────────────────

	protected slideLabel(slide: PptxSlide, index: number): string {
		const name = slide.name ?? '';
		return name.trim().length > 0 ? `${index + 1}. ${name}` : `Slide ${index + 1}`;
	}

	// ── Create form handlers ─────────────────────────────────────────────────

	protected onDraftNameInput(event: Event): void {
		this.draftName.set((event.target as HTMLInputElement).value);
	}

	protected toggleDraftSlide(slideId: string): void {
		this.draftSlideIds.update((ids) =>
			ids.includes(slideId) ? ids.filter((id) => id !== slideId) : [...ids, slideId],
		);
	}

	protected submitCreate(): void {
		const name = this.draftName().trim();
		if (name.length === 0 || this.draftSlideIds().length === 0) {
			return;
		}
		this.create.emit({ name, slideIds: [...this.draftSlideIds()] });
		this.draftName.set('');
		this.draftSlideIds.set([]);
	}

	// ── Edit handlers ────────────────────────────────────────────────────────

	protected startEdit(show: CustomShow): void {
		this.editingShowId.set(show.id);
		this.editDraftName.set(show.name);
		this.editDraftSlideIds.set([...show.slideIds]);
	}

	protected onEditNameInput(event: Event): void {
		this.editDraftName.set((event.target as HTMLInputElement).value);
	}

	protected toggleEditSlide(slideId: string): void {
		this.editDraftSlideIds.update((ids) =>
			ids.includes(slideId) ? ids.filter((id) => id !== slideId) : [...ids, slideId],
		);
	}

	protected saveEdit(id: string): void {
		const name = this.editDraftName().trim();
		if (name.length === 0 || this.editDraftSlideIds().length === 0) {
			return;
		}
		this.update.emit({ id, name, slideIds: [...this.editDraftSlideIds()] });
		this.editingShowId.set(null);
	}

	// ── Active show ──────────────────────────────────────────────────────────

	protected onToggleActive(id: string): void {
		this.setActive.emit(this.activeCustomShowId() === id ? null : id);
	}
}
