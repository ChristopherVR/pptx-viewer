/**
 * equation-editor-dialog.component.ts: Insert / edit a LaTeX-based equation.
 *
 * Selector: `pptx-equation-editor-dialog`
 *
 * Angular port of the React `EquationEditorDialog`. A modal for authoring an
 * equation as LaTeX, with a live MathML preview and a gallery of common
 * templates. Composes {@link ModalDialogComponent} and
 * {@link EquationTemplateGalleryComponent}. Internally converts LaTeX to OMML
 * (Office Math Markup Language) for the emitted value and to MathML for the
 * on-screen preview.
 *
 * Behaviour:
 *  - Host owns the `open` flag and supplies `existingOmml` when editing.
 *  - Seeds the LaTeX textarea from `existingOmml` (via `convertOmmlToLatex`)
 *    each time the dialog opens; empty for a fresh insert.
 *  - Emits `insert` with the recomputed OMML object, then `close`.
 *  - Emits `close` on Cancel, the `x` button, backdrop click, and Escape.
 *
 * Pure conversion logic lives in the vendored shared render modules
 * (`convertLatexToOmml`, `convertOmmlToLatex`, `ommlToMathml`) and in
 * {@link ./equation-editor-helpers}.
 */

import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	input,
	output,
	signal,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import type { SafeHtml } from '@angular/platform-browser';

import { convertLatexToOmml, convertOmmlToLatex } from '../internal/shared';
import { latexToMathml } from './equation-editor-helpers';
import { EquationTemplateGalleryComponent } from './equation-template-gallery.component';
import { ModalDialogComponent } from './modal-dialog.component';

@Component({
	selector: 'pptx-equation-editor-dialog',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ModalDialogComponent, EquationTemplateGalleryComponent],
	template: `
		<pptx-modal-dialog [open]="open()" [title]="dialogTitle()" (close)="close.emit()">
			<div class="pptx-ng-eq">
				<!-- Live preview -->
				<div class="pptx-ng-eq-preview">
					@if (hasContent()) {
						<div class="pptx-ng-eq-math" [innerHTML]="previewMathml()"></div>
					} @else {
						<span class="pptx-ng-eq-placeholder">Equation preview will appear here</span>
					}
				</div>

				<!-- LaTeX input -->
				<div class="pptx-ng-eq-field">
					<label class="pptx-ng-eq-label" for="pptx-ng-eq-latex">LaTeX Input</label>
					<textarea
						id="pptx-ng-eq-latex"
						class="pptx-ng-eq-textarea"
						spellcheck="false"
						placeholder="\\frac{a}{b} + \\sqrt{c}"
						[value]="latex()"
						(input)="latex.set(asValue($event))"
						(keydown)="onKeyDown($event)"
					></textarea>
					<p class="pptx-ng-eq-hint">Use LaTeX syntax. Ctrl+Enter to insert.</p>
				</div>

				<pptx-equation-template-gallery [activeLatex]="latex()" (select)="latex.set($event)" />
			</div>

			<div footer>
				<button type="button" class="pptx-ng-eq-btn" (click)="close.emit()">Cancel</button>
				<button
					type="button"
					class="pptx-ng-eq-btn pptx-ng-eq-btn-primary"
					[disabled]="!hasContent()"
					(click)="onInsert()"
				>
					{{ isEditing() ? 'Update' : 'Insert' }}
				</button>
			</div>
		</pptx-modal-dialog>
	`,
	styles: [
		`
			.pptx-ng-eq {
				display: flex;
				flex-direction: column;
				gap: 1rem;
				width: min(88vw, 600px);
			}
			.pptx-ng-eq-preview {
				display: flex;
				align-items: center;
				justify-content: center;
				min-height: 80px;
				padding: 1rem;
				border: 1px solid var(--pptx-border, #374151);
				border-radius: 0.5rem;
				background: var(--pptx-muted, #111827);
			}
			.pptx-ng-eq-math {
				font-size: 1.5rem;
				color: var(--pptx-foreground, #f3f4f6);
				font-family: 'Cambria Math', 'STIX Two Math', serif;
			}
			.pptx-ng-eq-placeholder {
				font-size: 0.8125rem;
				font-style: italic;
				color: var(--pptx-muted-foreground, #9ca3af);
			}
			.pptx-ng-eq-field {
				display: flex;
				flex-direction: column;
				gap: 0.375rem;
			}
			.pptx-ng-eq-label {
				font-size: 0.75rem;
				font-weight: 500;
				color: var(--pptx-muted-foreground, #9ca3af);
			}
			.pptx-ng-eq-textarea {
				width: 100%;
				height: 6rem;
				padding: 0.5rem 0.75rem;
				border: 1px solid var(--pptx-border, #374151);
				border-radius: 0.5rem;
				background: var(--pptx-muted, #111827);
				color: var(--pptx-foreground, #f3f4f6);
				font-size: 0.8125rem;
				font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
				resize: none;
			}
			.pptx-ng-eq-textarea:focus {
				outline: none;
				border-color: var(--pptx-primary, #6366f1);
			}
			.pptx-ng-eq-hint {
				margin: 0;
				font-size: 0.6875rem;
				color: var(--pptx-muted-foreground, #9ca3af);
			}
			.pptx-ng-eq-btn {
				padding: 0.375rem 0.75rem;
				border: 1px solid var(--pptx-border, #374151);
				border-radius: 0.375rem;
				background: var(--pptx-card, #111827);
				color: var(--pptx-foreground, #f3f4f6);
				font-size: 0.75rem;
				cursor: pointer;
				transition: background 0.15s ease;
			}
			.pptx-ng-eq-btn:hover:not(:disabled) {
				background: var(--pptx-border, #374151);
			}
			.pptx-ng-eq-btn:disabled {
				opacity: 0.4;
				cursor: not-allowed;
			}
			.pptx-ng-eq-btn-primary {
				border-color: var(--pptx-primary, #6366f1);
				background: var(--pptx-primary, #6366f1);
				color: #ffffff;
				font-weight: 500;
			}
			.pptx-ng-eq-btn-primary:hover:not(:disabled) {
				filter: brightness(1.1);
			}
		`,
	],
})
export class EquationEditorDialogComponent {
	/** Whether the dialog is visible. */
	readonly open = input<boolean>(false);

