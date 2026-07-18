/**
 * equation-template-gallery.component.ts: the "Common Templates" grid for the
 * equation editor dialog.
 *
 * Selector: `pptx-equation-template-gallery`
 *
 * Split out of {@link EquationEditorDialogComponent} to keep each file focused.
 * Renders the pre-defined {@link TEMPLATES} as a grid of buttons with a live
 * MathML preview each (computed once), highlighting the one matching the
 * current LaTeX and emitting `select` when a template is clicked.
 */

import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import type { SafeHtml } from '@angular/platform-browser';
import { TranslatePipe } from '@ngx-translate/core';

import { latexToMathml, TEMPLATES } from './equation-editor-helpers';
import type { EquationTemplate } from './equation-editor-helpers';

@Component({
	selector: 'pptx-equation-template-gallery',
	standalone: true,
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="pptx-ng-eq-field">
			<h3 class="pptx-ng-eq-templates-title">{{ 'pptx.equation.templates' | translate }}</h3>
			<div class="pptx-ng-eq-grid">
				@for (tmpl of templates; track tmpl.latex) {
					<button
						type="button"
						class="pptx-ng-eq-template"
						[class.is-active]="activeLatex() === tmpl.latex"
						[title]="tmpl.i18nKey | translate"
						(click)="select.emit(tmpl.latex)"
					>
						<span class="pptx-ng-eq-template-math" [innerHTML]="tmpl.mathml"></span>
						<span class="pptx-ng-eq-template-label">{{ tmpl.i18nKey | translate }}</span>
					</button>
				}
			</div>
		</div>
	`,
	styles: [
		`
			.pptx-ng-eq-field {
				display: flex;
				flex-direction: column;
				gap: 0.375rem;
			}
			.pptx-ng-eq-templates-title {
				margin: 0;
				font-size: 0.75rem;
				font-weight: 500;
				color: var(--pptx-muted-foreground, #9ca3af);
			}
			.pptx-ng-eq-grid {
				display: grid;
				grid-template-columns: repeat(4, minmax(0, 1fr));
				gap: 0.375rem;
			}
			.pptx-ng-eq-template {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 0.25rem;
				padding: 0.5rem;
				border: 1px solid var(--pptx-border, #374151);
				border-radius: 0.5rem;
				background: var(--pptx-card, #111827);
				cursor: pointer;
				transition:
					background 0.15s ease,
					border-color 0.15s ease;
			}
			.pptx-ng-eq-template:hover {
				background: var(--pptx-border, #374151);
			}
			.pptx-ng-eq-template.is-active {
				border-color: var(--pptx-primary, #6366f1);
				background: color-mix(in srgb, var(--pptx-primary, #6366f1) 12%, transparent);
			}
			.pptx-ng-eq-template-math {
				display: flex;
				align-items: center;
				justify-content: center;
				height: 2rem;
				overflow: hidden;
				font-size: 0.875rem;
				color: var(--pptx-foreground, #f3f4f6);
				font-family: 'Cambria Math', 'STIX Two Math', serif;
			}
			.pptx-ng-eq-template-label {
				width: 100%;
				text-align: center;
				font-size: 0.625rem;
				color: var(--pptx-muted-foreground, #9ca3af);
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}
		`,
	],
})
export class EquationTemplateGalleryComponent {
	/** Current LaTeX source (drives the active-template highlight). */
	readonly activeLatex = input<string>('');

	/** Fired with the chosen template's LaTeX when a tile is clicked. */
	readonly select = output<string>();

	private readonly sanitizer = inject(DomSanitizer);

	/** Templates with pre-computed MathML previews (built once). */
	protected readonly templates: ReadonlyArray<EquationTemplate & { mathml: SafeHtml }> =
		TEMPLATES.map((tmpl) => ({
			...tmpl,
			mathml: this.sanitizer.bypassSecurityTrustHtml(latexToMathml(tmpl.latex)),
		}));
}
