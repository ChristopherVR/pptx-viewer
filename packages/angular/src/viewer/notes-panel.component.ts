/**
 * notes-panel.component.ts — collapsible, editable speaker-notes panel.
 *
 * Ported from: packages/vue/src/viewer/components/NotesPanel.vue
 * (itself the Vue mirror of the React `SlideNotesPanel`).
 *
 * Renders the active slide's speaker notes in an editable `<textarea>`. Reads the
 * real core field `PptxSlide.notes` (populated during parse and preserved through
 * `LoadContentService` / `EditorStateService`). The host writes the edited text
 * back via a history-aware update when {@link update} is emitted.
 *
 * Framework-neutral e2e contract
 * ------------------------------
 * The body wrapper carries `id="slide-notes-content"` and the editor is a
 * `textarea[name="slide-notes"]`, matching the React/Vue viewers so the shared
 * Playwright specs (`e2e/mobile-notes.spec.ts`) run unchanged against Angular.
 *
 * Touch / focus correctness
 * -------------------------
 * The textarea is UNCONTROLLED: its value is seeded imperatively via a view-child
 * ref exactly once per slide and never re-bound while the user types. Re-binding
 * `value` to a signal the host mutated on every keystroke would dismiss the
 * on-screen keyboard and jump the caret — so the DOM owns the text during an edit
 * and we only commit on `change` / `blur` (one history entry per edit).
 */

import {
	afterNextRender,
	ChangeDetectionStrategy,
	Component,
	effect,
	ElementRef,
	input,
	output,
	signal,
	viewChild,
} from '@angular/core';
import type { PptxSlide } from 'pptx-viewer-core';

@Component({
	selector: 'pptx-notes-panel',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<section class="pptx-ng-notes-panel" [attr.data-collapsed]="collapsed()">
			<button
				type="button"
				class="pptx-ng-notes-header"
				[attr.aria-expanded]="!collapsed()"
				(click)="toggle()"
			>
				<span class="pptx-ng-notes-label">Speaker notes</span>
				<span class="pptx-ng-notes-chevron" aria-hidden="true">{{ collapsed() ? '▸' : '▾' }}</span>
			</button>

			@if (!collapsed()) {
				<div id="slide-notes-content" class="pptx-ng-notes-body">
					<textarea
						#textarea
						name="slide-notes"
						class="pptx-ng-notes-textarea"
						[disabled]="!slide()"
						[attr.placeholder]="slide() ? 'Add speaker notes…' : 'No slide selected'"
						aria-label="Speaker notes"
						spellcheck="true"
						(change)="onCommit($event)"
						(blur)="onCommit($event)"
					></textarea>
				</div>
			}
		</section>
	`,
	styles: [
		`
			:host {
				display: block;
			}
			.pptx-ng-notes-panel {
				display: flex;
				flex-direction: column;
				border-top: 1px solid rgba(0, 0, 0, 0.1);
				background: #ffffff;
				color: #111827;
			}
			.pptx-ng-notes-header {
				display: flex;
				width: 100%;
				align-items: center;
				justify-content: space-between;
				padding: 0.5rem 0.75rem;
				border: none;
				background: transparent;
				font-size: 0.8125rem;
				font-weight: 600;
				color: #6b7280;
				cursor: pointer;
			}
			.pptx-ng-notes-header:hover {
				color: #111827;
			}
			.pptx-ng-notes-body {
				padding: 0 0.75rem 0.75rem;
			}
			.pptx-ng-notes-textarea {
				box-sizing: border-box;
				width: 100%;
				min-height: 5rem;
				resize: vertical;
				padding: 0.5rem;
				border: 1px solid rgba(0, 0, 0, 0.15);
				border-radius: 0.375rem;
				background: rgba(0, 0, 0, 0.03);
				font: inherit;
				font-size: 0.8125rem;
				line-height: 1.5;
				color: #111827;
			}
			.pptx-ng-notes-textarea:focus {
				outline: none;
				border-color: #6366f1;
				box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.3);
			}
			.pptx-ng-notes-textarea:disabled {
				cursor: not-allowed;
				opacity: 0.6;
			}
		`,
	],
})
export class NotesPanelComponent {
	/** The active slide whose notes are shown / edited. */
	readonly slide = input<PptxSlide | undefined>(undefined);

	/** Emits the new notes text on commit (change / blur). */
	readonly update = output<string>();

	/** Whether the panel body is collapsed (notes hidden). */
	readonly collapsed = signal(false);

	private readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');

	/** The slide id we've already seeded the textarea for. */
	private seededId: string | null = null;

	constructor() {
		// Seed (and re-seed) the uncontrolled textarea exactly once per slide.
		// Keying on the slide id means we never overwrite in-progress typed text on
		// an unrelated change-detection pass (which would steal focus on touch).
		effect(() => {
			const el = this.textarea()?.nativeElement;
			const slide = this.slide();
			if (!el) {
				return;
			}
			const id = slide?.id ?? null;
			if (this.seededId === id) {
				return;
			}
			this.seededId = id;
			el.value = slide?.notes ?? '';
		});

		afterNextRender(() => {
			const el = this.textarea()?.nativeElement;
			if (el && this.seededId === null) {
				this.seededId = this.slide()?.id ?? null;
				el.value = this.slide()?.notes ?? '';
			}
		});
	}

	/** Toggle the collapsed state. */
	toggle(): void {
		this.collapsed.update((v) => !v);
	}

	/** Commit the edited notes text to the host. */
	onCommit(event: Event): void {
		this.update.emit((event.target as HTMLTextAreaElement).value);
	}
}