	/** When editing an existing equation, its OMML tree (null for a fresh insert). */
	readonly existingOmml = input<Record<string, unknown> | null>(null);

	/** Fired with the OMML object to insert / update on the slide. */
	readonly insert = output<Record<string, unknown>>();

	/** Fired when the dialog is dismissed. */
	readonly close = output<void>();

	private readonly sanitizer = inject(DomSanitizer);

	/** Current LaTeX source in the textarea. */
	readonly latex = signal('');

	/** True when editing an existing equation (drives the title / button label). */
	readonly isEditing = computed(() => this.existingOmml() !== null);

	/** Header title: edit vs insert. */
	readonly dialogTitle = computed(() => (this.isEditing() ? 'Edit Equation' : 'Insert Equation'));

	/** Live OMML compiled from the current LaTeX ({} on failure / empty input). */
	private readonly omml = computed<Record<string, unknown>>(() => {
		const value = this.latex();
		if (!value.trim()) {
			return {};
		}
		try {
			return convertLatexToOmml(value);
		} catch {
			return {};
		}
	});

	/** Whether there is a renderable equation (drives preview + insert enabling). */
	readonly hasContent = computed(
		() => this.latex().trim().length > 0 && Object.keys(this.omml()).length > 0,
	);

	/** Sanitized MathML preview for the current LaTeX. */
	readonly previewMathml = computed<SafeHtml>(() =>
		this.sanitizer.bypassSecurityTrustHtml(latexToMathml(this.latex())),
	);

	constructor() {
		// Seed the LaTeX field from the existing OMML each time the dialog opens.
		effect(() => {
			if (this.open()) {
				const existing = this.existingOmml();
				this.latex.set(existing ? convertOmmlToLatex(existing) : '');
			}
		});
	}

	asValue(event: Event): string {
		return (event.target as HTMLTextAreaElement).value;
	}

	onKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			this.onInsert();
		}
	}

	onInsert(): void {
		if (!this.hasContent()) {
			return;
		}
		this.insert.emit(this.omml());
		this.close.emit();
	}
}
