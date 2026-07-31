/**
 * custom-shows.component.ts: Modal dialog for managing custom PowerPoint shows.
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

import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	input,
	output,
	signal,
} from '@angular/core';
import { LucideX } from '@lucide/angular';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { PptxSlide } from 'pptx-viewer-core';

import type { CustomShow } from './custom-shows-helpers';

@Component({
	selector: 'pptx-custom-shows',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe, LucideX],
	templateUrl: './custom-shows.component.html',
	styleUrl: './custom-shows.component.css',
})
export class CustomShowsComponent {
	private readonly translate = inject(TranslateService);

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
		return name.trim().length > 0
			? `${index + 1}. ${name}`
			: this.translate.instant('pptx.compare.slideNumber', { number: index + 1 });
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
